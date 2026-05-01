import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadCategories() {
    try {
        const categories = await apiGet('getAdminCategories');
        state.adminCategories = categories;
        return categories;
    } catch (error) {
        console.error('Failed to load categories:', error);
        return [];
    }
}

export function renderAdminCategoriesPage() {
    const categories = state.adminCategories || [];
    
    const rowsHtml = categories.map(category => `
        <tr data-category-id="${category.categoryID}">
            <td>${category.categoryID}</td>
            <td><strong>${escapeHtml(category.name)}</strong></td>
            <td>-</td>
            <td>-</td>
            <td class="actions-cell">
                <button class="editCategoryBtn btn-secondary small-btn" data-id="${category.categoryID}" data-name="${escapeHtml(category.name)}" data-description="">
                    ✏️ Edit
                </button>
                <button class="deleteCategoryBtn btn-danger small-btn" data-id="${category.categoryID}" data-name="${escapeHtml(category.name)}">
                    🗑️ Delete
                </button>
            </td>
        </tr>
    `).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Category Management</h1>
            <p>Manage your menu categories - organize your food items</p>
        </div>
        
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <h2 style="margin-bottom: 0;">Categories</h2>
                <button id="addCategoryBtn" class="btn-primary">
                    ➕ Add Category
                </button>
            </div>
            
            <div style="overflow-x: auto;">
                <table class="categories-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Category Name</th>
                            <th>Description</th>
                            <th>Date Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #aaa;">No categories found. Click "Add Category" to create one.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function showAddCategoryModal(onSave, onClose) {
    removeModal();
    
    const modalHtml = `
    <div id="categoryModal" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h2>Add New Category</h2>
                <button class="modal-close" id="closeModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div id="modalMessage" class="modal-message" style="display: none;"></div>
                <div class="form-group">
                    <label>Category Name <span style="color: #dc2626;">*</span></label>
                    <input type="text" id="categoryName" placeholder="e.g., Appetizers, Main Course, Desserts" autocomplete="off">
                </div>
                <div class="form-group">
                    <label>Description <span style="color: #aaa;">(Optional)</span></label>
                    <textarea id="categoryDescription" rows="3" placeholder="Describe this category..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelModalBtn" class="btn-secondary">Cancel</button>
                <button id="saveCategoryBtn" class="btn-primary">Save Category</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('categoryModal');
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    const saveBtn = document.getElementById('saveCategoryBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const messageDiv = document.getElementById('modalMessage');
    
    const closeModal = () => {
        modal.remove();
        if (onClose) onClose();
    };
    
    const showMessage = (message, isError = true) => {
        messageDiv.textContent = message;
        messageDiv.className = `modal-message ${isError ? 'error' : 'success'}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    };
    
    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            showMessage('Category name is required.');
            nameInput.focus();
            return;
        }
        
        try {
            await onSave({ name, description: descInput.value.trim() });
            closeModal();
        } catch (error) {
            showMessage(error.message);
        }
    });
    
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    nameInput.focus();
}

function showEditCategoryModal(category, onUpdate, onClose) {
    removeModal();
    
    const modalHtml = `
    <div id="categoryModal" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h2>Edit Category</h2>
                <button class="modal-close" id="closeModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div id="modalMessage" class="modal-message" style="display: none;"></div>
                <div class="form-group">
                    <label>Category Name <span style="color: #dc2626;">*</span></label>
                    <input type="text" id="categoryName" value="${escapeHtml(category.name)}" placeholder="e.g., Appetizers, Main Course, Desserts" autocomplete="off">
                </div>
                <div class="form-group">
                    <label>Description <span style="color: #aaa;">(Optional)</span></label>
                    <textarea id="categoryDescription" rows="3" placeholder="Describe this category...">${escapeHtml(category.description || '')}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelModalBtn" class="btn-secondary">Cancel</button>
                <button id="updateCategoryBtn" class="btn-primary">Update Category</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('categoryModal');
    const nameInput = document.getElementById('categoryName');
    const descInput = document.getElementById('categoryDescription');
    const updateBtn = document.getElementById('updateCategoryBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const messageDiv = document.getElementById('modalMessage');
    
    const closeModal = () => {
        modal.remove();
        if (onClose) onClose();
    };
    
    const showMessage = (message, isError = true) => {
        messageDiv.textContent = message;
        messageDiv.className = `modal-message ${isError ? 'error' : 'success'}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    };
    
    updateBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            showMessage('Category name is required.');
            nameInput.focus();
            return;
        }
        
        try {
            await onUpdate({ ...category, name, description: descInput.value.trim() });
            closeModal();
        } catch (error) {
            showMessage(error.message);
        }
    });
    
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    nameInput.focus();
    nameInput.select();
}

function removeModal() {
    const existingModal = document.getElementById('categoryModal');
    if (existingModal) existingModal.remove();
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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

async function addCategory(categoryData) {
    return await apiPost('addCategory', {
        name: categoryData.name
    });
}

async function updateCategory(categoryData) {
    return await apiPost('updateCategory', {
        categoryID: categoryData.categoryID,
        name: categoryData.name
    });
}

async function deleteCategory(categoryId) {
    return await apiPost('deleteCategory', { categoryID: categoryId });
}

export function attachCategoryEvents(callbacks) {
    const { renderApp, refreshCategories, setAdminMessage } = callbacks;
    
    const addBtn = document.getElementById('addCategoryBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showAddCategoryModal(
                async (categoryData) => {
                    await addCategory(categoryData);
                    if (refreshCategories) await refreshCategories();
                    if (renderApp) await renderApp();
                },
                () => {}
            );
        });
    }
    
    document.querySelectorAll('.editCategoryBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = {
                categoryID: parseInt(btn.dataset.id, 10),
                name: btn.dataset.name,
                description: btn.dataset.description
            };
            showEditCategoryModal(
                category,
                async (updatedCategory) => {
                    await updateCategory(updatedCategory);
                    if (refreshCategories) await refreshCategories();
                    if (renderApp) await renderApp();
                },
                () => {}
            );
        });
    });
    
    document.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const categoryId = parseInt(btn.dataset.id, 10);
            const categoryName = btn.dataset.name;
            
            const confirmed = confirm(`Are you sure you want to delete category "${categoryName}"?\n\nThis action cannot be undone.`);
            
            if (confirmed) {
                try {
                    await deleteCategory(categoryId);
                    if (refreshCategories) await refreshCategories();
                    if (renderApp) await renderApp();
                    if (setAdminMessage) setAdminMessage(`Category "${categoryName}" deleted successfully`, 'success');
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });
}