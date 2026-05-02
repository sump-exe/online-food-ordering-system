import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

const CATEGORY_TYPES = {
    food: { label: 'Food', icon: '&#127828;', color: '#ff5722' },
    drinks: { label: 'Drinks', icon: '&#129380;', color: '#2196f3' },
    desserts: { label: 'Desserts', icon: '&#127856;', color: '#9c27b0' },
    addons: { label: 'Add-ons', icon: '&#10133;', color: '#4caf50' }
};

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

export async function loadDeletedCategories() {
    try {
        const categories = await apiGet('getDeletedCategories');
        state.deletedAdminCategories = categories;
        return categories;
    } catch (error) {
        console.error('Failed to load deleted categories:', error);
        return [];
    }
}

export async function loadMenuItemsByCategory(categoryId) {
    try {
        return await apiGet('getMenuItemsByCategory', { categoryId });
    } catch (error) {
        console.error('Failed to load menu items:', error);
        return [];
    }
}

export function renderAdminCategoriesPage() {
    const categories = state.adminCategories || [];

    const groupedCategories = {
        food: categories.filter((c) => c.category_type === 'food'),
        drinks: categories.filter((c) => c.category_type === 'drinks'),
        desserts: categories.filter((c) => c.category_type === 'desserts'),
        addons: categories.filter((c) => c.category_type === 'addons')
    };

    let groupsHtml = '';

    for (const [type, items] of Object.entries(groupedCategories)) {
        const typeConfig = CATEGORY_TYPES[type];
        if (!typeConfig) continue;

        const rowsHtml = items.map((category) => `
            <tr data-category-id="${category.categoryID}">
                <td style="width: 80px;">${category.categoryID}</td>
                <td><strong>${escapeHtml(category.name)}</strong></td>
                <td>${escapeHtml(category.description) || '-'}</td>
                <td style="width: 100px;">
                    <span class="item-count-badge">${category.item_count || 0} items</span>
                </td>
                <td style="width: 160px;">${formatDate(category.date_created)}</td>
                <td class="actions-cell" style="width: 140px;">
                    <button class="editCategoryBtn btn-secondary small-btn"
                            data-id="${category.categoryID}"
                            data-name="${escapeHtml(category.name)}"
                            data-description="${escapeHtml(category.description || '')}"
                            data-type="${type}">
                        Edit
                    </button>
                    <button class="deleteCategoryBtn btn-danger small-btn"
                            data-id="${category.categoryID}"
                            data-name="${escapeHtml(category.name)}">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');

        groupsHtml += `
            <div class="category-group">
                <div class="category-group-header" style="border-left-color: ${typeConfig.color}">
                    <span class="category-group-icon">${typeConfig.icon}</span>
                    <h3>${typeConfig.label}</h3>
                    <span class="category-count">${items.length} categories</span>
                </div>
                <div style="overflow-x: auto;">
                    <table class="categories-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Category Name</th>
                                <th>Description</th>
                                <th>Items</th>
                                <th>Date Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #aaa;">No categories found. Click "Add Category" to create one.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>Category Management</h1>
            <p>Manage your menu categories - organize by type (Food, Drinks, Desserts, Add-ons)</p>
            <div class="info-banner">
                Soft delete moves a category to Trash. Permanent delete removes it from the database and active menu items under it become uncategorized.
            </div>
        </div>

        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
                <h2 style="margin-bottom: 0;">Categories by Type</h2>
                <button id="addCategoryBtn" class="btn-primary">Add Category</button>
            </div>

            <div class="category-groups-container">
                ${groupsHtml}
            </div>
        </div>
    </div>`;
}

function showAddCategoryModal(onSave, onClose) {
    removeModal();

    const typeOptions = Object.entries(CATEGORY_TYPES).map(([value, config]) =>
        `<option value="${value}">${config.icon} ${config.label}</option>`
    ).join('');

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
                    <label>Category Type <span style="color: #dc2626;">*</span></label>
                    <select id="categoryType">${typeOptions}</select>
                </div>
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
    const typeSelect = document.getElementById('categoryType');
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
    };

    saveBtn.addEventListener('click', async () => {
        const categoryType = typeSelect.value;
        const name = nameInput.value.trim();

        if (!name) {
            showMessage('Category name is required.');
            nameInput.focus();
            return;
        }

        try {
            const result = await onSave({
                name,
                description: descInput.value.trim(),
                category_type: categoryType
            });
            showMessage(result.message || 'Category added successfully!', false);
            setTimeout(() => closeModal(), 1200);
        } catch (error) {
            showMessage(error.message);
        }
    });

    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
    nameInput.focus();
}

function showEditCategoryModal(category, onUpdate, onClose) {
    removeModal();

    const typeOptions = Object.entries(CATEGORY_TYPES).map(([value, config]) =>
        `<option value="${value}" ${category.category_type === value ? 'selected' : ''}>${config.icon} ${config.label}</option>`
    ).join('');

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
                    <label>Category Type <span style="color: #dc2626;">*</span></label>
                    <select id="categoryType">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label>Category Name <span style="color: #dc2626;">*</span></label>
                    <input type="text" id="categoryName" value="${escapeHtml(category.name)}" autocomplete="off">
                </div>
                <div class="form-group">
                    <label>Description <span style="color: #aaa;">(Optional)</span></label>
                    <textarea id="categoryDescription" rows="3">${escapeHtml(category.description || '')}</textarea>
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
    const typeSelect = document.getElementById('categoryType');
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

    const showMessage = (message) => {
        messageDiv.textContent = message;
        messageDiv.className = 'modal-message error';
        messageDiv.style.display = 'block';
    };

    updateBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            showMessage('Category name is required.');
            return;
        }

        try {
            await onUpdate({
                ...category,
                name,
                description: descInput.value.trim(),
                category_type: typeSelect.value
            });
            closeModal();
        } catch (error) {
            showMessage(error.message);
        }
    });

    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);
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
        day: 'numeric'
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
    return apiPost('addCategory', categoryData);
}

async function updateCategory(categoryData) {
    return apiPost('updateCategory', {
        categoryID: categoryData.categoryID,
        name: categoryData.name,
        description: categoryData.description,
        category_type: categoryData.category_type
    });
}

async function deleteCategory(categoryId) {
    return apiPost('deleteCategory', { categoryID: categoryId });
}

async function restoreCategory(categoryId) {
    return apiPost('restoreCategory', { categoryID: categoryId });
}

async function permanentlyDeleteCategory(categoryId) {
    return apiPost('permanentlyDeleteCategory', { categoryID: categoryId });
}

export function attachCategoryEvents(callbacks) {
    const { renderApp, refreshCategories, setAdminMessage } = callbacks;

    const addBtn = document.getElementById('addCategoryBtn');
    if (addBtn) {
        addBtn.onclick = () => {
            showAddCategoryModal(
                async (categoryData) => {
                    const result = await addCategory(categoryData);
                    if (refreshCategories) await refreshCategories();
                    if (renderApp) await renderApp();
                    if (setAdminMessage) setAdminMessage(result.message, 'success');
                    return result;
                }
            );
        };
    }

    document.querySelectorAll('.editCategoryBtn').forEach((btn) => {
        btn.onclick = () => {
            const category = {
                categoryID: parseInt(btn.dataset.id, 10),
                name: btn.dataset.name,
                description: btn.dataset.description,
                category_type: btn.dataset.type
            };
            showEditCategoryModal(
                category,
                async (updatedCategory) => {
                    await updateCategory(updatedCategory);
                    if (refreshCategories) await refreshCategories();
                    if (renderApp) await renderApp();
                }
            );
        };
    });

    document.querySelectorAll('.deleteCategoryBtn').forEach((btn) => {
        btn.onclick = async () => {
            const categoryId = parseInt(btn.dataset.id, 10);
            const categoryName = btn.dataset.name;
            if (!confirm(`Move category "${categoryName}" to Trash?`)) {
                return;
            }

            try {
                const result = await deleteCategory(categoryId);
                if (refreshCategories) await refreshCategories();
                if (renderApp) await renderApp();
                if (setAdminMessage) {
                    setAdminMessage(result.message, 'success');
                }
            } catch (error) {
                alert(error.message);
            }
        };
    });

    document.querySelectorAll('.restoreCategoryBtn').forEach((btn) => {
        btn.onclick = async () => {
            try {
                const result = await restoreCategory(parseInt(btn.dataset.id, 10));
                if (refreshCategories) await refreshCategories();
                if (renderApp) await renderApp();
                if (setAdminMessage) {
                    setAdminMessage(result.message, 'success');
                }
            } catch (error) {
                alert(error.message);
            }
        };
    });

    document.querySelectorAll('.permanentDeleteCategoryBtn').forEach((btn) => {
        btn.onclick = async () => {
            const categoryId = parseInt(btn.dataset.id, 10);
            const categoryName = btn.dataset.name;
            const itemCount = parseInt(btn.dataset.itemCount, 10);

            let message = `Permanently delete category "${categoryName}"?`;
            if (itemCount > 0) {
                message += `\n\n${itemCount} active menu item(s) will become Uncategorized.`;
            }
            message += '\n\nThis cannot be undone.';

            if (!confirm(message)) {
                return;
            }

            try {
                const result = await permanentlyDeleteCategory(categoryId);
                if (refreshCategories) await refreshCategories();
                if (renderApp) await renderApp();
                if (setAdminMessage) {
                    setAdminMessage(result.message, 'success');
                }
            } catch (error) {
                alert(error.message);
            }
        };
    });
}
