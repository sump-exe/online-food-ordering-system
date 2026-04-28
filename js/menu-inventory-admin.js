import { apiGet, apiPost, apiPostFormData } from './api.js';
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
    const rowsHtml = state.menuItems.map((item) => `
        <tr>
            <td>
                ${item.image_url
                    ? `<img src="${item.image_url}" alt="${escapeHtml(item.name)}" style="width:72px;height:72px;object-fit:cover;border-radius:14px;border:1px solid #f1d2bc;background:#fff;">`
                    : '<div style="width:72px;height:72px;border-radius:14px;border:1px dashed #d6b8a8;background:#fff7f0;color:#a27d6b;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700;">No image</div>'}
            </td>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(item.category_name || '-')}</td>
            <td>${item.stock}</td>
            <td>P${(item.price / 100).toFixed(2)}</td>
            <td class="menu-actions-cell">
                <input type="file" class="updateImageInput" data-id="${item.itemID}" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none;">
                <button class="updateImageBtn btn-secondary small-btn" data-id="${item.itemID}">Upload Image</button>
                <button class="editStockBtn btn-secondary small-btn" data-id="${item.itemID}" data-stock="${item.stock}">Update Stock</button>
                <button class="editPriceBtn btn-secondary small-btn" data-id="${item.itemID}" data-price="${item.price}">Update Price</button>
            </td>
        </tr>
    `).join('');

    const categoryOptions = state.categories.map((category) => (
        `<option value="${category.categoryID}">${category.name}</option>`
    )).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Menu &amp; Inventory Management</h1>
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
                <div class="form-group" style="flex:1.4;min-width:180px;margin-bottom:0;">
                    <label>Item Image</label>
                    <input type="file" id="newItemImage" accept="image/jpeg,image/png,image/gif,image/webp">
                </div>
                <button id="addItemBtn" class="btn-primary" style="padding:12px 24px;white-space:nowrap;">Add Item</button>
            </div>
        </div>
        <div class="panel">
            <h2>Stock Overview</h2>
            <div style="overflow-x:auto;">
                <table class="menu-inventory-table">
                    <colgroup>
                        <col style="width: 12%;">
                        <col style="width: 24%;">
                        <col style="width: 18%;">
                        <col style="width: 10%;">
                        <col style="width: 12%;">
                        <col style="width: 24%;">
                    </colgroup>
                    <thead><tr><th>Image</th><th>Item</th><th>Category</th><th>QTY</th><th>Price</th><th class="menu-actions-header">Action</th></tr></thead>
                    <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:24px;">No items found.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

async function updateStock(itemId, newStock) {
    await apiPost('updateStock', { itemId, stock: newStock });
}

async function updatePrice(itemId, newPrice) {
    await apiPost('updatePrice', { itemId, price: newPrice });
}

async function addMenuItem(payload) {
    await apiPostFormData('addMenuItem', payload);
}

async function updateMenuItemImage(itemId, file) {
    const formData = new FormData();
    formData.append('itemId', String(itemId));
    formData.append('image', file);
    await apiPostFormData('updateMenuItemImage', formData);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

    document.querySelectorAll('.editPriceBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.dataset.id, 10);
            const currentPrice = this.dataset.price;
            const newPrice = prompt('Enter new price in cents:', currentPrice);
            if (newPrice === null || Number.isNaN(parseInt(newPrice, 10))) {
                return;
            }
            updatePrice(id, parseInt(newPrice, 10))
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    });

    document.querySelectorAll('.updateImageBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            const input = document.querySelector(`.updateImageInput[data-id="${this.dataset.id}"]`);
            input?.click();
        });
    });

    document.querySelectorAll('.updateImageInput').forEach((input) => {
        input.addEventListener('change', function () {
            const file = this.files?.[0];
            if (!file) {
                return;
            }

            updateMenuItemImage(parseInt(this.dataset.id, 10), file)
                .then(() => renderApp())
                .catch((error) => alert(error.message))
                .finally(() => {
                    this.value = '';
                });
        });
    });

    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('newItemName').value.trim();
            const price = parseInt(document.getElementById('newItemPrice').value, 10);
            const stock = parseInt(document.getElementById('newItemStock').value, 10);
            const categoryID = parseInt(document.getElementById('newItemCategory').value, 10);
            const imageFile = document.getElementById('newItemImage').files?.[0] ?? null;

            if (!name || Number.isNaN(price) || Number.isNaN(stock)) {
                alert('Please fill all fields');
                return;
            }

            const formData = new FormData();
            formData.append('name', name);
            formData.append('price', String(price));
            formData.append('stock', String(stock));
            formData.append('categoryID', String(categoryID));
            if (imageFile) {
                formData.append('image', imageFile);
            }

            addMenuItem(formData)
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    }
}
