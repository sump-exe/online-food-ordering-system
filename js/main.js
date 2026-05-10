// ============================================================
// File: js/main.js
// ============================================================
import { state } from './state.js';
import { checkForResetToken, logout, logoutDueToInactivity, renderAuthScreen } from './login.js';
import { startInactivityMonitor, stopInactivityMonitor } from './inactivity-manager.js';
import {
    attachAdminMenuInventoryEvents,
    loadCategories as loadFoodCategories,
    loadMenuItems,
    loadDeletedMenuItems,
    renderAdminMenuPage,
    renderAdminNavBar,
    renderDeletedMenuItemsSection,
    attachTrashItemEvents,
} from './menu-inventory-admin.js';
import { loadAdminSalesData, renderAdminSalesPage, attachSalesEvents } from './sales-report-admin.js';
import { attachAdminOrderEvents, loadAdminOrders, renderAdminOrdersPage } from './order-history-admin.js';
import { loadUsers, renderAdminUsersPage } from './users-management-admin.js';
import { loadUserOrders } from './order-history-user.js';
import { attachCustomerEvents, renderCustomerPage } from './menu-user.js';
import {
    loadCategories as loadAdminCategories,
    renderAdminCategoriesPage,
    renderDeletedCategoriesSection,
    attachCategoryEvents,
    attachTrashEvents,
    loadDeletedCategories,
} from './category-management-admin.js';
import {
    loadInventoryData,
    renderInventoryPage,
    attachInventoryEvents
} from './stock-inventory.js';
import {
    loadTags,
    renderTagsPage,
    attachTagsEvents,
    renderDeletedTagsSection,
    attachTrashTagEvents,
    loadDeletedTags
} from './tags-management.js';

function getRoot() {
    return document.getElementById('app');
}

function getCurrentSessionKey() {
    if (!state.currentUser) {
        return null;
    }

    return `${state.currentUser.role}:${state.currentUser.userID}`;
}

function syncInactivityMonitor() {
    const sessionKey = getCurrentSessionKey();

    if (!sessionKey) {
        stopInactivityMonitor();
        return;
    }

    startInactivityMonitor(sessionKey, () => {
        logoutDueToInactivity(renderApp);
    });
}

export function setAdminPage(page) {
    state.adminPage = page;
    renderInPlace();
}

function renderAdminPageContent() {
    if (state.adminPage === 'menu') {
        return renderAdminMenuPage();
    }
    if (state.adminPage === 'categories') {
        return renderAdminCategoriesPage();
    }
    if (state.adminPage === 'tags') {
        return renderTagsPage();
    }
    if (state.adminPage === 'orders') {
        return renderAdminOrdersPage();
    }
    if (state.adminPage === 'sales') {
        return renderAdminSalesPage();
    }
    if (state.adminPage === 'inventory') {
        return renderInventoryPage();
    }
    if (state.adminPage === 'users') {
        return renderAdminUsersPage();
    }
    if (state.adminPage === 'trash') {
        // 🔁 Conditionally show sections only if they contain items
        const hasCategories = state.deletedAdminCategories && state.deletedAdminCategories.length > 0;
        const hasMenuItems = state.deletedMenuItems && state.deletedMenuItems.length > 0;
        const hasTags = state.deletedTags && state.deletedTags.length > 0;

        // If absolutely nothing is in trash, show a friendly empty state
        if (!hasCategories && !hasMenuItems && !hasTags) {
            return `
            <div class="admin-page-content">
                <div class="page-header">
                    <h1>🗑️ Trash</h1>
                    <p>Deleted items, categories, and tags are shown here. You can restore or permanently delete them.</p>
                </div>
                <div class="empty-state" style="padding:80px 20px; text-align:center;">
                    <span class="empty-icon" style="font-size:3rem;">🗑️</span>
                    <p style="color:#7a6070; margin-top:16px;">Trash is empty – nothing deleted yet.</p>
                </div>
            </div>`;
        }

        // Build page – show only non‑empty sections
        let html = `
        <div class="admin-page-content">
            <div class="page-header">
                <h1>🗑️ Trash</h1>
                <p>Deleted items, categories, and tags are shown here. You can restore or permanently delete them.</p>
            </div>`;
        if (hasCategories) html += renderDeletedCategoriesSection();
        if (hasMenuItems) html += renderDeletedMenuItemsSection();
        if (hasTags) html += renderDeletedTagsSection();
        html += `</div>`;
        return html;
    }
    return renderAdminMenuPage();
}

function renderAdminLayout() {
    return `
    <div class="admin-layout">
        ${renderAdminNavBar()}
        <main class="admin-main">${renderAdminPageContent()}</main>
    </div>`;
}

export function renderInPlace() {
    syncInactivityMonitor();

    const root = getRoot();
    if (!root) {
        return;
    }

    if (!state.currentUser) {
        renderAuthScreen(root, { renderApp, renderInPlace });
        return;
    }

    // Save customer scroll position and active category before destroying the DOM
    if (state.currentUser && state.currentUser.role === 'customer') {
        const activeLink = document.querySelector('.customer-category-link.active');
        state.activeCustomerCategory = activeLink ? activeLink.getAttribute('href').substring(1) : null;
        state.customerScrollPos = window.scrollY;
    }

    if (state.currentUser.role === 'admin') {
        root.innerHTML = renderAdminLayout();
        attachAdminMenuInventoryEvents({ renderApp, setAdminPage, logout });

        if (state.adminPage === 'categories') {
            attachCategoryEvents({
                renderApp,
                refreshCategories: async () => {
                    await loadAdminCategories();
                },
                setAdminMessage: (msg, type) => {
                    console.log(`${type}: ${msg}`);
                }
            });
        }

        if (state.adminPage === 'tags') {
            attachTagsEvents({
                renderApp,
                refreshTags: async () => {
                    await loadTags();
                }
            });
        }

        if (state.adminPage === 'orders') {
            attachAdminOrderEvents({ renderApp, renderInPlace });
        }

        if (state.adminPage === 'sales') {
            attachSalesEvents({
                renderApp,
                renderInPlace,
                loadSalesData: async () => {
                    await loadAdminSalesData();
                }
            });
        }

        if (state.adminPage === 'inventory') {
            attachInventoryEvents({
                renderApp,
                refreshInventory: async () => {
                    await loadInventoryData();
                }
            });
        }

        if (state.adminPage === 'trash') {
            attachTrashEvents({
                renderApp,
                refreshTrash: async () => {
                    await loadDeletedCategories();
                }
            });
            attachTrashItemEvents({
                renderApp,
                refreshDeletedItems: async () => {
                    await loadDeletedMenuItems();
                }
            });
            attachTrashTagEvents({
                renderApp,
                refreshDeletedTags: async () => {
                    await loadDeletedTags();
                }
            });
        }
        return;
    }

    // Customer page
    root.innerHTML = renderCustomerPage();
    attachCustomerEvents({ renderApp, renderInPlace, logout });
}

export async function renderApp() {
    syncInactivityMonitor();

    const root = getRoot();
    if (!root) {
        return;
    }

    if (!state.currentUser) {
        renderInPlace();
        return;
    }

    const sessionKey = getCurrentSessionKey();

    if (state.firstLoad) {
        root.innerHTML = '<div style="text-align:center;padding:60px;color:#999;">Loading...</div>';
    }

    try {
        if (state.currentUser.role === 'admin') {
            await Promise.all([
                loadMenuItems(),
                loadFoodCategories(),
                loadAdminCategories(),
                loadTags(),
                loadAdminOrders(),
                loadAdminSalesData(),
                loadUsers(),
                loadInventoryData(),
                loadDeletedCategories(),
                loadDeletedMenuItems(),
                loadDeletedTags(),
            ]);
        } else {
            console.log('Loading customer data...');
            await Promise.all([
                loadMenuItems(),
                loadUserOrders(state.currentUser.userID),
                loadFoodCategories(),
            ]);
        }
    } catch (error) {
        console.error('Customer data load warning:', error);
        if (!state.currentUser || state.currentUser.role !== 'admin') {
            state.menuItems = [];
            state.orders = [];
        }
    }

    if (!state.currentUser || getCurrentSessionKey() !== sessionKey) {
        renderInPlace();
        return;
    }

    state.firstLoad = false;
    renderInPlace();
    console.log('Customer UI rendered, menuItems:', state.menuItems.length);
}

export async function initializeApp() {
    await checkForResetToken(renderInPlace);
    renderApp();
}
