import { state } from './state.js';
import { checkForResetToken, logout, renderAuthScreen } from './login.js';
import {
    attachAdminMenuInventoryEvents,
    loadCategories as loadFoodCategories,
    loadMenuItems,
    renderAdminMenuPage,
    renderAdminNavBar,
} from './menu-inventory-admin.js';
import { loadAdminSalesData, renderAdminSalesPage } from './sales-report-admin.js';
import { attachAdminOrderEvents, loadAdminOrders, renderAdminOrdersPage } from './order-history-admin.js';
import { loadUsers, renderAdminUsersPage } from './users-management-admin.js';
import { loadUserOrders } from './order-history-user.js';
import { attachCustomerEvents, renderCustomerPage } from './menu-user.js';
<<<<<<< HEAD
import { 
    loadCategories as loadAdminCategories, 
    renderAdminCategoriesPage, 
    attachCategoryEvents 
} from './category-management-admin.js';
=======
import { loadCartFromDb } from './cart-user.js';

function syncHistoryState() {
    if (typeof window === 'undefined') {
        return;
    }

    if (state.currentUser) {
        if (!window.history.state?.appAuthLocked) {
            window.history.pushState({ appAuthLocked: true }, '', window.location.href);
        }
        return;
    }

    if (!window.history.state) {
        window.history.replaceState({ appAuthLocked: false }, '', window.location.href);
        return;
    }

    if (window.history.state.appAuthLocked) {
        window.history.replaceState({ appAuthLocked: false }, '', window.location.href);
    }
}

function attachHistoryGuard() {
    if (typeof window === 'undefined' || window.__foodieDashHistoryGuardAttached) {
        return;
    }

    window.__foodieDashHistoryGuardAttached = true;
    syncHistoryState();

    window.addEventListener('popstate', () => {
        if (!state.currentUser) {
            return;
        }

        window.history.pushState({ appAuthLocked: true }, '', window.location.href);
        renderInPlace();
    });
}
>>>>>>> 71abe9111994d7c8321be6b0b6c878590d9d5c70

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
    if (state.adminPage === 'orders') {
        return renderAdminOrdersPage();
    }
    if (state.adminPage === 'sales') {
        return renderAdminSalesPage();
    }
    if (state.adminPage === 'users') {
        return renderAdminUsersPage();
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
        
        if (state.adminPage === 'orders') {
            attachAdminOrderEvents(renderApp);
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
                loadAdminOrders(),
                loadAdminSalesData(),
                loadUsers(),
            ]);
        } else {
            await Promise.all([
                loadMenuItems(),
                loadUserOrders(state.currentUser.userID),
                loadCartFromDb(),
            ]);
        }
    } catch (error) {
        root.innerHTML = `<div class="error-message" style="margin:40px auto;max-width:500px;">Failed to load data: ${error.message}</div>`;
        return;
    }

    state.firstLoad = false;
    renderInPlace();
}

export async function initializeApp() {
    await checkForResetToken(renderInPlace);
    renderApp();
}