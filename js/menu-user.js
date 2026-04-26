import { state } from './state.js';
import { addToCart, getCartTotal, placeOrder, removeFromCart, updateQuantity } from './cart-user.js';
import { cancelOrder, renderUserOrdersRows } from './order-history-user.js';

export async function loadUserMenuData(loadMenuItems, loadUserOrders) {
    await Promise.all([loadMenuItems(), loadUserOrders(state.currentUser.userID)]);
}

export function renderCustomerPage() {
    // Build category → items map
    const categoryMap = {};
    for (const item of state.menuItems) {
        const category = item.category_name || 'Other';
        if (!categoryMap[category]) categoryMap[category] = [];
        categoryMap[category].push(item);
    }

    // Menu rows HTML only - NO CART DRAWER HTML HERE
    let menuHtml = '';
    for (const [category, items] of Object.entries(categoryMap)) {
        menuHtml += `<div style="color:#ff5722;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin:20px 0 10px;">${escapeHtml(category)}</div>`;
        for (const item of items) {
            const outOfStock = item.stock === 0;
            const inCart = state.customerCart.find(c => c.ItemID === item.itemID);

            menuHtml += `
            <div class="menu-row${outOfStock ? '" style="opacity:0.45;' : '"'}">
                <span>
                    <strong>${escapeHtml(item.name)}</strong><br>
                    <small>P${(item.price / 100).toFixed(2)} | Stock: ${item.stock}</small>
                </span>
                ${outOfStock
                    ? `<button disabled style="opacity:0.5;cursor:not-allowed;">Out of Stock</button>`
                    : inCart
                        ? `<div style="display:flex;align-items:center;gap:8px;">
                            <button class="qtyDownBtn" data-id="${item.itemID}" style="width:30px;height:30px;padding:0;border-radius:50%;background:#fff3ec;border:1.5px solid #ffd4bc;color:#ff5722;font-weight:700;font-size:1rem;cursor:pointer;">&#8722;</button>
                            <span style="font-weight:700;min-width:20px;text-align:center;">${inCart.quantity}</span>
                            <button class="qtyUpBtn" data-id="${item.itemID}" style="width:30px;height:30px;padding:0;border-radius:50%;background:#fff3ec;border:1.5px solid #ffd4bc;color:#ff5722;font-weight:700;font-size:1rem;cursor:pointer;">+</button>
                           </div>`
                        : `<button class="addToCartBtn btn-primary"
                                data-id="${item.itemID}"
                                data-name="${escapeHtml(item.name)}"
                                data-price="${item.price}"
                                data-stock="${item.stock}">Add to Cart</button>`
                }
            </div>`;
        }
    }

    // Cart count badge for dropdown
    const cartCount = state.customerCart.reduce((sum, i) => sum + i.quantity, 0);
    const cartBadgeHtml = cartCount > 0
        ? ` <span style="background:white;color:#ff5722;font-size:0.72rem;font-weight:800;padding:1px 8px;border-radius:50px;margin-left:4px;">${cartCount}</span>`
        : '';

    // Return ONLY the menu page - NO drawers in main content
    return `
    <div class="top-bar">
        <div class="logo">FoodieDash <span>Customer</span></div>
        <div class="user-dropdown-wrapper">
            <button class="user-dropdown-btn" id="userDropdownBtn">
                ${escapeHtml(state.currentUser.username)}
                <span class="dropdown-arrow" id="dropdownArrow">&#9660;</span>
            </button>
            <div class="dropdown-menu" id="dropdownMenu">
                <div class="dropdown-header">My Account</div>
                <button class="dropdown-item" id="viewCartDropBtn">
                    🛒 View Cart${cartBadgeHtml}
                </button>
                <button class="dropdown-item" id="viewOrdersDropBtn">
                    📄 Order History
                </button>
                <button class="dropdown-item danger" id="logoutBtn">
                    🔓 Logout
                </button>
            </div>
        </div>
    </div>

    <div class="panel" style="max-width:700px;margin:0 auto;">
        <h2>Our Menu</h2>
        ${menuHtml || '<p style="text-align:center;color:#aaa;padding:40px 0;">No items available.</p>'}
    </div>`;
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

export function attachCustomerEvents(callbacks) {
    const { renderApp, renderInPlace, logout } = callbacks;

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout(renderApp));

    // User dropdown
    const dropdownBtn = document.getElementById('userDropdownBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const dropdownArrow = document.getElementById('dropdownArrow');

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdownMenu.classList.toggle('open');
            if (dropdownArrow) dropdownArrow.classList.toggle('open', isOpen);
        });
        document.addEventListener('click', () => {
            dropdownMenu.classList.remove('open');
            if (dropdownArrow) dropdownArrow.classList.remove('open');
        });
    }

    // View Cart button - opens cart drawer
    const viewCartBtn = document.getElementById('viewCartDropBtn');
    if (viewCartBtn) {
        viewCartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.remove('open');
            if (dropdownArrow) dropdownArrow.classList.remove('open');
            openCartDrawer(renderInPlace, renderApp);
        });
    }

    // View Orders button - opens order history drawer
    const viewOrdersBtn = document.getElementById('viewOrdersDropBtn');
    if (viewOrdersBtn) {
        viewOrdersBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.remove('open');
            if (dropdownArrow) dropdownArrow.classList.remove('open');
            openOrderHistoryDrawer(renderInPlace, renderApp);
        });
    }

    // Add to cart buttons
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

    // Quantity buttons in menu
    document.querySelectorAll('.qtyUpBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            updateQuantity(parseInt(this.dataset.id, 10), 1, renderInPlace);
        });
    });
    document.querySelectorAll('.qtyDownBtn').forEach((btn) => {
        btn.addEventListener('click', function () {
            updateQuantity(parseInt(this.dataset.id, 10), -1, renderInPlace);
        });
    });
}

// Open cart drawer
function openCartDrawer(renderInPlace, renderApp) {
    // Remove existing cart drawer
    const existingDrawer = document.getElementById('cartDrawer');
    const existingOverlay = document.getElementById('cartOverlay');
    if (existingDrawer) existingDrawer.remove();
    if (existingOverlay) existingOverlay.remove();

    const cartCount = state.customerCart.reduce((sum, i) => sum + i.quantity, 0);
    
    let cartItemsHtml = '';
    if (state.customerCart.length === 0) {
        cartItemsHtml = `
        <p style="text-align:center;color:#aaa;padding:32px 0;">
            <span style="font-size:2rem;display:block;margin-bottom:8px;">🛒</span>
            Your cart is empty
        </p>`;
    } else {
        for (const item of state.customerCart) {
            cartItemsHtml += `
            <div class="cart-item">
                <span>
                    <strong>${escapeHtml(item.name)}</strong><br>
                    <small style="color:#7a6070;">P${(item.price / 100).toFixed(2)} × ${item.quantity}</small>
                </span>
                <span style="display:flex;align-items:center;gap:8px;">
                    <strong style="color:#ff5722;min-width:60px;text-align:right;">P${(item.price * item.quantity / 100).toFixed(2)}</strong>
                    <button class="cart-qty-up" data-id="${item.ItemID}" style="width:32px;height:32px;padding:0;border-radius:50%;background:#fff3ec;border:1.5px solid #ffd4bc;color:#ff5722;font-weight:700;font-size:1.1rem;cursor:pointer;">+</button>
                    <button class="cart-qty-down" data-id="${item.ItemID}" style="width:32px;height:32px;padding:0;border-radius:50%;background:#fff3ec;border:1.5px solid #ffd4bc;color:#ff5722;font-weight:700;font-size:1.1rem;cursor:pointer;">−</button>
                    <button class="cart-remove" data-id="${item.ItemID}" style="width:32px;height:32px;padding:0;border-radius:50%;background:#dc2626;color:white;font-size:1rem;cursor:pointer;border:none;">×</button>
                </span>
            </div>`;
        }
    }

    const drawerHtml = `
    <div id="cartOverlay" class="order-history-overlay open"></div>
    <aside id="cartDrawer" class="order-history-drawer open">
        <div class="order-history-drawer-header">
            <div>
                <div class="order-history-kicker">Your Selection</div>
                <h2>My Cart${cartCount > 0 ? ` <span style="background:#ff7b2c;color:#fff;font-size:0.78rem;padding:2px 10px;border-radius:50px;vertical-align:middle;">${cartCount}</span>` : ''}</h2>
            </div>
            <button class="btn-secondary order-history-close" id="closeCartBtn">Close</button>
        </div>
        <div class="order-history-drawer-body">
            ${cartItemsHtml}
            ${state.customerCart.length > 0 ? `
            <div style="border-top:2px solid #ffe0c4;margin-top:16px;padding-top:16px;">
                <div class="total">Total: P${(getCartTotal() / 100).toFixed(2)}</div>
                <button id="placeOrderBtn" class="btn-order" style="margin-top:16px;">Place Order</button>
            </div>` : ''}
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    // Close handlers
    const closeBtn = document.getElementById('closeCartBtn');
    const overlay = document.getElementById('cartOverlay');
    const closeCart = () => {
        document.getElementById('cartDrawer')?.remove();
        document.getElementById('cartOverlay')?.remove();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (overlay) overlay.addEventListener('click', closeCart);

    // Cart quantity buttons
    document.querySelectorAll('#cartDrawer .cart-qty-up').forEach((btn) => {
        btn.addEventListener('click', function () {
            updateQuantity(parseInt(this.dataset.id, 10), 1, () => {
                openCartDrawer(renderInPlace, renderApp);
                renderInPlace();
            });
        });
    });
    document.querySelectorAll('#cartDrawer .cart-qty-down').forEach((btn) => {
        btn.addEventListener('click', function () {
            updateQuantity(parseInt(this.dataset.id, 10), -1, () => {
                openCartDrawer(renderInPlace, renderApp);
                renderInPlace();
            });
        });
    });
    document.querySelectorAll('#cartDrawer .cart-remove').forEach((btn) => {
        btn.addEventListener('click', function () {
            removeFromCart(parseInt(this.dataset.id, 10), () => {
                openCartDrawer(renderInPlace, renderApp);
                renderInPlace();
            });
        });
    });

    // Place order
    const placeBtn = document.getElementById('placeOrderBtn');
    if (placeBtn) {
        placeBtn.addEventListener('click', async () => {
            await placeOrder(renderApp);
            closeCart();
        });
    }
}

// Open order history drawer
function openOrderHistoryDrawer(renderInPlace, renderApp) {
    // Remove existing drawer
    const existingDrawer = document.getElementById('orderHistoryDrawer');
    const existingOverlay = document.getElementById('orderHistoryOverlay');
    if (existingDrawer) existingDrawer.remove();
    if (existingOverlay) existingOverlay.remove();

    const drawerHtml = `
    <div id="orderHistoryOverlay" class="order-history-overlay open"></div>
    <aside id="orderHistoryDrawer" class="order-history-drawer open">
        <div class="order-history-drawer-header">
            <div>
                <div class="order-history-kicker">Customer</div>
                <h2>My Order History</h2>
            </div>
            <button class="btn-secondary order-history-close" id="closeOrderHistoryBtn">Close</button>
        </div>
        <div class="order-history-drawer-body">
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="text-align:left;padding:12px 8px;">Order ID</th>
                            <th style="text-align:left;padding:12px 8px;">Date</th>
                            <th style="text-align:left;padding:12px 8px;">Total</th>
                            <th style="text-align:left;padding:12px 8px;">Status</th>
                            <th style="text-align:left;padding:12px 8px;">Payment Ref</th>
                            <th style="text-align:left;padding:12px 8px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${renderUserOrdersRows()}</tbody>
                </table>
            </div>
        </div>
    </aside>`;

    document.body.insertAdjacentHTML('beforeend', drawerHtml);

    // Close handlers
    const closeBtn = document.getElementById('closeOrderHistoryBtn');
    const overlay = document.getElementById('orderHistoryOverlay');
    const closeDrawer = () => {
        document.getElementById('orderHistoryDrawer')?.remove();
        document.getElementById('orderHistoryOverlay')?.remove();
    };
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Cancel order buttons
    document.querySelectorAll('#orderHistoryDrawer .cancelOrderBtn').forEach((btn) => {
        btn.addEventListener('click', async function () {
            const orderId = parseInt(this.dataset.id, 10);
            if (confirm('Cancel this order?')) {
                try {
                    await cancelOrder(orderId, renderApp);
                    openOrderHistoryDrawer(renderInPlace, renderApp);
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });
}