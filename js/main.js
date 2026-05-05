import { state } from './state.js';
import { checkForResetToken, logout, renderAuthScreen } from './login.js';
import {
    attachAdminMenuInventoryEvents,
    loadCategories as loadFoodCategories,
    loadMenuItems,
    loadDeletedMenuItems,          // new
    renderAdminMenuPage,
    renderAdminNavBar,
    renderDeletedMenuItemsSection, // new
    attachTrashItemEvents,         // new
} from './menu-inventory-admin.js';
import { loadAdminSalesData, renderAdminSalesPage, attachSalesEvents } from './sales-report-admin.js';
import { attachAdminOrderEvents, loadAdminOrders, renderAdminOrdersPage } from './order-history-admin.js';
import { loadUsers, renderAdminUsersPage } from './users-management-admin.js';
import { loadUserOrders } from './order-history-user.js';
import { attachCustomerEvents, renderCustomerPage } from './menu-user.js';
import {
    loadCategories as loadAdminCategories,
    renderAdminCategoriesPage,
    attachCategoryEvents,
    renderAdminTrashPage,
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
    attachTagsEvents
} from './tags-management.js';

function getRoot() {
    return document.getElementById('app');
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
        return renderAdminTrashPage() + renderDeletedMenuItemsSection();
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
    const root = getRoot();
    if (!root) {
        return;
    }

    if (!state.currentUser) {
        renderAuthScreen(root, { renderApp, renderInPlace });
        return;
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
        }
        return;
    }

    root.innerHTML = renderCustomerPage();
    attachCustomerEvents({ renderApp, renderInPlace, logout });
}

export async function renderApp() {
    const root = getRoot();
    if (!root) {
        return;
    }

    if (!state.currentUser) {
        renderInPlace();
        return;
    }

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
                loadDeletedMenuItems(),   // load deleted items
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
        if (state.currentUser.role !== 'admin') {
            state.menuItems = [];
            state.orders = [];
        }
    }

    state.firstLoad = false;
    renderInPlace();
    console.log('Customer UI rendered, menuItems:', state.menuItems.length);
}

export async function initializeApp() {
    await checkForResetToken(renderInPlace);
    renderApp();
}