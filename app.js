// Define the original sample data as a constant
const SAMPLE_ITEMS = [
    { id: 's-1', location: 'Warehouse A', itemCode: 'MK-001', description: 'Milk 1L', qty: 12, expiryDate: '2024-03-15', status: 'Active', history: 'Initial Stock', category: 'Dairy', returnType: 'Non-Returnable', supplierName: 'Dairy Farms Ltd' },
    { id: 's-2', location: 'Fridge 02', itemCode: 'EG-122', description: 'Eggs 12pk', qty: 24, expiryDate: '2024-05-20', status: 'Active', history: 'Restocked', category: 'Dairy', returnType: 'Returnable', supplierName: 'AgriCorp' },
    { id: 's-3', location: 'Bakery Shelf', itemCode: 'BR-990', description: 'Whole Wheat Bread', qty: 5, expiryDate: '2024-01-28', status: 'Active', history: 'Initial Stock', category: 'Bakery', returnType: 'Non-Returnable', supplierName: 'SunBake Co' },
    { id: 's-4', location: 'Produce Aisle', itemCode: 'AP-552', description: 'Red Apples 1kg', qty: 50, expiryDate: '2024-07-10', status: 'Active', history: 'New Shipment', category: 'Produce', returnType: 'Returnable', supplierName: 'FreshProduce Inc' },
    { id: 's-5', location: 'Freezer 01', itemCode: 'CH-221', description: 'Chicken Breast 500g', qty: 15, expiryDate: '2024-09-01', status: 'Active', history: 'Manual Update', category: 'Meat', returnType: 'Non-Returnable', supplierName: 'MeatMaster' },
    { id: 's-6', location: 'Pantry', itemCode: 'PA-001', description: 'Pasta 500g', qty: 30, expiryDate: '2025-02-10', status: 'Active', history: 'Initial Stock', category: 'Dry Goods', returnType: 'Non-Returnable', supplierName: 'GrainCo' },
    { id: 's-7', location: 'Warehouse B', itemCode: 'CO-002', description: 'Coffee Beans 1kg', qty: 10, expiryDate: '2024-04-05', status: 'Active', history: 'New Order', category: 'Beverages', returnType: 'Non-Returnable', supplierName: 'BeanSuppliers' }
];

// Default System Credentials
const DEFAULT_USER = 'admin@example.com';
const DEFAULT_PASS = 'admin123';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

// Cloud Sync Configuration (Replace with your actual Supabase project details)
const SUPABASE_URL = 'https://mroinbosnhkimutkrnqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb2luYm9zbmhraW11dGtybnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU5MzYsImV4cCI6MjA5MDY0MTkzNn0.eDhVYEQGLg-Hq66VbggB4AAY7nPX6k5dVbNhEv6PLzY';

const supabaseClient = (window.supabase) ? 
    window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Session State
let inactivityTimer;
let autoSyncTimer;
let isSyncing = false;
let fabMenuOpen = false;

// Mock Data
let items = JSON.parse(localStorage.getItem('ft_inventory_data')) || []; // Starts empty, no auto-inject

// Global Search and Filter State
let searchTerm = '';
let statusFilter = 'All';
let returnTypeFilter = 'All';
let listTab = 'inventory'; 
let startDateFilter = '';
let endDateFilter = '';
let sortColumn = 'expiryDate';
let sortDirection = 'asc';
let selectedItemIds = new Set();
let focusedIndex = -1;
let currentPage = 1;
let rowsPerPage = 25;
let lastActionState = null;

let calcActiveItemId = null;
let calcInputValue = '0';

// Automated Status Logic
function calculateStatus(expiryDateStr) {
    if (!expiryDateStr) return 'Active';
    const expiryDate = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today >= expiryDate) return 'Expired';

    // Expiring status: 8 months before expiry
    const expiringThreshold = new Date(expiryDate);
    expiringThreshold.setMonth(expiringThreshold.getMonth() - 8);

    return today >= expiringThreshold ? 'Expiring' : 'Active';
}

// Cloud Data Fetching Logic
async function fetchCloudData(silent = false) {
    if (!supabaseClient || isSyncing) return;
    
    isSyncing = true;
    updateSyncUI(true);

    if (!silent) showLoading("Syncing with Cloud...");
    
    try {
        // Fetch from both active inventory and RTV history tables
        const [invResp, rtvResp] = await Promise.all([
            supabaseClient.from('inventory').select('*'),
            supabaseClient.from('rtv_history').select('*')
        ]);

        if (!invResp.error && !rtvResp.error) {
            const invData = invResp.data || [];
            const rtvData = (rtvResp.data || []).map(item => ({ ...item, isRTV: true }));
            
            items = [...invData, ...rtvData];
            localStorage.setItem('ft_inventory_data', JSON.stringify(items));
            
            // Refresh statuses and re-render the view if it's the dashboard or list
            refreshItemStatuses();
            const currentView = localStorage.getItem('currentView') || 'dashboard';
            
            // Auto-refresh specifically for list and dashboard during background sync
            if (currentView === 'dashboard') renderDashboard();
            else if (currentView === 'list') renderList();
            else if (currentView === 'reports') renderReports();
            else if (currentView === 'settings') renderSettings();
        }
    } catch (e) {
        console.error("Cloud Fetch Error:", e);
    } finally {
        if (!silent) hideLoading();
        isSyncing = false;
        setTimeout(() => updateSyncUI(false), 500);
    }
}

function startAutoSync() {
    stopAutoSync();
    const isEnabled = localStorage.getItem('autoRefreshEnabled') !== 'false'; // Default true
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isEnabled && isLoggedIn) {
        autoSyncTimer = setInterval(() => {
            const currentView = localStorage.getItem('currentView') || 'dashboard';
            // Specifically trigger auto-refresh for list and dashboard
            if (currentView === 'dashboard' || currentView === 'list') {
                fetchCloudData(true);
            }
        }, 2000); 
    }
}

function updateSyncUI(active) {
    const icon = document.getElementById('sync-icon');
    if (!icon) return;

    if (active) {
        icon.classList.replace('text-green-500', 'text-indigo-500');
        icon.classList.add('animate-pulse');
    } else {
        icon.classList.replace('text-indigo-500', 'text-green-500');
        icon.classList.remove('animate-pulse');
    }
}

function stopAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
}

// Persistent Storage Logic
async function saveItems() {
    // 1. Always persist locally first for offline safety
    localStorage.setItem('ft_inventory_data', JSON.stringify(items));

    // 2. Sync to Cloud if Supabase is initialized
    if (supabaseClient) {
        const inventoryItems = items.filter(i => !i.isRTV);
        const rtvItems = items.filter(i => i.isRTV);

        // Sync Active Inventory
        if (inventoryItems.length > 0) {
            await supabaseClient.from('inventory').upsert(inventoryItems, { onConflict: 'id' });
        }

        // Sync RTV History Table
        if (rtvItems.length > 0) {
            await supabaseClient.from('rtv_history').upsert(rtvItems, { onConflict: 'id' });
            
            // Clean up: If items were moved to RTV, remove them from the active inventory table
            const rtvIds = rtvItems.map(i => i.id);
            await supabaseClient.from('inventory').delete().in('id', rtvIds);
        }
    }
}

// Centralized logic to ensure all item statuses are up-to-date
function refreshItemStatuses(skipSave = false) {
    let changed = false;
    items = items.map(item => {
        const newStatus = calculateStatus(item.expiryDate);
        if (item.status !== newStatus) {
            changed = true;
            return { ...item, status: newStatus };
        }
        return item;
    });
    
    if (changed && !skipSave) saveItems();
}

// Authentication Logic
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading("Authenticating...");
    
    const emailInput = e.target.querySelector('input[type="email"]').value;
    const passwordInput = e.target.querySelector('input[type="password"]').value;
    
    // 1. Check local credentials first
    let storedUser = localStorage.getItem('ft_username') || DEFAULT_USER;
    let storedPass = localStorage.getItem('ft_password') || DEFAULT_PASS;

    // 2. If local doesn't match, attempt to verify with Cloud
    if (emailInput !== storedUser || passwordInput !== storedPass) {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', 'admin_account')
                .single();
            
            if (!error && data) {
                storedUser = data.username;
                storedPass = data.password;
                if (data.avatar) localStorage.setItem('ft_avatar', data.avatar);
            }
        }
    }

    hideLoading();
    if (emailInput === storedUser && passwordInput === storedPass) {
        // Sync local storage with verified credentials
        localStorage.setItem('ft_username', storedUser);
        localStorage.setItem('ft_password', storedPass);
        localStorage.setItem('isLoggedIn', 'true');
        
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-layout').classList.remove('hidden');
        updateUIWithUser(storedUser);
        startInactivityTimer();
        showView('dashboard');
        startAutoSync(); // Immediately start the 2s refresh timer upon login
    } else {
        alert('Invalid credentials. Please try again.');
    }
});

function logout() {
    clearTimeout(inactivityTimer);
    stopAutoSync();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentView');
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('main-layout').classList.add('hidden');
}

// Navigation Logic
window.showView = function(viewId) {
    // Recalculate all statuses whenever switching views to ensure date-based accuracy
    refreshItemStatuses();

    // Update UI headers
    document.getElementById('view-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    
    if (viewId === 'list') {
        focusedIndex = -1;
        currentPage = 1;
    }

    // Persist current view
    localStorage.setItem('currentView', viewId);
    
    fabMenuOpen = false; // Reset FAB menu when switching views

    // Hide all views
    document.querySelectorAll('.view-content').forEach(view => view.classList.add('hidden'));
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
        closeSidebarMobile();
    }

    // Update Sidebar links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('bg-slate-800', 'text-white');
        if (link.innerText.toLowerCase().includes(viewId)) {
            link.classList.add('bg-slate-800');
        }
    });

    // Show requested view
    const currentView = document.getElementById(`view-${viewId}`);
    currentView.classList.remove('hidden');

    // Render dynamic content
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'list') renderList();
    if (viewId === 'reports') renderReports();
    if (viewId === 'settings') renderSettings();
    renderFAB();
}

function renderDashboard() {
    const liveItems = items.filter(i => !i.isRTV);
    const expiredCount = liveItems.filter(i => i.status === 'Expired').length;
    const expiringCount = liveItems.filter(i => i.status === 'Expiring').length;
    const activeCount = liveItems.filter(i => i.status === 'Active').length;
    const totalCount = liveItems.length;

    document.getElementById('stats-grid').innerHTML = `
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-red-50 text-red-600 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <i class="fas fa-calendar-times text-xl"></i>
                </div>
                <span class="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase tracking-tighter">Immediate Action</span>
            </div>
            <p class="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Expired Items</p>
            <p class="text-3xl font-black text-gray-900">${expiredCount}</p>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <i class="fas fa-clock text-xl"></i>
                </div>
                <span class="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase tracking-tighter">Review Soon</span>
            </div>
            <p class="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Expiring Soon</p>
            <p class="text-3xl font-black text-gray-900">${expiringCount}</p>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-green-50 text-green-600 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <i class="fas fa-check-circle text-xl"></i>
                </div>
                <span class="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase tracking-tighter">Healthy</span>
            </div>
            <p class="text-sm text-gray-400 font-bold uppercase tracking-wider mb-1">Active Stock</p>
            <p class="text-3xl font-black text-gray-900">${activeCount}</p>
        </div>
        <div class="bg-indigo-600 p-6 rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all group border border-indigo-500">
            <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-white/20 text-white rounded-xl">
                    <i class="fas fa-boxes-stacked text-xl"></i>
                </div>
            </div>
            <p class="text-sm text-indigo-100 font-bold uppercase tracking-wider mb-1">Total Items</p>
            <p class="text-3xl font-black text-white">${totalCount}</p>
        </div>
    `;

    const distribution = document.getElementById('status-distribution');
    const getWidth = (count) => totalCount > 0 ? (count / totalCount) * 100 : 0;
    
    distribution.innerHTML = `
        <div class="space-y-2">
            <div class="flex justify-between text-xs font-bold text-gray-600 uppercase"><span>Active</span><span>${Math.round(getWidth(activeCount))}%</span></div>
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="bg-green-500 h-full transition-all duration-1000" style="width: ${getWidth(activeCount)}%"></div>
            </div>
        </div>
        <div class="space-y-2">
            <div class="flex justify-between text-xs font-bold text-gray-600 uppercase"><span>Expiring</span><span>${Math.round(getWidth(expiringCount))}%</span></div>
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="bg-orange-500 h-full transition-all duration-1000" style="width: ${getWidth(expiringCount)}%"></div>
            </div>
        </div>
        <div class="space-y-2">
            <div class="flex justify-between text-xs font-bold text-gray-600 uppercase"><span>Expired</span><span>${Math.round(getWidth(expiredCount))}%</span></div>
            <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="bg-red-500 h-full transition-all duration-1000" style="width: ${getWidth(expiredCount)}%"></div>
            </div>
        </div>
    `;

    // Return Type Summary
    const rtSummary = document.getElementById('return-type-summary');
    if (rtSummary) {
        const rt = items.reduce((acc, curr) => {
            const type = curr.returnType?.toLowerCase() || '';
            if (type.includes('non-returnable')) acc.nr++;
            else if (type.includes('returnable')) acc.ret++;
            else if (type.includes('transfer')) acc.tr++;
            else acc.other++;
            return acc;
        }, { nr: 0, ret: 0, tr: 0, other: 0 });

        const getRtWidth = (count) => totalCount > 0 ? (count / totalCount) * 100 : 0;

        rtSummary.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-black text-[10px] border border-red-100">NR</div>
                <div class="flex-1">
                    <div class="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-1">
                        <span>Non-Returnable</span>
                        <span>${rt.nr}</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-red-500 h-full transition-all duration-1000" style="width: ${getRtWidth(rt.nr)}%"></div>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-black text-[10px] border border-green-100">Ret</div>
                <div class="flex-1">
                    <div class="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-1">
                        <span>Returnable</span>
                        <span>${rt.ret}</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-green-500 h-full transition-all duration-1000" style="width: ${getRtWidth(rt.ret)}%"></div>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[10px] border border-blue-100">TR</div>
                <div class="flex-1">
                    <div class="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-1">
                        <span>Transfer</span>
                        <span>${rt.tr}</span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-blue-500 h-full transition-all duration-1000" style="width: ${getRtWidth(rt.tr)}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    const list = document.getElementById('expiring-soon-list');
    const expiringItems = items.filter(i => i.status === 'Expiring').slice(0, 3);

    if (expiringItems.length === 0) {
        list.innerHTML = `<div class="py-8 text-center text-gray-400 italic text-sm">No items expiring soon.</div>`;
    } else {
        list.innerHTML = expiringItems.map(i => {
            const diffDays = Math.ceil((new Date(i.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
            return `
                <div class="flex justify-between items-center p-4 bg-gray-50/50 hover:bg-orange-50 rounded-xl border border-transparent hover:border-orange-100 transition-all group">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-orange-500 shadow-sm">
                            <i class="fas fa-box-open"></i>
                        </div>
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-800 group-hover:text-orange-900 transition-colors">${i.description}</span>
                            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${i.category} • ${i.itemCode}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs font-black text-orange-600 uppercase tracking-tighter">${i.expiryDate}</div>
                        <div class="text-[9px] text-gray-400 font-medium">${diffDays > 0 ? `Expires in ${diffDays} days` : 'Expires today'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 12-Month Expiration Forecast Chart
    const forecastContainer = document.getElementById('expiration-forecast');
    if (forecastContainer) {
        const forecastData = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const monthLabel = d.toLocaleString('default', { month: 'short' });
            const targetMonth = d.getMonth();
            const targetYear = d.getFullYear();

            const count = items.filter(item => {
                if (!item.expiryDate || item.isRTV) return false;
                // Split date string manually to avoid timezone/UTC parsing shifts
                const [y, m] = item.expiryDate.split('-').map(Number);
                return (m - 1) === targetMonth && y === targetYear;
            }).length;

            forecastData.push({ label: monthLabel, count, month: targetMonth, year: targetYear });
        }

        forecastContainer.innerHTML = `
            <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">12-Month Expiration Forecast</h3>
            <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                ${forecastData.map(d => `
                    <div onclick="filterByForecastMonth(${d.month}, ${d.year})" class="bg-gray-50 border border-gray-100 rounded-lg p-2 flex flex-col items-center justify-center transition-all hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer active:scale-95 shadow-sm hover:shadow-md">
                        <span class="text-[9px] font-black text-gray-400 uppercase tracking-tighter">${d.label}</span>
                        <span class="text-sm font-black ${d.count > 0 ? 'text-indigo-600' : 'text-gray-300'}">${d.count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

window.filterByForecastMonth = function(month, year) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    startDateFilter = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    endDateFilter = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    // Reset other filters for clarity so the specific items are easily found
    statusFilter = 'All';
    searchTerm = '';
    returnTypeFilter = 'All';
    listTab = 'inventory'; 
    
    showView('list');
};

// Centralized logic for processing items for the list view
function getProcessedItems() {
    // Ensure statuses are synced before filtering/sorting
    refreshItemStatuses(true); // Don't trigger a cloud save during a simple list refresh

    const filtered = items.filter(i => {
        const isRTV = i.isRTV === true;
        const matchesTab = listTab === 'inventory' ? !isRTV : isRTV;
        if (!matchesTab) return false;

        const matchesSearch = i.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (i.category && i.category.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
        
        const rt = i.returnType?.toLowerCase() || '';
        const matchesReturnType = returnTypeFilter === 'All' || 
                                (returnTypeFilter === 'NR' && rt.includes('non-returnable')) ||
                                (returnTypeFilter === 'Ret' && rt.includes('returnable') && !rt.includes('non-returnable')) ||
                                (returnTypeFilter === 'TR' && rt.includes('transfer'));

        const matchesDate = (!startDateFilter || i.expiryDate >= startDateFilter) && 
                           (!endDateFilter || i.expiryDate <= endDateFilter);
        return matchesSearch && matchesStatus && matchesReturnType && matchesDate;
    });

    return filtered.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (sortColumn === 'qty') { valA = Number(valA); valB = Number(valB); }
        else if (sortColumn === 'expiryDate') { valA = new Date(valA || 0).getTime(); valB = new Date(valB || 0).getTime(); }
        else { valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase(); }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderList() {
    const listContainer = document.getElementById('view-list');
    const filteredItems = getProcessedItems();

    const activeCount = items.filter(i => !i.isRTV).length;
    const rtvCount = items.filter(i => i.isRTV).length;

    // Store current search focus and cursor position before re-rendering
    const searchInput = document.getElementById('inventory-search');
    const isSearchFocused = document.activeElement === searchInput;
    const selectionStart = searchInput ? searchInput.selectionStart : 0;
    const selectionEnd = searchInput ? searchInput.selectionEnd : 0;
    
    const isMobile = window.innerWidth < 768;

    // Pagination logic
    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const paginatedItems = filteredItems.slice(startIdx, endIdx);

    const getSortIcon = (col) => {
        if (sortColumn !== col) return '<i class="fas fa-sort ml-1 opacity-20 text-xs"></i>';
        return sortDirection === 'asc' ? '<i class="fas fa-sort-up ml-1 text-indigo-600 text-xs"></i>' : '<i class="fas fa-sort-down ml-1 text-indigo-600 text-xs"></i>';
    };

    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(i => selectedItemIds.has(i.id));

    listContainer.innerHTML = `
        <!-- Segmented Control Tabs -->
        <div class="flex items-center gap-1 bg-gray-200/40 p-1.5 rounded-2xl mb-6 w-full md:w-fit border border-gray-100 shadow-inner">
            <button onclick="switchListTab('inventory')" class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${listTab === 'inventory' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}">
                <i class="fas fa-boxes-stacked ${listTab === 'inventory' ? 'text-indigo-500' : 'text-gray-400'}"></i>
                <span>Active Stock <span class="opacity-50 ml-1">(${activeCount})</span></span>
            </button>
            <button onclick="switchListTab('rtv')" class="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${listTab === 'rtv' ? 'bg-white text-indigo-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}">
                <i class="fas fa-history ${listTab === 'rtv' ? 'text-indigo-500' : 'text-gray-400'}"></i>
                <span>RTV History <span class="opacity-50 ml-1">(${rtvCount})</span></span>
            </button>
        </div>

        <div class="flex flex-col gap-4 mb-6">
            <div class="flex justify-between items-center">
                <h3 class="text-xl font-black text-gray-900">${listTab === 'inventory' ? 'Inventory' : 'RTV History Logs'}</h3>
                ${selectedItemIds.size > 0 ? `
                    <div class="flex gap-2">
                        ${listTab === 'inventory' ? `
                            <button onclick="bulkRTV()" class="bg-amber-50 border border-amber-200 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition whitespace-nowrap animate-fadeIn">
                                <i class="fas fa-truck-ramp-box mr-1"></i> RTV ${selectedItemIds.size}
                            </button>
                        ` : ''}
                        <button onclick="bulkDelete()" class="bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition whitespace-nowrap animate-fadeIn">
                            <i class="fas fa-trash-alt mr-1"></i> Delete ${selectedItemIds.size}
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- Search and Filter Controls -->
            <div class="flex flex-col md:flex-row gap-3">
                <!-- Search Bar -->
                <div class="relative flex-1">
                    <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="inventory-search" placeholder="Search code, name, or category..." 
                        value="${searchTerm}" 
                        oninput="handleSearch(this.value)"
                        class="w-full pl-11 pr-4 py-3 md:py-2 border border-gray-200 rounded-xl md:rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm md:shadow-none">
                </div>

                <!-- Filter Bar -->
                <div class="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                    <select onchange="handleStatusFilter(this.value)" class="flex-1 md:flex-none px-4 py-3 md:py-2 border border-gray-200 rounded-xl md:rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 cursor-pointer transition shadow-sm md:shadow-none min-w-[120px]">
                        <option value="All" ${statusFilter === 'All' ? 'selected' : ''}>All Status</option>
                        <option value="Active" ${statusFilter === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Expiring" ${statusFilter === 'Expiring' ? 'selected' : ''}>Expiring</option>
                        <option value="Expired" ${statusFilter === 'Expired' ? 'selected' : ''}>Expired</option>
                    </select>

                    <select onchange="handleReturnTypeFilter(this.value)" class="flex-1 md:flex-none px-4 py-3 md:py-2 border border-gray-200 rounded-xl md:rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-700 cursor-pointer transition shadow-sm md:shadow-none min-w-[120px]">
                        <option value="All" ${returnTypeFilter === 'All' ? 'selected' : ''}>All Types</option>
                        <option value="NR" ${returnTypeFilter === 'NR' ? 'selected' : ''}>NR (Non-Ret)</option>
                        <option value="Ret" ${returnTypeFilter === 'Ret' ? 'selected' : ''}>Ret (Returnable)</option>
                        <option value="TR" ${returnTypeFilter === 'TR' ? 'selected' : ''}>TR (Transfer)</option>
                    </select>

                    <div class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl md:rounded-lg px-3 shadow-sm md:shadow-none flex-1 md:flex-none">
                        <i class="fas fa-calendar-alt text-indigo-500 text-xs"></i>
                        <div class="flex items-center gap-1">
                            <input type="date" value="${startDateFilter}" onchange="handleDateFilter('start', this.value)" class="bg-transparent text-[11px] font-bold text-gray-600 outline-none py-2 cursor-pointer w-[90px]" title="Start Date">
                            <span class="text-gray-300 text-[10px] font-black mx-1">/</span>
                            <input type="date" value="${endDateFilter}" onchange="handleDateFilter('end', this.value)" class="bg-transparent text-[11px] font-bold text-gray-600 outline-none py-2 cursor-pointer w-[90px]" title="End Date">
                        </div>
                        ${(startDateFilter || endDateFilter) ? `
                            <button onclick="handleDateFilter('clear')" class="text-red-400 hover:text-red-600 transition-colors ml-1 p-1">
                                <i class="fas fa-times-circle"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100">
            ${!isMobile ? `
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="border-b border-gray-100">
                        <tr>
                            <th class="px-4 py-2 w-12 text-center sticky top-0 bg-gray-50 z-10 rounded-tl-xl">
                                <input type="checkbox" onchange="toggleSelectAll(this.checked)" 
                                    ${allFilteredSelected ? 'checked' : ''}
                                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                            </th>
                            <th onclick="handleSort('location')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Location ${getSortIcon('location')}</th>
                            <th onclick="handleSort('itemCode')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Item Code ${getSortIcon('itemCode')}</th>
                            <th onclick="handleSort('description')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Description ${getSortIcon('description')}</th>
                            <th onclick="handleSort('category')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Category ${getSortIcon('category')}</th>
                            <th onclick="handleSort('qty')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Qty ${getSortIcon('qty')}</th>
                            <th onclick="handleSort('expiryDate')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Expiry Date ${getSortIcon('expiryDate')}</th>
                            <th onclick="handleSort('status')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Status ${getSortIcon('status')}</th>
                            <th onclick="handleSort('returnType')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Return Type ${getSortIcon('returnType')}</th>
                            <th onclick="handleSort('supplierName')" class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 bg-gray-50 z-10">Supplier ${getSortIcon('supplierName')}</th>
                            <th class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider sticky top-0 bg-gray-50 z-10">Transaction History</th>
                            <th class="px-4 py-2 text-xs font-extrabold text-gray-900 uppercase tracking-wider text-center sticky top-0 bg-gray-50 z-10 rounded-tr-xl">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        ${paginatedItems.length > 0 ? paginatedItems.map((i, pIndex) => {
                            const gIndex = startIdx + pIndex;
                            return `
                            <tr id="row-${gIndex}" onclick="setFocus(${gIndex}, ${i.id}, event)" ondblclick="openEditModal(${i.id})" class="transition-colors cursor-pointer ${focusedIndex === gIndex ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500' : 'hover:bg-gray-50/50'}">
                                <td class="px-4 py-1.5 text-center">
                                    <input type="checkbox" onchange="toggleSelectItem(${i.id})" 
                                        ${selectedItemIds.has(i.id) ? 'checked' : ''}
                                        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                                </td>
                                <td class="px-4 py-1.5 text-sm text-gray-600 font-medium">${i.location}</td>
                                <td class="px-4 py-1.5 text-sm font-mono text-indigo-600 font-bold">${i.itemCode}</td>
                                <td class="px-4 py-1.5 text-sm text-gray-800">${i.description}</td>
                                <td class="px-4 py-1.5 text-sm text-gray-500">${i.category}</td>
                                <td class="px-4 py-1.5 text-sm text-gray-700 font-semibold">
                                    <button onclick="openQtyCalc(${i.id})" class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg border border-gray-100 transition-all group">
                                        <span class="w-6 text-center font-bold">${i.qty}</span>
                                        <i class="fas fa-calculator text-[10px] text-gray-300 group-hover:text-indigo-400"></i>
                                    </button>
                                </td>
                                <td class="px-4 py-1.5 text-sm text-gray-500">${i.expiryDate}</td>
                                <td class="px-4 py-1.5">
                                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                        i.status === 'Expired' ? 'bg-red-100 text-red-700' : 
                                        i.status === 'Expiring' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                    }">${i.status}</span>
                                </td>
                                <td class="px-4 py-1.5 text-sm text-gray-500">${i.returnType || 'N/A'}</td>
                                <td class="px-4 py-1.5 text-sm text-gray-500">${i.supplierName || 'N/A'}</td>
                                <td class="px-4 py-1.5 text-[11px] text-gray-400 italic max-w-[150px] truncate">${i.history}</td>
                                <td class="px-4 py-1.5 text-center">
                                    <div class="flex justify-center gap-2">
                                        <button onclick="openEditModal(${i.id})" class="p-1 text-gray-400 hover:text-indigo-600 transition"><i class="fas fa-edit"></i></button>
                                        ${listTab === 'inventory' ? `<button onclick="handleRTV(${i.id})" class="p-1 text-gray-400 hover:text-amber-600 transition" title="Return to Vendor"><i class="fas fa-truck-ramp-box"></i></button>` : ''}
                                        <button onclick="deleteItem(${i.id})" class="p-1 text-gray-400 hover:text-red-600 transition"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `; }).join('') : `
                            <tr>
                                <td colspan="13" class="px-4 py-12 text-center text-gray-400 italic">No items found matching your search.</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>` : `
            <div class="divide-y divide-gray-100">
                ${paginatedItems.map((i, pIndex) => `
                    <div class="p-4 flex flex-col gap-3 active:bg-gray-50 transition ${selectedItemIds.has(i.id) ? 'bg-indigo-50/70 border-l-4 border-indigo-600 shadow-sm' : ''}" onclick="setFocus(${startIdx + pIndex}, ${i.id}, event)">
                        <div class="flex justify-between items-start">
                            <div class="flex items-center gap-3">
                                <div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedItemIds.has(i.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 bg-white'}">
                                    ${selectedItemIds.has(i.id) ? '<i class="fas fa-check text-[10px]"></i>' : ''}
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-xs font-mono text-indigo-600 font-bold">${i.itemCode}</span>
                                    <span class="font-bold text-gray-800">${i.description}</span>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                i.status === 'Expired' ? 'bg-red-100 text-red-700' : 
                                i.status === 'Expiring' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                            }">${i.status}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs text-gray-500">
                            <div class="flex items-center gap-2">
                                <span><i class="fas fa-map-marker-alt mr-1"></i> ${i.location}</span>
                                ${(() => {
                                    const rt = i.returnType?.toLowerCase() || '';
                                    const isNR = rt.includes('non-returnable');
                                    const isRet = rt.includes('returnable');
                                    const isTR = rt.includes('transfer');
                                    const badgeText = isNR ? 'NR' : isRet ? 'Ret' : isTR ? 'TR' : (i.returnType?.substring(0, 2).toUpperCase() || '--');
                                    const colorClass = isNR ? 'bg-red-50 text-red-600 border-red-100' : 
                                                       isRet ? 'bg-green-50 text-green-600 border-green-100' : 
                                                       isTR ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-100 text-gray-500 border-gray-200';
                                    return `<span class="${colorClass} px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-tighter" title="${i.returnType || 'No Type'}">${badgeText}</span>`;
                                })()}
                            </div>
                            <span class="font-bold text-gray-700">Exp: ${i.expiryDate}</span>
                        </div>
                        <div class="flex justify-between items-center pt-2">
                            <button onclick="openQtyCalc(${i.id})" class="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-sm">
                                Qty: ${i.qty} <i class="fas fa-calculator ml-2 opacity-50"></i>
                            </button>
                            <div class="flex gap-4">
                                <button onclick="openEditModal(${i.id})" class="text-gray-400 p-2"><i class="fas fa-edit"></i></button>
                                ${listTab === 'inventory' ? `<button onclick="handleRTV(${i.id})" class="text-amber-500 p-2"><i class="fas fa-truck-ramp-box"></i></button>` : ''}
                                <button onclick="deleteItem(${i.id})" class="text-red-400 p-2"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>`}
            <!-- Pagination Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex items-center gap-4 text-sm text-gray-500">
                    <div class="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <select onchange="handleRowsPerPage(this.value)" class="bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-gray-700">
                            <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
                            <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100</option>
                        </select>
                    </div>
                    <span>Showing ${totalItems > 0 ? startIdx + 1 : 0} to ${Math.min(endIdx, totalItems)} of ${totalItems} items</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <i class="fas fa-chevron-left text-xs"></i>
                    </button>
                    <span class="text-sm font-semibold text-gray-700 mx-2">Page ${currentPage} of ${totalPages || 1}</span>
                    <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                        <i class="fas fa-chevron-right text-xs"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Expandable Floating Action Button (FAB) Speed Dial -->
        <div class="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-30 flex flex-col items-end gap-3">
            <!-- Sub-actions Menu -->
            <div id="fab-options" class="${fabMenuOpen ? 'flex' : 'hidden'} flex-col items-end gap-3 mb-2">
                <div class="flex items-center gap-3 animate-popIn">
                    <span class="bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest">Get Sample</span>
                    <button onclick="downloadSampleCSV(); toggleFabMenu();" class="w-12 h-12 rounded-full bg-white border border-gray-100 text-amber-600 shadow-xl flex items-center justify-center hover:bg-amber-50 transition-all active:scale-95">
                        <i class="fas fa-file-csv text-lg"></i>
                    </button>
                </div>
                <div class="flex items-center gap-3 animate-popIn" style="animation-delay: 50ms">
                    <span class="bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest">Bulk Import</span>
                    <button onclick="document.getElementById('csv-upload').click(); toggleFabMenu();" class="w-12 h-12 rounded-full bg-white border border-gray-200 text-green-600 shadow-xl flex items-center justify-center hover:bg-green-50 transition-all active:scale-95">
                        <i class="fas fa-upload text-lg"></i>
                    </button>
                </div>
                <div class="flex items-center gap-3 animate-popIn" style="animation-delay: 100ms">
                    <span class="bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-widest">Manual Add</span>
                    <button onclick="openAddModal(); toggleFabMenu();" class="w-12 h-12 rounded-full bg-white border border-gray-200 text-indigo-600 shadow-xl flex items-center justify-center hover:bg-indigo-50 transition-all active:scale-95">
                        <i class="fas fa-plus text-lg"></i>
                    </button>
                </div>
            </div>
            <!-- Main Toggle Button -->
            <button onclick="toggleFabMenu()" class="w-14 h-14 md:w-16 md:h-16 rounded-full bg-indigo-600 text-white shadow-[0_8px_30px_rgb(79,70,229,0.4)] flex items-center justify-center hover:bg-indigo-700 transition-all duration-300 active:scale-90 border-4 border-white">
                <i class="fas ${fabMenuOpen ? 'fa-times rotate-90' : 'fa-plus'} text-xl md:text-2xl transition-all duration-300"></i>
            </button>
        </div>
    `;

    // Restore search focus and cursor position if it was active
    const newSearchInput = document.getElementById('inventory-search');
    if (isSearchFocused && newSearchInput) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(selectionStart, selectionEnd);
    }

    // Auto-scroll focused row into view if navigating via keyboard
    if (focusedIndex !== -1) {
        setTimeout(() => {
            document.getElementById(`row-${focusedIndex}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 50);
    }
}

window.toggleFabMenu = function() {
    fabMenuOpen = !fabMenuOpen;
    renderList();
};

window.setFocus = function(index, id, event) {
    focusedIndex = index;
    
    // If clicking a button, the calculator, or the checkbox directly, 
    // we only update the focus and let the element's own handler run.
    const isAction = event.target.closest('button') || event.target.closest('input[type="checkbox"]');
    
    if (!isAction) {
        toggleSelectItem(id);
    } else {
        renderList();
    }
};

window.handleSearch = function(val) {
    searchTerm = val;
    currentPage = 1;
    renderList();
};

window.handleReturnTypeFilter = function(val) {
    returnTypeFilter = val;
    currentPage = 1;
    renderList();
};

// Keyboard Navigation Logic
window.addEventListener('keydown', (e) => {
    const listView = document.getElementById('view-list');
    if (listView.classList.contains('hidden')) return;

    const filtered = getProcessedItems();

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const maxIdx = filtered.length - 1;
        focusedIndex = Math.min(focusedIndex + 1, maxIdx);
        currentPage = Math.floor(focusedIndex / rowsPerPage) + 1;
        renderList();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        currentPage = Math.floor(focusedIndex / rowsPerPage) + 1;
        renderList();
    } else if (e.key === ' ') {
        // Space key toggles selection
        if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            e.preventDefault();
            toggleSelectItem(filtered[focusedIndex].id);
        }
    } else if (e.key === 'Enter') {
        // Enter key opens the edit modal for the focused item
        if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            e.preventDefault();
            openEditModal(filtered[focusedIndex].id);
        }
    }
});

window.changePage = function(page) {
    currentPage = page;
    renderList();
};

window.handleRowsPerPage = function(val) {
    rowsPerPage = parseInt(val);
    currentPage = 1;
    renderList();
};

window.handleDateFilter = function(type, val) {
    if (type === 'start') startDateFilter = val;
    if (type === 'end') endDateFilter = val;
    if (type === 'clear') {
        startDateFilter = '';
        endDateFilter = '';
    }
    currentPage = 1;
    renderList();
};

window.toggleSelectAll = function(isChecked) {
    const filteredItems = getProcessedItems();
    
    if (isChecked) {
        filteredItems.forEach(i => selectedItemIds.add(i.id));
    } else {
        filteredItems.forEach(i => selectedItemIds.delete(i.id));
    }
    renderList();
};

window.switchListTab = function(tab) {
    listTab = tab;
    currentPage = 1;
    selectedItemIds.clear(); // Clear selection when switching tabs
    renderList();
};

window.toggleSelectItem = function(id) {
    // Ensure ID is handled consistently (Number vs String)
    const targetId = typeof id === 'string' && !isNaN(id) ? Number(id) : id;
    
    if (selectedItemIds.has(targetId)) {
        selectedItemIds.delete(targetId);
    } else {
        selectedItemIds.add(targetId);
    }
    renderList();
};

window.bulkDelete = async function() {
    if (confirm(`Are you sure you want to delete ${selectedItemIds.size} selected items?`)) {
        const idsToDelete = Array.from(selectedItemIds);
        
        items = items.filter(item => !selectedItemIds.has(item.id));
        selectedItemIds.clear();
        await saveItems();

        // Explicitly remove from Cloud
        if (supabaseClient) {
            supabaseClient.from('inventory').delete().in('id', idsToDelete).then(({error}) => {
                if (error) console.error("Cloud Delete Error:", error.message);
            });
        }

        renderList();
    }
};

window.bulkRTV = async function() {
    if (selectedItemIds.size === 0) return;

    if (confirm(`Process RTV (Return to Vendor) for ${selectedItemIds.size} selected items?\nThis will move them to History while retaining their current quantity.`)) {
        const timestamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // Save current state for Undo feature
        const selectedIdsArray = Array.from(selectedItemIds);
        lastActionState = items
            .filter(i => selectedIdsArray.includes(i.id))
            .map(i => ({ id: i.id, isRTV: i.isRTV, history: i.history }));

        const processedCount = lastActionState.length;

        items = items.map(i => {
            if (selectedItemIds.has(i.id)) {
                return { 
                    ...i, 
                    isRTV: true, 
                    history: `Bulk RTV Processed (${timestamp})`
                };
            }
            return i;
        });

        selectedItemIds.clear();
        await saveItems();
        renderList();
        showUndoNotification(`Processed Bulk RTV for ${processedCount} items`);
    }
};

window.openAddModal = function() {
    document.getElementById('add-form').reset();
    document.getElementById('add-modal').classList.remove('hidden');
};

window.closeAddModal = function() {
    document.getElementById('add-modal').classList.add('hidden');
};

window.saveAdd = async function(e) {
    e.preventDefault();
    const expiryDate = document.getElementById('add-expiryDate').value;
    const newItem = {
        id: Math.floor(Date.now() + Math.random() * 1000),
        location: document.getElementById('add-location').value,
        itemCode: document.getElementById('add-itemCode').value,
        description: document.getElementById('add-description').value,
        qty: parseInt(document.getElementById('add-qty').value),
        expiryDate: document.getElementById('add-expiryDate').value,
        status: calculateStatus(expiryDate),
        category: document.getElementById('add-category').value,
        returnType: document.getElementById('add-returnType').value,
        supplierName: document.getElementById('add-supplierName').value,
        history: 'Initial Stock'
    };

    items.push(newItem);
    await saveItems();
    closeAddModal();
    renderList();
};

window.openQtyCalc = function(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    calcActiveItemId = id;
    calcInputValue = '0';
    document.getElementById('calc-item-name').innerText = item.description;
    document.getElementById('calc-current-qty').innerText = item.qty;
    updateCalcDisplay();
    document.getElementById('qty-calc-modal').classList.remove('hidden');
};

window.closeQtyCalc = function() {
    document.getElementById('qty-calc-modal').classList.add('hidden');
};

window.pressCalc = function(key) {
    if (key === 'C') {
        calcInputValue = '0';
    } else if (key === 'BS') {
        calcInputValue = calcInputValue.length > 1 ? calcInputValue.slice(0, -1) : '0';
    } else {
        calcInputValue = calcInputValue === '0' ? String(key) : calcInputValue + key;
    }
    updateCalcDisplay();
};

function updateCalcDisplay() {
    document.getElementById('calc-display').innerText = calcInputValue;
}

window.submitAdjustment = async function(type) {
    if (calcActiveItemId === null) return closeQtyCalc();
    
    const adjustment = parseInt(calcInputValue);
    if (adjustment === 0) return closeQtyCalc();
    
    const item = items.find(i => i.id === calcActiveItemId);
    if (!item) return closeQtyCalc();

    let newQty = item.qty;
    let actionText = '';

    if (type === 'add') {
        newQty += adjustment;
        actionText = `Added ${adjustment}`;
    } else {
        newQty = Math.max(0, item.qty - adjustment);
        actionText = `Removed ${Math.min(item.qty, adjustment)}`;
    }

    const timestamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    items = items.map(i => {
        if (i.id === calcActiveItemId) {
            return { ...i, qty: newQty, history: `${actionText} qty (${timestamp})` };
        }
        return i;
    });

    await saveItems();
    closeQtyCalc();
    renderList();
};

window.openEditModal = function(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-itemCode').value = item.itemCode;
    document.getElementById('edit-location').value = item.location;
    document.getElementById('edit-description').value = item.description;
    document.getElementById('edit-qty').value = item.qty;
    document.getElementById('edit-expiryDate').value = item.expiryDate;
    document.getElementById('edit-category').value = item.category || '';
    document.getElementById('edit-returnType').value = item.returnType || '';
    document.getElementById('edit-supplierName').value = item.supplierName || '';

    document.getElementById('edit-modal').classList.remove('hidden');
};

window.closeEditModal = function() {
    document.getElementById('edit-modal').classList.add('hidden');
};

window.saveEdit = async function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-id').value);
    const expiryDate = document.getElementById('edit-expiryDate').value;
    
    items = items.map(item => {
        if (item.id === id) {
            return {
                ...item,
                itemCode: document.getElementById('edit-itemCode').value,
                location: document.getElementById('edit-location').value,
                description: document.getElementById('edit-description').value,
                qty: parseInt(document.getElementById('edit-qty').value),
                expiryDate: document.getElementById('edit-expiryDate').value,
                status: calculateStatus(expiryDate),
                category: document.getElementById('edit-category').value,
                returnType: document.getElementById('edit-returnType').value,
                supplierName: document.getElementById('edit-supplierName').value,
                history: `Manual Update (${new Date().toLocaleDateString()})`
            };
        }
        return item;
    });

    await saveItems();
    closeEditModal();
    renderList();
};

window.handleSort = function(col) {
    if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = col;
        sortDirection = 'asc';
    }
    currentPage = 1;
    renderList();
};

window.deleteItem = async function(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        const isSyncRunning = !!autoSyncTimer;
        if (isSyncRunning) stopAutoSync(); // Pause sync so items don't jump back

        items = items.filter(item => item.id !== id);
        selectedItemIds.delete(id);
        await saveItems();

        // Explicitly remove from both potential tables in Cloud
        if (supabaseClient) {
            await supabaseClient.from('inventory').delete().eq('id', id);
            await supabaseClient.from('rtv_history').delete().eq('id', id);
        }

        if (isSyncRunning) startAutoSync(); // Resume sync
        renderList();
    }
};

window.handleRTV = async function(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (confirm(`Process RTV (Return to Vendor) for ${item.description}?\nThis will move it to History while retaining its current quantity.`)) {
        const timestamp = new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // Save current state for Undo feature
        lastActionState = [{ id: item.id, isRTV: item.isRTV, history: item.history }];

        items = items.map(i => {
            if (i.id === id) {
                return { 
                    ...i, 
                    isRTV: true, 
                    history: `RTV Processed (${timestamp})`
                };
            }
            return i;
        });

        await saveItems();
        renderList();
        showUndoNotification(`Processed RTV for ${item.description}`);
    }
};

window.undoAction = async function() {
    if (!lastActionState) return;

    items = items.map(i => {
        const prevState = lastActionState.find(s => s.id === i.id);
        if (prevState) {
            return { ...i, isRTV: prevState.isRTV, history: prevState.history };
        }
        return i;
    });

    lastActionState = null;
    hideUndoNotification();
    await saveItems();
    renderList();
};

function showUndoNotification(message) {
    let notify = document.getElementById('undo-notification');
    if (!notify) {
        notify = document.createElement('div');
        notify.id = 'undo-notification';
        notify.className = 'fixed bottom-24 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[60] bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-4 animate-popIn border border-slate-700';
        document.body.appendChild(notify);
    }
    
    notify.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <i class="fas fa-truck-ramp-box text-xs"></i>
            </div>
            <div class="flex flex-col">
                <span class="text-[11px] font-bold leading-tight line-clamp-1">${message}</span>
                <span class="text-[9px] text-slate-400 uppercase tracking-widest">Inventory updated</span>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <div class="h-6 w-px bg-slate-800"></div>
            <button onclick="undoAction()" class="text-indigo-400 hover:text-indigo-300 text-[10px] font-black uppercase tracking-widest transition-colors whitespace-nowrap">Undo Action</button>
        </div>
    `;
    
    notify.classList.remove('hidden');
    if (window.undoTimeout) clearTimeout(window.undoTimeout);
    window.undoTimeout = setTimeout(() => hideUndoNotification(), 8000);
}

window.hideUndoNotification = function() {
    const notify = document.getElementById('undo-notification');
    if (notify) notify.classList.add('hidden');
    lastActionState = null;
};

window.handleStatusFilter = function(val) {
    statusFilter = val;
    currentPage = 1;
    renderList();
};

function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading("Importing Inventory Data...");

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            if (!text.trim()) throw new Error("File is empty.");

            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length <= 1) throw new Error("File must contain a header and at least one data row.");

            const newItems = [];
            const errors = [];

            lines.slice(1).forEach((line, index) => {
                const v = line.split(',');
                if (v.length < 9) {
                    errors.push(`Line ${index + 2}: Incorrect number of columns.`);
                    return;
                }

                const qty = parseInt(v[3]);
                if (isNaN(qty)) {
                    errors.push(`Line ${index + 2}: Invalid Quantity.`);
                    return;
                }

                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                const expiryDate = v[4]?.trim();
                if (!expiryDate || !dateRegex.test(expiryDate)) {
                    errors.push(`Line ${index + 2}: Invalid Date format (Expected YYYY-MM-DD).`);
                    return;
                }

                newItems.push({
                    id: Math.floor(Date.now() + Math.random() * 1000),
                    location: v[0]?.trim() || 'N/A',
                    itemCode: v[1]?.trim() || 'N/A',
                    description: v[2]?.trim() || 'N/A',
                    qty: qty,
                    expiryDate: expiryDate,
                    status: calculateStatus(expiryDate),
                    history: v[5]?.trim() || 'Imported',
                    category: v[6]?.trim() || 'General',
                    returnType: v[7]?.trim() || '',
                    supplierName: v[8]?.trim() || ''
                });
            });

            if (errors.length > 0) {
                alert(`Import partially failed with ${errors.length} errors:\n` + errors.slice(0, 3).join('\n') + (errors.length > 3 ? '\n...' : ''));
            }

            if (newItems.length > 0) {
                items = [...items, ...newItems];
                saveItems();
                renderList();
                alert(`Successfully imported ${newItems.length} items.`);
            } else if (errors.length > 0) {
                alert("No valid items were found to import.");
            }
        } catch (error) {
            alert("CSV Upload Error: " + error.message);
        } finally {
            hideLoading();
            event.target.value = '';
        }
    };
    reader.onerror = () => { hideLoading(); alert("Failed to read file."); };
    reader.readAsText(file);
}

window.downloadSampleCSV = function() {
    showLoading("Preparing Sample File...");
    
    setTimeout(() => {
    const headers = "Location,ItemCode,Description,Qty,ExpiryDate,History,Category,ReturnType,SupplierName";
    const rows = [
        "Warehouse A,MK-001,Fresh Milk 1L,12,2025-12-01,Initial Stock,Dairy,Non-Returnable,Dairy Farms Ltd",
        "Fridge 02,EG-122,Organic Eggs 12pk,24,2025-01-15,Restocked,Dairy,Returnable,AgriCorp",
        "Bakery Shelf,BR-990,Whole Wheat Bread,5,2023-12-01,Initial Stock,Bakery,Non-Returnable,SunBake Co"
    ];
    
    const csvContent = headers + "\n" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'sample_inventory.csv');
    a.click();
        hideLoading();
    }, 800);
};

window.exportToCSV = function() {
    if (items.length === 0) {
        alert("No data available to export.");
        return;
    }

    showLoading("Generating Export Report...");

    setTimeout(() => {
    const headers = ["Location", "ItemCode", "Description", "Qty", "ExpiryDate", "History", "Category", "ReturnType", "SupplierName"];
    const rows = items.map(i => [
        i.location, 
        i.itemCode, 
        i.description, 
        i.qty, 
        i.expiryDate, 
        i.history,
        i.category || 'N/A', 
        i.returnType || 'N/A', 
        i.supplierName || 'N/A'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    
    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `freshtrack_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
        hideLoading();
    }, 1000);
};

window.exportRTVToCSV = function() {
    const rtvItems = items.filter(i => i.isRTV);
    if (rtvItems.length === 0) {
        alert("No RTV data available to export.");
        return;
    }

    showLoading("Generating RTV Export Report...");

    setTimeout(() => {
    const headers = ["Location", "ItemCode", "Description", "Qty", "ExpiryDate", "History", "Category", "ReturnType", "SupplierName"];
    const rows = rtvItems.map(i => [
        i.location, 
        i.itemCode, 
        i.description, 
        i.qty, 
        i.expiryDate, 
        i.history,
        i.category || 'N/A', 
        i.returnType || 'N/A', 
        i.supplierName || 'N/A'
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    
    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `freshtrack_rtv_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
        hideLoading();
    }, 1000);
};

window.showLoading = function(text = "Processing Data") {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay && textEl) {
        textEl.innerText = text;
        overlay.classList.remove('hidden');
    }
};

window.hideLoading = function() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
};

function renderReports() {
    const reportContainer = document.getElementById('view-reports');
    
    const liveItems = items.filter(i => !i.isRTV);
    const statusCounts = liveItems.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, { 'Active': 0, 'Expiring': 0, 'Expired': 0 });

    const categoryCounts = liveItems.reduce((acc, curr) => {
        const cat = curr.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});

    const totalQty = liveItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

    reportContainer.innerHTML = `
        <div class="flex flex-col gap-8">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 class="text-2xl font-black text-gray-900">Inventory Analytics</h3>
                    <p class="text-gray-500">Overview of stock health and categorization.</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button onclick="exportRTVToCSV()" class="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition shadow-lg shadow-amber-100 flex items-center gap-2">
                        <i class="fas fa-truck-ramp-box text-xl"></i> Export RTV History
                    </button>
                    <button onclick="exportToCSV()" class="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100 flex items-center gap-2">
                        <i class="fas fa-file-csv text-xl"></i> Export Full Report
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Stock Items</p>
                    <p class="text-3xl font-black text-gray-900">${liveItems.length}</p>
                </div>
                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Quantity</p>
                    <p class="text-3xl font-black text-indigo-600">${totalQty.toLocaleString()}</p>
                </div>
                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Categories</p>
                    <p class="text-3xl font-black text-gray-900">${Object.keys(categoryCounts).length}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                    <h3 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <i class="fas fa-chart-pie text-indigo-500"></i> Category Distribution
                    </h3>
                    <div class="space-y-6">
                        ${Object.entries(categoryCounts).map(([cat, count]) => {
                            const percentage = liveItems.length > 0 ? ((count / liveItems.length) * 100).toFixed(0) : 0;
                            return `
                            <div>
                                <div class="flex justify-between text-sm mb-2">
                                    <span class="font-bold text-gray-700">${cat}</span>
                                    <span class="font-black text-gray-900">${count} (${percentage}%)</span>
                                </div>
                                <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${percentage}%"></div>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>

                <div class="bg-slate-900 text-white p-8 rounded-2xl shadow-xl flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <i class="fas fa-lightbulb absolute -top-4 -right-4 text-slate-800 text-8xl rotate-12"></i>
                    <div class="relative z-10">
                        <i class="fas fa-magic-wand-sparkles text-4xl mb-4 text-indigo-400"></i>
                        <h3 class="text-xl font-black mb-2 uppercase tracking-tight">Smart Stock Tip</h3>
                        <p class="text-indigo-200 leading-relaxed italic">"Implementing the <span class="text-white font-bold">FEFO (First Expired, First Out)</span> system is the most effective way to reduce waste in food service environments."</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.resetApp = function() {
    if (confirm("WARNING: This will delete all current inventory items and reset the app to its original factory defaults. Continue?")) {
        items = [...SAMPLE_ITEMS]; // Restore sample data from the constant
        saveItems();
        renderSettings();
        alert("App has been reset to factory defaults.");
    }
};

window.setTheme = function(theme) {
    const body = document.body;
    if (theme === 'default') {
        body.removeAttribute('data-theme');
    } else {
        body.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme-preference', theme);
};

window.toggleAutoRefresh = function(enabled) {
    localStorage.setItem('autoRefreshEnabled', enabled);
    if (enabled) startAutoSync();
    else stopAutoSync();
};

function renderSettings() {
    const settingsContainer = document.getElementById('view-settings');

    // Calculate Browser Local Storage usage (Approximate)
    const usedBytes = JSON.stringify(localStorage).length;
    const totalBytes = 5 * 1024 * 1024; // Standard 5MB limit
    const percentUsed = ((usedBytes / totalBytes) * 100).toFixed(2);
    const usedMB = (usedBytes / (1024 * 1024)).toFixed(4);

    settingsContainer.innerHTML = `
        <div class="max-w-6xl">
            <div class="mb-8">
                <h3 class="text-2xl font-black text-gray-900">Application Settings</h3>
                <p class="text-gray-500">Manage your profile, system preferences, and data storage.</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 space-y-6">
                    <!-- Profile Card -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <i class="fas fa-user-circle text-indigo-500"></i> User Profile
                        </h4>
                        <div class="flex items-center gap-6">
                            <div id="settings-avatar" class="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-100 overflow-hidden"></div>
                            <div class="flex-1 grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Full Name</label>
                                    <p class="font-bold text-gray-800">Administrator</p>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Role</label>
                                    <p class="font-bold text-gray-800 underline decoration-indigo-500 decoration-2 underline-offset-4">System Superuser</p>
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Email Address</label>
                                    <p class="font-bold text-gray-800">admin@freshtrack.io</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- App Appearance -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <i class="fas fa-palette text-indigo-500"></i> App Appearance
                        </h4>
                        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <button onclick="setTheme('default')" class="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition group">
                                <span class="w-8 h-8 rounded-full bg-indigo-600 shadow-md ring-2 ring-white"></span>
                                <span class="text-[10px] font-bold text-gray-600 uppercase">Indigo</span>
                            </button>
                            <button onclick="setTheme('teal')" class="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-teal-50 transition group">
                                <span class="w-8 h-8 rounded-full bg-teal-500 shadow-md ring-2 ring-white"></span>
                                <span class="text-[10px] font-bold text-gray-600 uppercase">Teal</span>
                            </button>
                            <button onclick="setTheme('cream')" class="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-orange-50 transition group">
                                <span class="w-8 h-8 rounded-full bg-orange-200 shadow-md ring-2 ring-white border border-orange-300"></span>
                                <span class="text-[10px] font-bold text-gray-600 uppercase">Cream</span>
                            </button>
                            <button onclick="setTheme('pink')" class="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 hover:bg-pink-50 transition group">
                                <span class="w-8 h-8 rounded-full bg-pink-400 shadow-md ring-2 ring-white"></span>
                                <span class="text-[10px] font-bold text-gray-600 uppercase">Pink</span>
                            </button>
                            <button onclick="setTheme('dark')" class="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 bg-slate-900 transition group">
                                <span class="w-8 h-8 rounded-full bg-slate-700 shadow-md ring-2 ring-slate-800"></span>
                                <span class="text-[10px] font-bold text-slate-400 uppercase">Dark</span>
                            </button>
                        </div>
                    </div>

                    <!-- System Preferences -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <i class="fas fa-sliders text-indigo-500"></i> Preferences
                        </h4>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                                <div>
                                    <p class="font-bold text-gray-800 text-sm">Real-time Dashboard Updates</p>
                                    <p class="text-xs text-gray-500">Refresh statistics every 2 seconds automatically.</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="pref-auto-refresh" onchange="toggleAutoRefresh(this.checked)" 
                                        ${localStorage.getItem('autoRefreshEnabled') !== 'false' ? 'checked' : ''} 
                                        class="sr-only peer">
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                                <div>
                                    <p class="font-bold text-gray-800 text-sm">Low Stock Alerts</p>
                                    <p class="text-xs text-gray-500">Notify when an item quantity drops below 5 units.</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" class="sr-only peer">
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <!-- About Us Card -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <i class="fas fa-info-circle text-indigo-500"></i> About Us
                        </h4>
                        <div class="space-y-3">
                            <p class="text-xs text-gray-600 leading-relaxed">
                                FreshTrack is an intelligent inventory monitoring system developed to ensure product freshness and operational efficiency.
                            </p>
                            <div class="pt-3 border-t border-gray-50">
                                <p class="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Developer Credit</p>
                                <p class="text-sm font-bold text-gray-800">Initiative by Jaime Hutalla</p>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <i class="fas fa-database text-indigo-500"></i> System Data
                        </h4>
                        <div class="space-y-6">
                            <div>
                                <div class="flex justify-between items-end mb-2">
                                    <span class="text-xs font-bold text-gray-700">Storage Usage</span>
                                    <span class="text-xs font-black text-indigo-600">${percentUsed}%</span>
                                </div>
                                <div class="w-full bg-gray-100 rounded-full h-2">
                                    <div class="bg-indigo-600 h-full rounded-full" style="width: ${percentUsed}%"></div>
                                </div>
                                <p class="text-[10px] text-gray-400 mt-2 font-bold uppercase">${usedMB} MB used of 5.00 MB</p>
                            </div>
                            
                            <div class="pt-4 border-t border-gray-50 space-y-3">
                                <button onclick="alert('System cache cleared.')" class="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-black uppercase tracking-widest transition border border-gray-100">
                                    Clear Cache
                                </button>
                                <button onclick="resetApp()" class="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest transition border border-red-50">
                                    Factory Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="p-2 bg-indigo-500 rounded-lg text-white">
                                <i class="fas fa-shield-halved"></i>
                            </div>
                            <span class="text-white font-black uppercase tracking-widest text-xs">FreshTrack v2.4.0</span>
                        </div>
                        <p class="text-slate-400 text-xs leading-relaxed">
                            Your data is stored locally. To prevent data loss, perform a <span class="text-indigo-400 font-bold">Bulk Export</span> from the Reports tab regularly.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Sync the avatar UI after rendering the settings content
    const currentUsername = localStorage.getItem('ft_username') || DEFAULT_USER;
    updateUIWithUser(currentUsername);
}

// Account Management Functions
window.openAccountModal = function() {
    const currentUsername = localStorage.getItem('ft_username') || 'admin@example.com';
    document.getElementById('acc-username').value = currentUsername;
    document.getElementById('acc-password').value = '';
    document.getElementById('account-modal').classList.remove('hidden');
};

window.closeAccountModal = function() {
    document.getElementById('account-modal').classList.add('hidden');
};

window.saveAccountChanges = async function(e) {
    e.preventDefault();
    const newUsername = document.getElementById('acc-username').value;
    const newPassword = document.getElementById('acc-password').value;
    const avatarFile = document.getElementById('acc-avatar-upload').files[0];

    localStorage.setItem('ft_username', newUsername);
    if (newPassword) {
        localStorage.setItem('ft_password', newPassword);
    }

    showLoading("Syncing Profile...");

    let avatarBase64 = localStorage.getItem('ft_avatar');

    if (avatarFile) {
        const reader = new FileReader();
        reader.onload = async function(event) {
            avatarBase64 = event.target.result;
            localStorage.setItem('ft_avatar', avatarBase64);
            await syncProfileToCloud(newUsername, newPassword, avatarBase64);
        };
        reader.readAsDataURL(avatarFile);
    } else {
        await syncProfileToCloud(newUsername, newPassword, avatarBase64);
    }
};

async function syncProfileToCloud(username, password, avatar) {
    if (supabaseClient) {
        const updates = { id: 'admin_account', username };
        if (password) updates.password = password;
        if (avatar) updates.avatar = avatar;

        const { error } = await supabaseClient
            .from('profiles')
            .upsert(updates);
        
        if (error) console.error("Profile Sync Error:", error.message);
    }
    updateUIWithUser(username);
    hideLoading();
    closeAccountModal();
    alert('Account updated and synced to cloud!');
}

function updateUIWithUser(username) {
    const display = username.split('@')[0];
    document.getElementById('header-username-display').innerText = display.charAt(0).toUpperCase() + display.slice(1);
    
    const savedAvatar = localStorage.getItem('ft_avatar');

    // Update Header Avatar
    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar) {
        if (savedAvatar) {
            headerAvatar.innerHTML = `<img src="${savedAvatar}" class="w-full h-full rounded-full object-cover">`;
            headerAvatar.classList.remove('bg-slate-800', 'text-green-400', 'border-slate-700', 'shadow-inner');
            headerAvatar.classList.add('p-1', 'bg-white'); // Add padding and white background for image
        } else {
            headerAvatar.innerHTML = `<i class="fas fa-leaf text-sm"></i>`;
            headerAvatar.classList.add('bg-slate-800', 'text-green-400', 'border-slate-700', 'shadow-inner');
            headerAvatar.classList.remove('p-1', 'bg-white');
        }
    }

    // Update Settings Avatar
    const settingsAvatar = document.getElementById('settings-avatar');
    if (settingsAvatar) {
        if (savedAvatar) {
            settingsAvatar.innerHTML = `<img src="${savedAvatar}" class="w-full h-full rounded-full object-cover">`;
            settingsAvatar.classList.remove('bg-indigo-600', 'text-white', 'text-3xl', 'font-black', 'shadow-lg', 'shadow-indigo-100');
            settingsAvatar.classList.add('p-1', 'bg-white'); // Add padding and white background for image
        } else {
            // Restore the leaf icon for the settings profile
            settingsAvatar.innerHTML = `<i class="fas fa-leaf text-3xl"></i>`; 
            settingsAvatar.classList.add('bg-indigo-600', 'text-white', 'text-3xl', 'font-black', 'shadow-lg', 'shadow-indigo-100');
            settingsAvatar.classList.remove('p-1', 'bg-white');
        }
    }
}

// Session Management
function startInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (localStorage.getItem('isLoggedIn') !== 'true') return;

    inactivityTimer = setTimeout(() => {
        alert('Session expired due to 30 minutes of inactivity. Please log in again.');
        logout();
    }, INACTIVITY_LIMIT);
}

window.resetInactivityTimer = function() {
    startInactivityTimer();
};

// Sidebar Management
window.toggleSidebar = function() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (window.innerWidth < 768) {
        const isOpen = sidebar.classList.contains('translate-x-0');
        if (isOpen) {
            closeSidebarMobile();
        } else {
            sidebar.classList.replace('-translate-x-full', 'translate-x-0');
            overlay.classList.remove('hidden');
        }
    } else {
        sidebar.classList.toggle('sidebar-collapsed');
        const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    }
};

function closeSidebarMobile() {
    document.getElementById('main-sidebar').classList.replace('translate-x-0', '-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
}

// Real-time Clock Logic
function startClock() {
    const container = document.getElementById('realtime-clock');
    container.innerHTML = `
        <div class="flex items-center gap-2 text-gray-500">
            <i class="fa-regular fa-calendar-days text-indigo-500 text-xs"></i>
            <span id="date-display" class="text-xs font-bold uppercase tracking-wider"></span>
        </div>
        <div class="w-px h-4 bg-gray-200 mx-1"></div>
        <div class="flex items-center gap-2 text-indigo-900">
            <i class="fa-regular fa-clock text-indigo-400 text-xs"></i>
            <span id="time-display" class="text-sm font-black tabular-nums"></span>
        </div>
    `;

    const dateEl = document.getElementById('date-display');
    const timeEl = document.getElementById('time-display');

    function update() {
        const now = new Date();
        dateEl.innerText = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        timeEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    update();
    setInterval(update, 1000);
}

// Initialization Logic: Check if user was logged in and which view they were on
function init() {
    startClock();
    const savedTheme = localStorage.getItem('theme-preference') || 'default';
    setTheme(savedTheme);

    // Load current username info
    const currentUsername = localStorage.getItem('ft_username') || 'admin@example.com';
    updateUIWithUser(currentUsername);

    // Load inventory data and start background sync
    fetchCloudData();

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed', err));
    }

    // Setup Activity Listeners
    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
        window.addEventListener(event, resetInactivityTimer);
    });

    // Restore sidebar state
    const isSidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isSidebarCollapsed) {
        document.getElementById('main-sidebar').classList.add('sidebar-collapsed');
    }

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        startInactivityTimer();
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-layout').classList.remove('hidden');
        const savedView = localStorage.getItem('currentView') || 'dashboard';
        showView(savedView);
    }
}

init();
