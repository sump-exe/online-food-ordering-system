import { state } from './state.js';
import { addToCart, getCartTotal, placeOrder, removeFromCart, updateQuantity } from './cart-user.js';
import { cancelOrder, renderUserOrdersRows } from './order-history-user.js';

export async function loadUserMenuData(loadMenuItems, loadUserOrders) {
    await Promise.all([loadMenuItems(), loadUserOrders(state.currentUser.userID)]);
}

export function renderCustomerPage() {
    const categoryMap = {};
    for (const item of state.menuItems.filter((entry) => entry.stock > 0)) {
        const category = item.category_name || 'Other';
        if (!categoryMap[category]) {
            categoryMap[category] = [];
        }
        categoryMap[category].push(item);
    }

    let menuHtml = '';
    for (const [category, items] of Object.entries(categoryMap)) {
        menuHtml += `<div style="margin-bottom:12px;"><strong style="color:#ff5722;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em;">${category}</strong></div>`;
        for (const item of items) {
            menuHtml += (
                '<div class="menu-row">' +
                    `<span><strong>${item.name}</strong><br><small>P${(item.price / 100).toFixed(2)} | Stock: ${item.stock}</small></span>` +
                    `<button class="addToCartBtn" data-id="${item.itemID}" data-name="${item.name}" data-price="${item.price}" data-stock="${item.stock}">Add to Cart</button>` +
                '</div>'
            );
        }
    }

    let cartHtml = '';
    if (state.customerCart.length === 0) {
        cartHtml = '<p style="color:gray;text-align:center;padding:20px;">Your cart is empty</p>';
    } else {
        for (const item of state.customerCart) {
            cartHtml += (
                '<div class="cart-item">' +
                    `<span><b>${item.name}</b> x${item.quantity}</span>` +
                    `<span>P${(item.price * item.quantity / 100).toFixed(2)} ` +
                    `<button class="qtyUp" data-id="${item.ItemID}">+</button> ` +
                    `<button class="qtyDown" data-id="${item.ItemID}">-</button> ` +
                    `<button class="removeCart" data-id="${item.ItemID}">Remove</button></span>` +
                '</div>'
            );
        }
    }

    const orderHistoryDrawer = (
        `<div class="order-history-overlay${state.isOrderHistoryOpen ? ' open' : ''}" id="orderHistoryOverlay"></div>` +
        `<aside class="order-history-drawer${state.isOrderHistoryOpen ? ' open' : ''}" id="orderHistoryDrawer">` +
            '<div class="order-history-drawer-header">' +
                '<div>' +
                    '<div class="order-history-kicker">Customer</div>' +
                    '<h2>My Order History</h2>' +
                '</div>' +
                '<button class="order-history-close" id="closeOrderHistoryBtn">Close</button>' +
            '</div>' +
            '<div class="order-history-drawer-body">' +
                '<div style="overflow-x:auto;">' +
                    '<table><thead><tr><th>Order ID</th><th>Date</th><th>Total</th><th>Status</th><th>Payment Ref</th><th>Action</th></tr></thead>' +
                    `<tbody>${renderUserOrdersRows()}</tbody>` +
                    '</table>' +
                '</div>' +
            '</div>' +
        '</aside>'
    );

    return (
        '<div class="top-bar">' +
            '<div class="logo">FoodieDash <span>Customer</span></div>' +
            '<div class="user-dropdown-wrapper">' +
                '<button class="user-dropdown-btn" id="userDropdownBtn">' +
                    `${state.currentUser.username} <span class="dropdown-arrow" id="dropdownArrow">▼</span>` +
                '</button>' +
                '<div class="dropdown-menu" id="dropdownMenu">' +
                    '<div class="dropdown-header">My Account</div>' +
                    '<button class="dropdown-item" id="viewOrdersDropBtn">Order History</button>' +
                    '<button class="dropdown-item danger" id="logoutBtn">Logout</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="grid-2col">' +
            '<div class="card"><h3>Our Menu</h3>' +
                (menuHtml || '<p style="text-align:center;">No items available</p>') +
            '</div>' +
            '<div class="card"><h3>Your Cart</h3>' +
                `<div>${cartHtml}</div>` +
                `<div class="total">Total: P${(getCartTotal() / 100).toFixed(2)}</div>` +
                '<button id="placeOrderBtn" class="btn-order">Place Order</button>' +
            '</div>' +
        '</div>' +
        orderHistoryDrawer
    );
}

export function attachCustomerEvents(callbacks) {
    const { renderApp, renderInPlace, logout } = callbacks;

    const dropdownBtn = document.getElementById('userDropdownBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const dropdownArrow = document.getElementById('dropdownArrow');
    const logoutBtn = document.getElementById('logoutBtn');
    const orderHistoryOverlay = document.getElementById('orderHistoryOverlay');
    const closeOrderHistoryBtn = document.getElementById('closeOrderHistoryBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => logout(renderApp));
    }

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = dropdownMenu.classList.toggle('open');
            if (dropdownArrow) {
                dropdownArrow.classList.toggle('open', isOpen);
            }
        });

        document.addEventListener('click', () => {
            dropdownMenu.classList.remove('open');
            if (dropdownArrow) {
                dropdownArrow.classList.remove('open');
            }
        });
    }

    const viewOrdersBtn = document.getElementById('viewOrdersDropBtn');
    if (viewOrdersBtn) {
        viewOrdersBtn.addEventListener('click', () => {
            if (dropdownMenu) {
                dropdownMenu.classList.remove('open');
            }
            if (dropdownArrow) {
                dropdownArrow.classList.remove('open');
            }
            state.isOrderHistoryOpen = true;
            renderInPlace();
        });
    }

    if (orderHistoryOverlay) {
        orderHistoryOverlay.addEventListener('click', () => {
            state.isOrderHistoryOpen = false;
            renderInPlace();
        });
    }

    if (closeOrderHistoryBtn) {
        closeOrderHistoryBtn.addEventListener('click', () => {
            state.isOrderHistoryOpen = false;
            renderInPlace();
        });
    }

    document.querySelectorAll('.addToCartBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            addToCart({
                itemID: parseInt(this.dataset.id, 10),
                name: this.dataset.name,
                price: parseInt(this.dataset.price, 10),
                stock: parseInt(this.dataset.stock, 10),
            }, renderInPlace);
        });
    });

    document.querySelectorAll('.qtyUp').forEach((btn) => {
        btn.addEventListener('click', function () {
            updateQuantity(parseInt(this.dataset.id, 10), 1, renderInPlace);
        });
    });

    document.querySelectorAll('.qtyDown').forEach((btn) => {
        btn.addEventListener('click', function () {
            updateQuantity(parseInt(this.dataset.id, 10), -1, renderInPlace);
        });
    });

    document.querySelectorAll('.removeCart').forEach((btn) => {
        btn.addEventListener('click', function () {
            removeFromCart(parseInt(this.dataset.id, 10), renderInPlace);
        });
    });

    const placeBtn = document.getElementById('placeOrderBtn');
    if (placeBtn) {
        placeBtn.addEventListener('click', () => placeOrder(renderApp));
    }

    document.querySelectorAll('.cancelOrderBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            cancelOrder(parseInt(this.dataset.id, 10), renderApp);
        });
    });
}
