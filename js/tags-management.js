import { apiGet, apiPost } from './api.js';
import { state } from './state.js';

export async function loadTags() {
    try {
        const tags = await apiGet('getTags');
        state.tags = tags || [];
        return state.tags;
    } catch (error) {
        console.error('Failed to load tags:', error);
        state.tags = [];
        return [];
    }
}

export function renderTagsPage() {
    const tags = state.tags || [];
    
    const midPoint = Math.ceil(tags.length / 2);
    const leftColumnTags = tags.slice(0, midPoint);
    const rightColumnTags = tags.slice(midPoint);
    
    const renderTagColumn = (tagList) => {
        if (!tagList || tagList.length === 0) return '';
        return tagList.map(tag => `
            <div class="tag-card" data-tag-id="${tag.tagID}">
                <div class="tag-content">
                    <div class="tag-name-wrapper">
                        <span class="tag-icon">🏷️</span>
                        <span class="tag-name">${escapeHtml(tag.tag_name)}</span>
                        ${tag.usage_count > 0 ? `<span class="tag-usage-badge">${tag.usage_count} items</span>` : ''}
                    </div>
                </div>
                <div class="tag-actions">
                    <button class="edit-tag-btn btn-secondary small-btn" 
                            data-id="${tag.tagID}"
                            data-name="${escapeHtml(tag.tag_name)}">
                        ✏️ Edit
                    </button>
                    <button class="delete-tag-btn btn-danger small-btn" 
                            data-id="${tag.tagID}"
                            data-name="${escapeHtml(tag.tag_name)}"
                            data-usage="${tag.usage_count}">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    };
    
    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>🏷️ Tags Management</h1>
            <p>Create and manage text field tags for menu items</p>
        </div>
        
        <div class="panel">
            <h2>Add New Tag</h2>
            <div class="add-tag-form">
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label>Tag Name <span style="color: #dc2626;">*</span></label>
                        <input type="text" id="newTagName" placeholder="e.g., Popular, New, Sale, Limited" maxlength="100" autocomplete="off">
                    </div>
                    <div class="form-group" style="flex: 0;">
                        <button id="addTagBtn" class="btn-primary" style="margin-top: 28px;">
                            ➕ Add Tag
                        </button>
                    </div>
                </div>
                <div id="addTagMessage" class="form-message" style="display: none;"></div>
            </div>
        </div>
        
        <div class="panel">
            <h2>All Tags <span class="tag-count">(${tags.length})</span></h2>
            ${tags.length === 0 ? `
                <div class="empty-state">
                    <span class="empty-icon">🏷️</span>
                    <p>No tags found. Click "Add Tag" to create your first tag.</p>
                </div>
            ` : `
                <div class="tags-two-columns">
                    <div class="tags-column">
                        ${renderTagColumn(leftColumnTags)}
                    </div>
                    <div class="tags-column">
                        ${renderTagColumn(rightColumnTags)}
                    </div>
                </div>
            `}
        </div>
    </div>`;
}

function showEditTagModal(tag, onSave, onClose) {
    removeEditTagModal();
    
    const modalHtml = `
    <div id="editTagModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h2>✏️ Edit Tag</h2>
                <button class="modal-close" data-close>&times;</button>
            </div>
            <div class="modal-body">
                <div id="modalMessage" class="modal-message" style="display: none;"></div>
                <div class="form-group">
                    <label>Tag Name <span style="color: #dc2626;">*</span></label>
                    <input type="text" id="editTagName" value="${escapeHtml(tag.name)}" maxlength="100" autocomplete="off">
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelModalBtn" class="btn-secondary" data-close>Cancel</button>
                <button id="saveTagBtn" class="btn-primary">Save Changes</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('editTagModal');
    const nameInput = document.getElementById('editTagName');
    const saveBtn = document.getElementById('saveTagBtn');
    const messageDiv = document.getElementById('modalMessage');

    const originalName = tag.name;

    const closeModal = () => {
        modal.remove();
        if (onClose) onClose();
    };

    const attemptClose = () => {
        if (nameInput.value.trim() !== originalName) {
            if (!confirm('There are still some unsaved changes, are you sure you want to exit?')) {
                return;
            }
        }
        closeModal();
    };

    const showMessage = (message, isError = true) => {
        messageDiv.textContent = message;
        messageDiv.className = `modal-message ${isError ? 'error' : 'success'}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    };

    // Delegate close via overlay click or any [data-close] button
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.hasAttribute('data-close')) {
            attemptClose();
        }
    });
    
    saveBtn.addEventListener('click', async () => {
        const newName = nameInput.value.trim();
        
        if (!newName) {
            showMessage('Tag name is required.');
            nameInput.focus();
            return;
        }
        
        try {
            await onSave({ ...tag, name: newName });
            closeModal();
        } catch (error) {
            showMessage(error.message);
        }
    });
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            attemptClose();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    nameInput.focus();
    nameInput.select();
}

function showDeleteTagConfirmModal(tagId, tagName, usageCount, onConfirm) {
    const existing = document.getElementById('deleteTagConfirmModal');
    if (existing) existing.remove();

    const modalHtml = `
    <div id="deleteTagConfirmModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h2>⚠️ Confirm Delete</h2>
                <button class="modal-close" id="closeDeleteModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete tag <strong>"${escapeHtml(tagName)}"</strong>?</p>
                ${usageCount > 0 ? `
                    <div class="warning-box">
                        <span>⚠️</span>
                        <p>This tag is currently used by <strong>${usageCount}</strong> menu item(s). Deleting it will remove this tag from those items.</p>
                    </div>
                ` : ''}
                <p style="color: #dc2626; font-size: 0.85rem;">This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
                <button id="cancelDeleteBtn" class="btn-secondary">Cancel</button>
                <button id="confirmDeleteBtn" class="btn-danger">Delete Tag</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('deleteTagConfirmModal');
    
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

function removeEditTagModal() {
    const existingModal = document.getElementById('editTagModal');
    if (existingModal) existingModal.remove();
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

async function addTag(tagData) {
    return await apiPost('addTag', {
        tag_name: tagData.name
    });
}

async function updateTag(tagData) {
    return await apiPost('updateTag', {
        tagID: tagData.tagID,
        tag_name: tagData.name
    });
}

async function deleteTag(tagId) {
    return await apiPost('deleteTag', { tagID: tagId });
}

export function attachTagsEvents(callbacks) {
    const { renderApp, refreshTags } = callbacks;
    
    const addBtn = document.getElementById('addTagBtn');
    const newTagName = document.getElementById('newTagName');
    const messageDiv = document.getElementById('addTagMessage');
    
    const showAddMessage = (message, isError = true) => {
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.className = `form-message ${isError ? 'error' : 'success'}`;
            messageDiv.style.display = 'block';
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }
    };
    
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const name = newTagName?.value.trim();
            
            if (!name) {
                showAddMessage('Tag name is required.');
                newTagName?.focus();
                return;
            }
            
            try {
                const result = await addTag({ name });
                if (newTagName) newTagName.value = '';
                if (refreshTags) await refreshTags();
                if (renderApp) await renderApp();
                showAddMessage(result.message || 'Tag added successfully!', false);
            } catch (error) {
                showAddMessage(error.message);
            }
        });
    }
    
    if (newTagName) {
        newTagName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && addBtn) {
                addBtn.click();
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-tag-btn');
        if (editBtn) {
            const tag = {
                tagID: parseInt(editBtn.dataset.id, 10),
                name: editBtn.dataset.name
            };
            showEditTagModal(
                tag,
                async (updatedTag) => {
                    await updateTag(updatedTag);
                    if (refreshTags) await refreshTags();
                    if (renderApp) await renderApp();
                },
                () => {}
            );
        }
    });
    
    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-tag-btn');
        if (deleteBtn) {
            const tagId = parseInt(deleteBtn.dataset.id, 10);
            const tagName = deleteBtn.dataset.name;
            const usageCount = parseInt(deleteBtn.dataset.usage, 10);
            
            showDeleteTagConfirmModal(tagId, tagName, usageCount, async () => {
                try {
                    const result = await deleteTag(tagId);
                    if (refreshTags) await refreshTags();
                    if (renderApp) await renderApp();
                    if (result.message) {
                        alert(result.message);
                    }
                } catch (error) {
                    alert('Failed to delete tag: ' + error.message);
                }
            });
        }
    });
}