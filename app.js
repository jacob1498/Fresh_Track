// Define the original sample data as a constant
const SAMPLE_ITEMS = [
    { id: 1, location: 'Warehouse A', itemCode: 'MK-001', description: 'Milk 1L', qty: 12, expiryDate: '2023-10-01', status: 'Expired', history: 'Initial Stock', category: 'Dairy', returnType: 'Non-Returnable', supplierName: 'Dairy Farms Ltd' },
    { id: 2, location: 'Fridge 02', itemCode: 'EG-122', description: 'Eggs 12pk', qty: 24, expiryDate: '2023-12-15', status: 'Active', history: 'Restocked', category: 'Dairy', returnType: 'Returnable', supplierName: 'AgriCorp' },
    { id: 3, location: 'Bakery Shelf', itemCode: 'BR-990', description: 'Whole Wheat Bread', qty: 5, expiryDate: '2023-10-25', status: 'Expiring', history: 'Initial Stock', category: 'Bakery', returnType: 'Non-Returnable', supplierName: 'SunBake Co' },
    { id: 4, location: 'Produce Aisle', itemCode: 'AP-552', description: 'Red Apples 1kg', qty: 50, expiryDate: '2023-11-05', status: 'Active', history: 'New Shipment', category: 'Produce', returnType: 'Returnable', supplierName: 'FreshProduce Inc' },
    { id: 5, location: 'Freezer 01', itemCode: 'CH-221', description: 'Chicken Breast 500g', qty: 15, expiryDate: '2023-10-20', status: 'Expiring', history: 'Manual Update', category: 'Meat', returnType: 'Non-Returnable', supplierName: 'MeatMaster' }
];

// Mock Data
let items = [];

// Global Search and Filter State
let searchTerm = '';
let statusFilter = 'All';
let sortColumn = 'expiryDate';
let sortDirection = 'asc';
let selectedItemIds = new Set();
let focusedIndex = -1;
let currentPage = 1;
let rowsPerPage = 25;

let calcActiveItemId = null;
let calcInputValue = '0';

// Authentication Logic
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = e.target.querySelector('input[type="email"]').value;
    const passwordInput = e.target.querySelector('input[type="password"]').value;
    
    const storedUser = localStorage.getItem('ft_username') || 'admin@example.com';
    const storedPass = localStorage.getItem('ft_password') || 'admin123';

    if (emailInput === storedUser && passwordInput === storedPass) {
        localStorage.setItem('isLoggedIn', 'true');
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-layout').classList.remove('hidden');
        showView('dashboard');
    } else {
        alert('Invalid credentials. Please try again.');
    }
});

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentView');
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('main-layout').classList.add('hidden');
}

// Navigation Logic
function showView(viewId) {
    // Update UI headers
    document.getElementById('view-title').innerText = viewId.charAt(0).toUpperCase() + viewId.slice(1);
    
    if (viewId === 'list') {
        focusedIndex = -1;
        currentPage = 1;
    }

    // Persist current view
    localStorage.setItem('currentView', viewId);
    
    // Hide all views
    document.querySelectorAll('.view-content').forEach(view => view.classList.add('hidden'));
    
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
}

function renderDashboard() {
    const expiredCount = items.filter(i => i.status === 'Expired').length;
    const expiringCount = items.filter(i => i.status === 'Expiring').length;
    const activeCount = items.filter(i => i.status === 'Active').length;
    const totalCount = items.length;

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

    const list = document.getElementById('expiring-soon-list');
    const expiringItems = items.filter(i => i.status === 'Expiring').slice(0, 5);

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
}

// Centralized logic for processing items for the list view
function getProcessedItems() {
    const filtered = items.filter(i => {
        const matchesSearch = i.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (i.category && i.category.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
        return matchesSearch && matchesStatus;
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
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h3 class="text-xl font-black text-gray-900">Inventory Management</h3>
            <div class="flex flex-1 w-full md:w-auto gap-3">
                ${selectedItemIds.size > 0 ? `
                    <div class="flex gap-2">
                        <select onchange="bulkUpdateStatus(this.value)" class="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 transition cursor-pointer">
                            <option value="" disabled selected>Update Status (${selectedItemIds.size})</option>
                            <option value="Active">Mark as Active</option>
                            <option value="Expiring">Mark as Expiring</option>
                            <option value="Expired">Mark as Expired</option>
                        </select>
                        <button onclick="bulkDelete()" class="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition whitespace-nowrap" title="Delete Selected">
                            <i class="fas fa-trash-alt mr-1"></i> Delete
                        </button>
                    </div>
                ` : ''}
                <div class="relative flex-1 md:w-64">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="inventory-search" placeholder="Search by code or description..." 
                        value="${searchTerm}" 
                        oninput="handleSearch(this.value)"
                        class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition">
                </div>
                <select onchange="handleStatusFilter(this.value)" class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-600 cursor-pointer transition shadow-sm">
                    <option value="All" ${statusFilter === 'All' ? 'selected' : ''}>All Status</option>
                    <option value="Active" ${statusFilter === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Expiring" ${statusFilter === 'Expiring' ? 'selected' : ''}>Expiring</option>
                    <option value="Expired" ${statusFilter === 'Expired' ? 'selected' : ''}>Expired</option>
                </select>
                <div class="flex gap-2">
                    <input type="file" id="csv-upload" class="hidden" accept=".csv" onchange="handleUpload(event)">
                    <button onclick="document.getElementById('csv-upload').click()" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition flex items-center gap-2">
                        <i class="fas fa-upload"></i> Bulk Upload
                    </button>
                    <button onclick="downloadSampleCSV()" class="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline transition self-center px-1">
                        Get Sample CSV
                    </button>
                    <button onclick="openAddModal()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">+ Add Item</button>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100">
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
            </div>
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
    `;

    // Auto-scroll focused row into view
    if (focusedIndex !== -1) {
        setTimeout(() => {
            document.getElementById(`row-${focusedIndex}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 50);
    }
}

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
    // Maintain focus and cursor position
    const input = document.getElementById('inventory-search');
    if (input) {
        input.focus();
        input.setSelectionRange(val.length, val.length);
    }
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

window.toggleSelectAll = function(isChecked) {
    const filteredItems = items.filter(i => {
        const matchesSearch = i.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             i.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (isChecked) {
        filteredItems.forEach(i => selectedItemIds.add(i.id));
    } else {
        filteredItems.forEach(i => selectedItemIds.delete(i.id));
    }
    renderList();
};

window.toggleSelectItem = function(id) {
    if (selectedItemIds.has(id)) {
        selectedItemIds.delete(id);
    } else {
        selectedItemIds.add(id);
    }
    renderList();
};

window.bulkDelete = function() {
    if (confirm(`Are you sure you want to delete ${selectedItemIds.size} selected items?`)) {
        items = items.filter(item => !selectedItemIds.has(item.id));
        selectedItemIds.clear();
        renderList();
    }
};

window.bulkUpdateStatus = function(newStatus) {
    if (!newStatus) return;
    if (confirm(`Update status to "${newStatus}" for ${selectedItemIds.size} selected items?`)) {
        items = items.map(item => {
            if (selectedItemIds.has(item.id)) {
                return { ...item, status: newStatus };
            }
            return item;
        });
        selectedItemIds.clear();
        renderList();
    }
};

window.openAddModal = function() {
    document.getElementById('add-form').reset();
    document.getElementById('add-modal').classList.remove('hidden');
};

window.closeAddModal = function() {
    document.getElementById('add-modal').classList.add('hidden');
};

window.saveAdd = function(e) {
    e.preventDefault();
    const newItem = {
        id: Date.now() + Math.random(),
        location: document.getElementById('add-location').value,
        itemCode: document.getElementById('add-itemCode').value,
        description: document.getElementById('add-description').value,
        qty: parseInt(document.getElementById('add-qty').value),
        expiryDate: document.getElementById('add-expiryDate').value,
        status: document.getElementById('add-status').value,
        category: document.getElementById('add-category').value,
        returnType: document.getElementById('add-returnType').value,
        supplierName: document.getElementById('add-supplierName').value,
        history: 'Initial Stock'
    };

    items.push(newItem);
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

window.submitAdjustment = function(type) {
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
    document.getElementById('edit-status').value = item.status;
    document.getElementById('edit-category').value = item.category || '';
    document.getElementById('edit-returnType').value = item.returnType || '';
    document.getElementById('edit-supplierName').value = item.supplierName || '';

    document.getElementById('edit-modal').classList.remove('hidden');
};

window.closeEditModal = function() {
    document.getElementById('edit-modal').classList.add('hidden');
};

window.saveEdit = function(e) {
    e.preventDefault();
    const id = parseFloat(document.getElementById('edit-id').value);
    
    items = items.map(item => {
        if (item.id === id) {
            return {
                ...item,
                itemCode: document.getElementById('edit-itemCode').value,
                location: document.getElementById('edit-location').value,
                description: document.getElementById('edit-description').value,
                qty: parseInt(document.getElementById('edit-qty').value),
                expiryDate: document.getElementById('edit-expiryDate').value,
                status: document.getElementById('edit-status').value,
                category: document.getElementById('edit-category').value,
                returnType: document.getElementById('edit-returnType').value,
                supplierName: document.getElementById('edit-supplierName').value,
                history: `Manual Update (${new Date().toLocaleDateString()})`
            };
        }
        return item;
    });

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

window.deleteItem = function(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        items = items.filter(item => item.id !== id);
        selectedItemIds.delete(id);
        renderList();
    }
};

window.handleStatusFilter = function(val) {
    statusFilter = val;
    currentPage = 1;
    renderList();
};

function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

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
                if (v.length < 10) {
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
                    id: Date.now() + Math.random(),
                    location: v[0]?.trim() || 'N/A',
                    itemCode: v[1]?.trim() || 'N/A',
                    description: v[2]?.trim() || 'N/A',
                    qty: qty,
                    expiryDate: expiryDate,
                    status: v[5]?.trim() || 'Active',
                    history: v[6]?.trim() || 'Imported',
                    category: v[7]?.trim() || 'General',
                    returnType: v[8]?.trim() || '',
                    supplierName: v[9]?.trim() || ''
                });
            });

            if (errors.length > 0) {
                alert(`Import partially failed with ${errors.length} errors:\n` + errors.slice(0, 3).join('\n') + (errors.length > 3 ? '\n...' : ''));
            }

            if (newItems.length > 0) {
                items = [...items, ...newItems];
                renderList();
                alert(`Successfully imported ${newItems.length} items.`);
            } else if (errors.length > 0) {
                alert("No valid items were found to import.");
            }
        } catch (error) {
            alert("CSV Upload Error: " + error.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.onerror = () => alert("Failed to read file.");
    reader.readAsText(file);
}

window.downloadSampleCSV = function() {
    const csvContent = "Location,ItemCode,Description,Qty,ExpiryDate,Status,History,Category,ReturnType,SupplierName\n" +
                       "Warehouse B,BF-101,Beef Steak 500g,10,2023-11-20,Active,Initial Stock,Meat,Non-Returnable,MeatMaster\n" +
                       "Shelf C,JU-202,Orange Juice 2L,15,2023-10-25,Expiring,Restocked,Beverages,Returnable,AgriTrade\n" +
                       "Fridge 03,CH-303,Cheddar Cheese,8,2023-09-15,Expired,Manual Entry,Dairy,Non-Returnable,Global Foods";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'sample_inventory.csv');
    a.click();
};

window.exportToCSV = function() {
    if (items.length === 0) {
        alert("No data available to export.");
        return;
    }

    const headers = ["Location", "Item Code", "Description", "Category", "Quantity", "Expiry Date", "Status", "Supplier", "Return Type", "History"];
    const rows = items.map(i => [
        i.location, 
        i.itemCode, 
        i.description, 
        i.category || 'N/A', 
        i.qty, 
        i.expiryDate, 
        i.status, 
        i.supplierName || 'N/A', 
        i.returnType || 'N/A', 
        i.history
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
};

function renderReports() {
    const reportContainer = document.getElementById('view-reports');
    
    const statusCounts = items.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, { 'Active': 0, 'Expiring': 0, 'Expired': 0 });

    const categoryCounts = items.reduce((acc, curr) => {
        const cat = curr.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});

    const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

    reportContainer.innerHTML = `
        <div class="flex flex-col gap-8">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 class="text-2xl font-black text-gray-900">Inventory Analytics</h3>
                    <p class="text-gray-500">Overview of stock health and categorization.</p>
                </div>
                <button onclick="exportToCSV()" class="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100 flex items-center gap-2">
                    <i class="fas fa-file-csv text-xl"></i> Export Full Report
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Stock Items</p>
                    <p class="text-3xl font-black text-gray-900">${items.length}</p>
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
                            const percentage = ((count / items.length) * 100).toFixed(0);
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
                            <div class="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-100">
                                AD
                            </div>
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

                    <!-- System Preferences -->
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <i class="fas fa-sliders text-indigo-500"></i> Preferences
                        </h4>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-all">
                                <div>
                                    <p class="font-bold text-gray-800 text-sm">Real-time Dashboard Updates</p>
                                    <p class="text-xs text-gray-500">Refresh statistics every 60 seconds automatically.</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked class="sr-only peer">
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

window.saveAccountChanges = function(e) {
    e.preventDefault();
    const newUsername = document.getElementById('acc-username').value;
    const newPassword = document.getElementById('acc-password').value;
    const avatarFile = document.getElementById('acc-avatar-upload').files[0];

    localStorage.setItem('ft_username', newUsername);
    if (newPassword) {
        localStorage.setItem('ft_password', newPassword);
    }

    if (avatarFile) {
        const reader = new FileReader();
        reader.onload = function(event) {
            localStorage.setItem('ft_avatar', event.target.result);
            updateUIWithUser(newUsername);
            closeAccountModal();
            alert('Account updated with new profile picture!');
        };
        reader.readAsDataURL(avatarFile);
    } else {
        updateUIWithUser(newUsername);
        closeAccountModal();
        alert('Account credentials updated successfully!');
    }
};

function updateUIWithUser(username) {
    const display = username.split('@')[0];
    document.getElementById('header-username-display').innerText = display.charAt(0).toUpperCase() + display.slice(1);
    
    const avatarContainer = document.getElementById('header-avatar');
    const savedAvatar = localStorage.getItem('ft_avatar');

    if (savedAvatar) {
        avatarContainer.innerHTML = `<img src="${savedAvatar}" class="w-full h-full rounded-full object-cover">`;
        avatarContainer.classList.remove('bg-indigo-100', 'text-indigo-700');
    } else {
        avatarContainer.innerText = username.substring(0, 2).toUpperCase();
        avatarContainer.classList.add('bg-indigo-100', 'text-indigo-700');
    }
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

    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-layout').classList.remove('hidden');
        const savedView = localStorage.getItem('currentView') || 'dashboard';
        showView(savedView);
    }
}

init();
