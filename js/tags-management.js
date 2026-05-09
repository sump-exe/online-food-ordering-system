// ============================================================
// File: js/tags-management.js (updated renderDeletedTagsSection)
// ============================================================
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

export async function loadDeletedTags() {
    try {
        const deletedTags = await apiGet('getDeletedTags');
        state.deletedTags = deletedTags || [];
        return state.deletedTags;
    } catch (error) {
        console.error('Failed to load deleted tags:', error);
        state.deletedTags = [];
        return [];
    }
}

export function renderTagsPage() {
    const tags = state.tags || [];
    const midPoint = Math.ceil(tags.length / 2);
    const leftColumnTags = tags.slice(0, midPoint);
    const rightColumnTags = tags.slice(midPoint);

    const renderTagColumn = (tagList) => {
        if (!tagList || tagList.length === 0) {
            return '';
        }

        return tagList.map((tag) => `
            <div class="tag-card" data-tag-id="${tag.tagID}">
                <div class="tag-content">
                    <div class="tag-name-wrapper">
                        <span class="tag-icon">&#127991;&#65039;</span>
                        <span class="tag-name">${escapeHtml(tag.tag_name)}</span>
                        ${tag.usage_count > 0 ? `<span class="tag-usage-badge">${tag.usage_count} items</span>` : ''}
                        <span class="tag-visibility-badge ${tag.is_visible ? 'visibility-visible' : 'visibility-hidden'}">
                            ${tag.is_visible ? 'Visible' : 'Hidden'}
                        </span>
                    </div>
                </div>
                <div class="tag-actions">
                    <button
                        class="toggle-visibility-btn small-btn ${tag.is_visible ? 'btn-secondary' : 'btn-success'}"
                        data-id="${tag.tagID}"
                        data-visible="${tag.is_visible ? 1 : 0}"
                        type="button"
                    >
                        ${tag.is_visible ? 'Hide' : 'Show'}
                    </button>
                    <button
                        class="edit-tag-btn btn-secondary small-btn"
                        data-id="${tag.tagID}"
                        data-name="${escapeHtml(tag.tag_name)}"
                        type="button"
                    >
                        Edit
                    </button>
                    <button
                        class="delete-tag-btn btn-danger small-btn"
                        data-id="${tag.tagID}"
                        data-name="${escapeHtml(tag.tag_name)}"
                        data-usage="${tag.usage_count}"
                        type="button"
                    >
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    };

    return `
    <style>
        .tag-visibility-badge {
            display: inline-block;
            margin-left: 8px;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 0.7rem;
            font-weight: 700;
        }
        .visibility-visible {
            background: #d1fae5;
            color: #065f46;
        }
        .visibility-hidden {
            background: #fee2e2;
            color: #991b1b;
        }
        .toggle-visibility-btn {
            min-width: 62px;
        }
    </style>
    <div class="admin-page-content">
        <div class="page-header">
            <h1>&#127991;&#65039; Tags Management</h1>
            <p>Create and manage tags for menu items. Visibility controls whether users see them.</p>
        </div>

        <div class="panel">
            <h2>Add New Tag</h2>
            <div class="add-tag-form">
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label>Tag Name <span style="color: #dc2626;">*</span></label>
                        <input type="text" id="newTagName" placeholder="e.g., Popular, New, Sale" maxlength="100" autocomplete="off">
                    </div>
                    <div class="form-group" style="flex: 0;">
                        <button id="addTagBtn" class="btn-primary" style="margin-top: 28px;" type="button">
                            Add Tag
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
                    <span class="empty-icon">&#127991;&#65039;</span>
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

// ========== TRASH – TAGS SECTION (only if there are items) ==========
export function renderDeletedTagsSection() {
    const tags = state.deletedTags || [];
    if (tags.length === 0) return '';

    const midPoint = Math.ceil(tags.length / 2);
    const leftColumnTags = tags.slice(0, midPoint);
    const rightColumnTags = tags.slice(midPoint);

    const renderTagColumn = (tagList) => {
        return tagList.map((tag) => `
            <div class="tag-card" style="flex-direction: column; align-items: flex-start;">
                <div class="tag-content">
                    <div class="tag-name-wrapper">
                        <span class="tag-icon">&#127991;&#65039;</span>
                        <span class="tag-name">${escapeHtml(tag.tag_name)}</span>
                        ${tag.usage_count > 0 ? `<span class="tag-usage-badge">${tag.usage_count} items</span>` : ''}
                    </div>
                    <div style="font-size:0.8rem; color:#7a6070; margin-top:4px;">
                        Deleted: ${tag.deleted_at ? new Date(tag.deleted_at).toLocaleString() : '-'}
                    </div>
                </div>
                <div class="tag-actions" style="margin-top:10px; width:100%; justify-content: flex-end;">
                    <button class="restoreTagBtn btn-success small-btn" data-id="${tag.tagID}" data-name="${escapeHtml(tag.tag_name)}">
                        ↺ Restore
                    </button>
                    <button class="permanentDeleteTagBtn btn-danger small-btn" data-id="${tag.tagID}" data-name="${escapeHtml(tag.tag_name)}">
                        ⚠️ Delete Forever
                    </button>
                </div>
            </div>
        `).join('');
    };

    return `
    <div class="panel" style="margin-top:32px;">
        <h2>🗑️ Deleted Tags</h2>
        <div class="tags-two-columns">
            <div class="tags-column">
                ${renderTagColumn(leftColumnTags)}
            </div>
            <div class="tags-column">
                ${renderTagColumn(rightColumnTags)}
            </div>
        </div>
    </div>`;
}

function showEditTagModal(tag, onSave, onClose) {
    removeEditTagModal();

    const modalHtml = `
    <div id="editTagModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h2>Edit Tag</h2>
                <button class="modal-close" data-close type="button">&times;</button>
            </div>
            <div class="modal-body">
                <div id="modalMessage" class="modal-message" style="display: none;"></div>
                <div class="form-group">
                    <label>Tag Name <span style="color: #dc2626;">*</span></label>
                    <input type="text" id="editTagName" value="${escapeHtml(tag.name)}" maxlength="100" autocomplete="off">
                </div>
            </div>
            <div class="modal-footer">
                <button id="cancelModalBtn" class="btn-secondary" data-close type="button">Cancel</button>
                <button id="saveTagBtn" class="btn-primary" type="button">Save Changes</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('editTagModal');
    const nameInput = document.getElementById('editTagName');
    const saveBtn = document.getElementById('saveTagBtn');
    const messageDiv = document.getElementById('modalMessage');
    const originalName = tag.name;

    const showMessage = (message, isError = true) => {
        messageDiv.textContent = message;
        messageDiv.className = `modal-message ${isError ? 'error' : 'success'}`;
        messageDiv.style.display = 'block';
    };

    const closeModal = () => {
        document.removeEventListener('keydown', handleKeyDown);
        modal.remove();
        if (onClose) {
            onClose();
        }
    };

    const attemptClose = () => {
        if (nameInput.value.trim() !== originalName) {
            const shouldClose = window.confirm('There are still some unsaved changes, are you sure you want to exit?');
            if (!shouldClose) {
                return;
            }
        }

        closeModal();
    };

    const handleSave = async () => {
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
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            attemptClose();
        }

        if (event.key === 'Enter' && document.activeElement === nameInput) {
            event.preventDefault();
            handleSave();
        }
    };

    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.hasAttribute('data-close')) {
            attemptClose();
        }
    });

    saveBtn.addEventListener('click', handleSave);
    document.addEventListener('keydown', handleKeyDown);

    nameInput.focus();
    nameInput.select();
}

function showDeleteTagConfirmModal(tagId, tagName, usageCount, onConfirm) {
    removeDeleteTagConfirmModal();

    const modalHtml = `
    <div id="deleteTagConfirmModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h2>Confirm Delete</h2>
                <button class="modal-close" id="closeDeleteModalBtn" type="button">&times;</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to move tag <strong>"${escapeHtml(tagName)}"</strong> to Trash?</p>
                ${usageCount > 0 ? `
                    <div class="warning-box">
                        <span>&#9888;&#65039;</span>
                        <p>This tag is currently used by <strong>${usageCount}</strong> menu item(s). Deleting it will remove this tag from those items.</p>
                    </div>
                ` : ''}
                <p style="color: #7a6070; font-size: 0.85rem;">You can restore it later from the Trash.</p>
            </div>
            <div class="modal-footer">
                <button id="cancelDeleteBtn" class="btn-secondary" type="button">Cancel</button>
                <button id="confirmDeleteBtn" class="btn-danger" type="button">Move to Trash</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('deleteTagConfirmModal');
    const closeBtn = document.getElementById('closeDeleteModalBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    const closeModal = () => {
        document.removeEventListener('keydown', handleKeyDown);
        modal.remove();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    document.addEventListener('keydown', handleKeyDown);
}

function removeEditTagModal() {
    const existingModal = document.getElementById('editTagModal');
    if (existingModal) {
        existingModal.remove();
    }
}

function removeDeleteTagConfirmModal() {
    const existingModal = document.getElementById('deleteTagConfirmModal');
    if (existingModal) {
        existingModal.remove();
    }
}

function escapeHtml(str) {
    if (!str) {
        return '';
    }

    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function addTag(tagData) {
    return apiPost('addTag', {
        tag_name: tagData.name,
    });
}

async function updateTag(tagData) {
    return apiPost('updateTag', {
        tagID: tagData.tagID,
        tag_name: tagData.name,
    });
}

async function updateTagVisibility(tagId, isVisible) {
    return apiPost('updateTagVisibility', {
        tagID: tagId,
        is_visible: isVisible,
    });
}

async function deleteTag(tagId) {
    return apiPost('deleteTag', {
        tagID: tagId,
    });
}

async function restoreTag(tagId) {
    return apiPost('restoreTag', {
        tagID: tagId,
    });
}

async function permanentlyDeleteTag(tagId) {
    return apiPost('permanentlyDeleteTag', {
        tagID: tagId,
    });
}

async function rerenderTags(renderApp, refreshTags) {
    if (renderApp) {
        await renderApp();
        return;
    }

    if (refreshTags) {
        await refreshTags();
    }
}

export function attachTagsEvents(callbacks) {
    const { renderApp, refreshTags } = callbacks;
    const addBtn = document.getElementById('addTagBtn');
    const newTagName = document.getElementById('newTagName');
    const messageDiv = document.getElementById('addTagMessage');

    const showAddMessage = (message, isError = true) => {
        if (!messageDiv) {
            return;
        }

        messageDiv.textContent = message;
        messageDiv.className = `form-message ${isError ? 'error' : 'success'}`;
        messageDiv.style.display = 'block';
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
                await addTag({ name });
                if (newTagName) {
                    newTagName.value = '';
                }
                await rerenderTags(renderApp, refreshTags);
            } catch (error) {
                showAddMessage(error.message);
            }
        });
    }

    if (newTagName) {
        newTagName.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && addBtn) {
                event.preventDefault();
                addBtn.click();
            }
        });
    }

    document.querySelectorAll('.toggle-visibility-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const tagId = parseInt(button.dataset.id, 10);
            const currentVisible = button.dataset.visible === '1';

            try {
                await updateTagVisibility(tagId, !currentVisible);
                await rerenderTags(renderApp, refreshTags);
            } catch (error) {
                window.alert('Failed to update visibility: ' + error.message);
            }
        });
    });

    document.querySelectorAll('.edit-tag-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const tag = {
                tagID: parseInt(button.dataset.id, 10),
                name: button.dataset.name,
            };

            showEditTagModal(
                tag,
                async (updatedTag) => {
                    await updateTag(updatedTag);
                    await rerenderTags(renderApp, refreshTags);
                },
                () => {}
            );
        });
    });

    document.querySelectorAll('.delete-tag-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const tagId = parseInt(button.dataset.id, 10);
            const tagName = button.dataset.name;
            const usageCount = parseInt(button.dataset.usage, 10);

            showDeleteTagConfirmModal(tagId, tagName, usageCount, async () => {
                try {
                    const result = await deleteTag(tagId);
                    await rerenderTags(renderApp, refreshTags);
                    if (result.message) {
                        window.alert(result.message);
                    }
                } catch (error) {
                    window.alert('Failed to delete tag: ' + error.message);
                }
            });
        });
    });
}

export function attachTrashTagEvents(callbacks) {
    const { renderApp, refreshDeletedTags } = callbacks;

    document.querySelectorAll('.restoreTagBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tagId = parseInt(btn.dataset.id, 10);
            try {
                const result = await restoreTag(tagId);
                alert(result.message);
                if (refreshDeletedTags) await refreshDeletedTags();
                if (renderApp) await renderApp();
            } catch (error) {
                alert(error.message);
            }
        });
    });

    document.querySelectorAll('.permanentDeleteTagBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tagId = parseInt(btn.dataset.id, 10);
            const tagName = btn.dataset.name;
            if (!confirm(`Permanently delete tag "${tagName}"? This action cannot be undone.`)) return;
            try {
                const result = await permanentlyDeleteTag(tagId);
                alert(result.message);
                if (refreshDeletedTags) await refreshDeletedTags();
                if (renderApp) await renderApp();
            } catch (error) {
                alert(error.message);
            }
        });
    });
}