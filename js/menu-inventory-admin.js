import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadMenuItems() {
    state.menuItems = await apiGet('getMenuItems');
}

export async function loadCategories() {
    state.categories = await apiGet('getCategories');
}

export function renderAdminNavBar() {
    const navItems = [
        { id: 'menu', label: 'Menu & Inventory' },
        { id: 'inventory', label: 'Inventory Status' },
        { id: 'sales-report', label: 'Sales Report' },
        { id: 'orders', label: 'All Orders' },
        { id: 'sales', label: 'Sales' },
        { id: 'users', label: 'Users' },
    ];

    const navLinksHtml = navItems.map((item) => `
        <button class="admin-nav-item ${state.adminPage === item.id ? 'active' : ''}" data-page="${item.id}">
            <span class="admin-nav-label">${item.label}</span>
        </button>
    `).join('');

    return `
    <div class="admin-sidebar">
        <div class="admin-sidebar-logo">
            <div>
                <div class="sidebar-brand">FoodieDash</div>
                <div class="sidebar-role">Admin Panel</div>
            </div>
        </div>
        <nav class="admin-nav">${navLinksHtml}</nav>
        <div class="sidebar-footer">
            <div class="sidebar-user">${state.currentUser.username}</div>
            <button class="btn-logout" id="logoutBtn">Logout</button>
        </div>
    </div>`;
}

export function renderAdminMenuPage() {
    let menuHtml = '';
    for (const item of state.menuItems) {
        const stockStatus = item.stock === 0
            ? 'Out of Stock'
            : item.stock < 10
                ? `Low Stock (${item.stock})`
                : `In Stock (${item.stock})`;

        menuHtml += `
        <div class="menu-row">
            <span>
                <strong>${item.name}</strong>
                <br><small>P${(item.price / 100).toFixed(2)} | ${item.category_name || 'Uncategorised'} | ${stockStatus}</small>
            </span>
            <div>
                <button class="editStockBtn btn-secondary small-btn" data-id="${item.itemID}" data-stock="${item.stock}">Update Stock</button>
            </div>
        </div>`;
    }

    const categoryOptions = state.categories.map((category) => (
        `<option value="${category.categoryID}">${category.name}</option>`
    )).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Menu &amp; Inventory Management</h1>
            <p>Manage your menu items, prices and stock levels</p>
        </div>
        <div class="panel">
            <h2>Current Menu Items</h2>
            <div class="item-list">${menuHtml || '<p style="text-align:center;color:#aaa;padding:20px;">No items found.</p>'}</div>
        </div>
        <div class="panel">
            <h2>Add New Item</h2>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
                <div class="form-group" style="flex:2;min-width:160px;margin-bottom:0;">
                    <label>Item Name</label>
                    <input type="text" id="newItemName" placeholder="e.g. Garlic Bread">
                </div>
                <div class="form-group" style="flex:1;min-width:120px;margin-bottom:0;">
                    <label>Price (cents, e.g. 499 = P4.99)</label>
                    <input type="number" id="newItemPrice" placeholder="e.g. 499">
                </div>
                <div class="form-group" style="flex:1;min-width:100px;margin-bottom:0;">
                    <label>Stock</label>
                    <input type="number" id="newItemStock" placeholder="e.g. 50">
                </div>
                <div class="form-group" style="flex:1;min-width:120px;margin-bottom:0;">
                    <label>Category</label>
                    <select id="newItemCategory">${categoryOptions}</select>
                </div>
                <button id="addItemBtn" class="btn-primary" style="padding:12px 24px;white-space:nowrap;">Add Item</button>
            </div>
        </div>
    </div>`;
}

export function renderAdminInventoryPage() {
    const lowStock = state.menuItems.filter((item) => item.stock <= 10 && item.stock > 0);
    const outOfStock = state.menuItems.filter((item) => item.stock === 0);
    const goodStock = state.menuItems.filter((item) => item.stock > 10);

    const rowsHtml = state.menuItems.map((item) => {
        const pct = Math.min(100, (item.stock / 60) * 100);
        const barColor = item.stock === 0 ? '#dc2626' : item.stock < 10 ? '#f59e0b' : '#10b981';

        return `
        <tr>
            <td><strong>${item.name}</strong></td>
            <td>${item.category_name || '-'}</td>
            <td>${item.stock}</td>
            <td>
                <div class="stock-bar-wrap">
                    <div class="stock-bar-fill" style="width:${pct}%;background:${barColor};"></div>
                </div>
            </td>
            <td>
                <span class="inv-badge" style="background:${barColor}20;color:${barColor};">
                    ${item.stock === 0 ? 'Out of Stock' : item.stock < 10 ? 'Low Stock' : 'Good'}
                </span>
            </td>
            <td><button class="editStockBtn btn-secondary small-btn" data-id="${item.itemID}" data-stock="${item.stock}">Update</button></td>
        </tr>`;
    }).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Inventory Status</h1>
            <p>Monitor stock levels across all menu items</p>
        </div>
        <div class="grid-3col" style="margin-bottom:28px;">
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-val">${goodStock.length}</div>
                <div class="stat-label">Well Stocked</div>
            </div>
            <div class="stat-card" style="--accent:#f59e0b;">
                <div class="stat-val">${lowStock.length}</div>
                <div class="stat-label">Low Stock</div>
            </div>
            <div class="stat-card" style="--accent:#dc2626;">
                <div class="stat-val">${outOfStock.length}</div>
                <div class="stat-label">Out of Stock</div>
            </div>
        </div>
        ${lowStock.length > 0 ? `<div class="alert-banner"><strong>Low stock alert:</strong> ${lowStock.map((item) => item.name).join(', ')}</div>` : ''}
        <div class="panel">
            <h2>Stock Overview</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th style="min-width:160px;">Level</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

async function updateStock(itemId, newStock) {
    await apiPost('updateStock', { itemId, stock: newStock });
}

async function addMenuItem(payload) {
    await apiPost('addMenuItem', payload);
}

export function attachAdminMenuInventoryEvents(callbacks) {
    const { renderApp, setAdminPage, logout } = callbacks;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout(renderApp));
    }

    document.querySelectorAll('.admin-nav-item').forEach((btn) => {
        btn.addEventListener('click', function () {
            setAdminPage(this.dataset.page);
        });
    });

    document.querySelectorAll('.editStockBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.dataset.id, 10);
            const newStock = prompt('Enter new stock quantity:', this.dataset.stock);
            if (newStock === null || Number.isNaN(parseInt(newStock, 10))) {
                return;
            }
            updateStock(id, parseInt(newStock, 10))
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    });

    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('newItemName').value.trim();
            const price = parseInt(document.getElementById('newItemPrice').value, 10);
            const stock = parseInt(document.getElementById('newItemStock').value, 10);
            const categoryID = parseInt(document.getElementById('newItemCategory').value, 10);

            if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
                alert('Please fill all fields');
                return;
            }

            addMenuItem({ name, price, stock, categoryID })
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    }
}
