import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

const API_BASE = 'api.php';

export async function loadMenuItems() {
    state.menuItems = await apiGet('getMenuItems');
}

export async function loadCategories() {
    state.categories = await apiGet('getCategories');
}

export function renderAdminNavBar() {
    const navItems = [
        { id: 'menu', label: 'Menu & Inventory' },
        { id: 'categories', label: 'Categories' },
        { id: 'tags', label: 'Tags' },
        { id: 'orders', label: 'All Orders' },
        { id: 'sales', label: 'Sales Reports' },
        { id: 'inventory', label: 'Stock Inventory' },
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
            <div class="sidebar-user">${escapeHtml(state.currentUser.username)}</div>
            <button class="btn-logout" id="logoutBtn">Logout</button>
        </div>
    </div>`;
}

export function renderAdminMenuPage() {
    const rowsHtml = state.menuItems.map((item) => `
        <tr>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${item.category_name || '-'}</td>
            <td>${item.stock}</td>
            <td>P${(item.price / 100).toFixed(2)}</td>
            <td class="menu-actions-cell">
                <button class="editItemBtn btn-primary small-btn" data-id="${item.itemID}">
                    ✏️ Edit Item
                </button>
                <button class="deleteItemBtn btn-danger small-btn" data-id="${item.itemID}" data-name="${escapeHtml(item.name)}">
                    🗑️ Delete
                </button>
            </td>
         `
    ).join('');

    const categoryOptions = (state.categories || []).map((category) => (
        `<option value="${category.categoryID}">${escapeHtml(category.name)}</option>`
    )).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Menu &amp; Inventory Management</h1>
            <p>Manage your menu items, prices and stock levels</p>
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
        <div class="panel">
            <h2>Stock Overview</h2>
            <div style="overflow-x:auto;">
                <table class="menu-inventory-table">
                    <colgroup>
                        <col style="width: 32%;">
                        <col style="width: 21%;">
                        <col style="width: 10%;">
                        <col style="width: 13%;">
                        <col style="width: 24%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>QTY</th>
                            <th>Price</th>
                            <th class="menu-actions-header">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:24px;">No items found. </td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function getEditModalHtml(categoryOptions) {
    return `
    <div id="editItemModal" class="modal-overlay" style="display: none;">
        <div class="modal-container" style="max-width: 600px;">
            <div class="modal-header">
                <h2>Edit Menu Item</h2>
                <button class="modal-close" id="closeModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div id="modalMessage" class="modal-message" style="display: none;"></div>
                <form id="editItemForm" enctype="multipart/form-data">
                    <input type="hidden" id="editItemId" name="itemId">
                    
                    <div class="form-group">
                        <label>Item Name <span style="color: #dc2626;">*</span></label>
                        <input type="text" id="editItemName" name="name" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Price (in cents) <span style="color: #dc2626;">*</span></label>
                        <input type="number" id="editItemPrice" name="price" required>
                        <small>Example: 1299 = P12.99</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Stock Quantity <span style="color: #dc2626;">*</span></label>
                        <input type="number" id="editItemStock" name="stock" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Category</label>
                        <select id="editItemCategory" name="categoryID">
                            <option value="0">-- No Category --</option>
                            ${categoryOptions}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Current Image</label>
                        <div id="currentImageContainer" style="background: #f9f5f0; border-radius: 12px; padding: 12px; text-align: center;">
                            <p style="color: #999;">No image uploaded</p>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Upload New Image (Optional)</label>
                        <input type="file" id="editItemImage" name="image" accept="image/jpeg,image/png,image/gif,image/webp">
                        <small>Allowed: JPG, PNG, GIF, WEBP. Max size: 5MB</small>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button id="cancelModalBtn" class="btn-secondary">Cancel</button>
                <button id="saveItemBtn" class="btn-primary">Save Changes</button>
            </div>
        </div>
    </div>`;
}

function showDeleteConfirmModal(itemId, itemName, onConfirm) {
    const modalHtml = `
    <div id="deleteConfirmModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 400px;">
            <div class="modal-header">
                <h2>Confirm Delete</h2>
                <button class="modal-close" id="closeDeleteModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete <strong>${escapeHtml(itemName)}</strong>?</p>
                <p style="color: #dc2626; font-size: 0.85rem;">This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
                <button id="cancelDeleteBtn" class="btn-secondary">Cancel</button>
                <button id="confirmDeleteBtn" class="btn-danger">Delete Item</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('deleteConfirmModal');
    
    const closeModal = () => {
        modal.remove();
    };
    
    document.getElementById('closeDeleteModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelDeleteBtn').addEventListener('click', closeModal);
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

async function addMenuItem(payload) {
    return await apiPost('addMenuItem', payload);
}

async function getMenuItem(itemId) {
    return await apiGet('getMenuItem', { itemId });
}

async function updateMenuItem(formData) {
    return await fetch(`${API_BASE}?action=updateMenuItem`, {
        method: 'POST',
        body: formData
    }).then(res => res.json());
}

async function deleteMenuItem(itemId) {
    return await apiPost('deleteMenuItem', { itemId });
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

async function showEditModal(itemId, categoryOptions, onSaveSuccess) {
    const modal = document.getElementById('editItemModal');
    if (!modal) {
        console.error('Modal not found');
        return;
    }
    
    const messageDiv = document.getElementById('modalMessage');
    messageDiv.textContent = 'Loading item data...';
    messageDiv.className = 'modal-message';
    messageDiv.style.display = 'block';
    
    modal.style.display = 'flex';
    
    try {
        const item = await getMenuItem(itemId);
        
        document.getElementById('editItemId').value = item.itemID;
        document.getElementById('editItemName').value = item.name;
        document.getElementById('editItemPrice').value = item.price;
        document.getElementById('editItemStock').value = item.stock;
        document.getElementById('editItemCategory').value = item.categoryID || 0;
        
        const imageContainer = document.getElementById('currentImageContainer');
        if (item.image) {
            imageContainer.innerHTML = `
                <img src="../${item.image}" alt="${item.name}" style="max-width: 150px; max-height: 150px; border-radius: 12px; border: 1px solid #ffe0c4;">
                <p style="font-size: 0.75rem; color: #666; margin-top: 8px;">Current image</p>
            `;
        } else {
            imageContainer.innerHTML = '<p style="color: #999;">No image uploaded</p>';
        }
        
        messageDiv.style.display = 'none';
        
    } catch (error) {
        console.error('Error loading item:', error);
        messageDiv.textContent = 'Failed to load item: ' + error.message;
        messageDiv.className = 'modal-message error';
        messageDiv.style.display = 'block';
    }
}

function closeEditModal() {
    const modal = document.getElementById('editItemModal');
    if (modal) {
        modal.style.display = 'none';
    }
    const form = document.getElementById('editItemForm');
    if (form) form.reset();
    const messageDiv = document.getElementById('modalMessage');
    if (messageDiv) messageDiv.style.display = 'none';
}

export function attachAdminMenuInventoryEvents(callbacks) {
    const { renderApp, setAdminPage, logout } = callbacks;
    
    const categoryOptions = (state.categories || []).map((category) => (
        `<option value="${category.categoryID}">${escapeHtml(category.name)}</option>`
    )).join('');
    
    if (!document.getElementById('editItemModal')) {
        document.body.insertAdjacentHTML('beforeend', getEditModalHtml(categoryOptions));
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout(renderApp));
    }
    
    document.querySelectorAll('.admin-nav-item').forEach((btn) => {
        btn.addEventListener('click', function () {
            setAdminPage(this.dataset.page);
        });
    });
    
    document.addEventListener('click', async function(e) {
        const editBtn = e.target.closest('.editItemBtn');
        if (editBtn) {
            const itemId = parseInt(editBtn.dataset.id, 10);
            await showEditModal(itemId, categoryOptions, renderApp);
        }
    });
    
    document.addEventListener('click', function(e) {
        const deleteBtn = e.target.closest('.deleteItemBtn');
        if (deleteBtn) {
            const itemId = parseInt(deleteBtn.dataset.id, 10);
            const itemName = deleteBtn.dataset.name;
            showDeleteConfirmModal(itemId, itemName, async () => {
                try {
                    await deleteMenuItem(itemId);
                    await renderApp();
                } catch (error) {
                    alert('Failed to delete item: ' + error.message);
                }
            });
        }
    });
    
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeEditModal);
    
    const modal = document.getElementById('editItemModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeEditModal();
        });
    }
    
    const saveBtn = document.getElementById('saveItemBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const form = document.getElementById('editItemForm');
            const formData = new FormData(form);
            const messageDiv = document.getElementById('modalMessage');
            
            const name = document.getElementById('editItemName').value.trim();
            const price = parseInt(document.getElementById('editItemPrice').value, 10);
            const stock = parseInt(document.getElementById('editItemStock').value, 10);
            
            if (!name) {
                messageDiv.textContent = 'Item name is required.';
                messageDiv.className = 'modal-message error';
                messageDiv.style.display = 'block';
                return;
            }
            
            if (isNaN(price) || price <= 0) {
                messageDiv.textContent = 'Price must be a positive number.';
                messageDiv.className = 'modal-message error';
                messageDiv.style.display = 'block';
                return;
            }
            
            if (isNaN(stock) || stock < 0) {
                messageDiv.textContent = 'Stock cannot be negative.';
                messageDiv.className = 'modal-message error';
                messageDiv.style.display = 'block';
                return;
            }
            
            messageDiv.textContent = 'Saving...';
            messageDiv.className = 'modal-message';
            messageDiv.style.display = 'block';
            
            try {
                const response = await fetch('api.php?action=updateMenuItem', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.error) {
                    throw new Error(result.error);
                }
                
                messageDiv.textContent = result.message || 'Item updated successfully!';
                messageDiv.className = 'modal-message success';
                
                setTimeout(() => {
                    closeEditModal();
                    renderApp();
                }, 1500);
                
            } catch (error) {
                console.error('Save error:', error);
                messageDiv.textContent = 'Error: ' + error.message;
                messageDiv.className = 'modal-message error';
                messageDiv.style.display = 'block';
            }
        });
    }
    
    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('newItemName').value.trim();
            const price = parseInt(document.getElementById('newItemPrice').value, 10);
            const stock = parseInt(document.getElementById('newItemStock').value, 10);
            const categoryID = parseInt(document.getElementById('newItemCategory').value, 10);

            if (!name || isNaN(price) || isNaN(stock)) {
                alert('Please fill all fields');
                return;
            }

            addMenuItem({ name, price, stock, categoryID })
                .then(() => renderApp())
                .catch((error) => alert(error.message));
        });
    }
}