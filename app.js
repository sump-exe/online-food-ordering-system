// ============================================================
//  FoodieDash – Frontend (Database-connected version)
//  All data is now read/written via api.php instead of localStorage.
// ============================================================

const API = 'api.php';

// ── Tiny fetch wrappers ──────────────────────────────────────

async function apiGet(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API}?${qs}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}

async function apiPost(action, body = {}) {
    const res = await fetch(`${API}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
}

// ============================================================
//  STATE
// ============================================================
let currentUser  = null;
let customerCart = [];
let currentPage  = 'login';   // 'login' | 'register'
let adminPage    = 'menu';    // 'menu' | 'inventory' | 'sales-report' | 'orders' | 'sales'

// In-memory cache (refreshed on each renderApp call)
let _menuItems  = [];
let _orders     = [];
let _orderStats = { Preparing: 0, Complete: 0, Cancelled: 0 };
let _dailySales = { totalSales: 0, orderCount: 0 };
let _monthlySales = { totalSales: 0, orderCount: 0 };
let _salesByDate     = [];
let _salesByCustomer = [];

// ============================================================
//  DATA LOADERS  (all return Promises)
// ============================================================

async function loadMenuItems() {
    _menuItems = await apiGet('getMenuItems');
}

async function loadOrders(customerId = null) {
    const params = customerId ? { customerId } : {};
    _orders = await apiGet('getOrders', params);
}

async function loadAdminExtras() {
    [_orderStats, _dailySales, _monthlySales, _salesByDate, _salesByCustomer] = await Promise.all([
        apiGet('getOrderStats'),
        apiGet('getSalesReport', { period: 'daily' }),
        apiGet('getSalesReport', { period: 'monthly' }),
        apiGet('getSalesByDate'),
        apiGet('getSalesByCustomer'),
    ]);
}

// ============================================================
//  AUTH
// ============================================================

async function login(username, password) {
    const data = await apiGet('login', { username, password });
    if (data.user) {
        currentUser = data.user;
        return true;
    }
    return false;
}

function logout() {
    currentUser  = null;
    customerCart = [];
    currentPage  = 'login';
    adminPage    = 'menu';
    renderApp();
}

async function registerUser(username, password) {
    try {
        const data = await apiPost('register', { username, password });
        return { success: true, message: data.message };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ============================================================
//  CART (still in-memory – no DB call needed until checkout)
// ============================================================

function addToCart(item) {
    const existing = customerCart.find(i => i.ItemID === item.itemID);
    if (existing) {
        if (existing.quantity + 1 > item.stock) { alert('Only ' + item.stock + ' items left in stock!'); return; }
        existing.quantity += 1;
    } else {
        if (item.stock === 0) { alert('Item is out of stock!'); return; }
        customerCart.push({ ItemID: item.itemID, name: item.name, price: item.price, quantity: 1, maxStock: item.stock });
    }
    renderApp();
}

function removeFromCart(itemId) {
    customerCart = customerCart.filter(i => i.ItemID !== itemId);
    renderApp();
}

function updateQuantity(itemId, delta) {
    const idx = customerCart.findIndex(i => i.ItemID === itemId);
    if (idx !== -1) {
        const newQty     = customerCart[idx].quantity + delta;
        const maxStock   = customerCart[idx].maxStock;
        if (newQty <= 0)           { customerCart.splice(idx, 1); }
        else if (newQty > maxStock) { alert('Cannot add more than ' + maxStock + ' items'); return; }
        else                        { customerCart[idx].quantity = newQty; }
        renderApp();
    }
}

function getCartTotal() {
    return customerCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
}

// ============================================================
//  ORDERS
// ============================================================

async function placeOrder() {
    if (!currentUser || currentUser.role !== 'customer') { alert('Please login as customer'); return; }
    if (customerCart.length === 0) { alert('Cart is empty'); return; }
    try {
        const totalAmount = getCartTotal();
        const cartItems   = customerCart.map(c => ({
            itemID:   c.ItemID,
            quantity: c.quantity,
            price:    c.price,
        }));
        const result = await apiPost('createOrder', {
            customerId:   currentUser.userID,
            totalPayment: totalAmount,
            cartItems,
        });
        customerCart = [];
        alert(
            'Order #' + result.OrderID + ' placed!\n' +
            'Total: ₱' + (totalAmount / 100).toFixed(2) + '\n' +
            'Payment Reference: ' + result.referenceNumber
        );
        renderApp();
    } catch (e) { alert('Error: ' + e.message); }
}

async function cancelOrder(orderId) {
    if (!confirm('Cancel this order?')) return;
    try {
        await apiPost('updateOrderStatus', { orderId, status: 'Cancelled' });
        alert('Order cancelled');
        renderApp();
    } catch (e) { alert(e.message); }
}

async function updateOrderStatus(orderId, newStatus) {
    await apiPost('updateOrderStatus', { orderId, status: newStatus });
}

async function updateStock(itemId, newStock) {
    await apiPost('updateStock', { itemId, stock: newStock });
}

// ============================================================
//  PAGE NAVIGATION
// ============================================================

function showRegisterPage() { currentPage = 'register'; renderApp(); }
function showLoginPage()    { currentPage = 'login';    renderApp(); }
function setAdminPage(page) { adminPage   = page;       renderApp(); }

// ============================================================
//  RENDER HELPERS
// ============================================================

function renderLogin() {
    return `
    <div class="glass-card" style="max-width:500px;margin:60px auto;padding:40px;">
        <div style="text-align:center;margin-bottom:30px;">
            <span style="font-size:3.5rem;">🍔🍕</span>
            <h1 style="color:#ff5722;margin-top:10px;">FoodieDash</h1>
            <p style="color:#666;">Database-Powered Food Ordering System</p>
        </div>
        <div id="loginMessage"></div>
        <div class="form-group"><label>Username</label><input type="text" id="loginUsername" placeholder="Enter your username"></div>
        <div class="form-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter your password"></div>
        <button id="doLoginBtn" class="btn-primary" style="width:100%;padding:14px;">Sign In</button>
        <div style="text-align:center;margin-top:25px;">
            <span style="color:#666;">Don't have an account? </span>
            <a class="hyperlink" id="goToRegisterLink">Create an Account</a>
        </div>
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ffe0c4;">
            <p style="font-size:0.75rem;color:#888;text-align:center;">
                <strong>Demo Accounts:</strong><br>
                Admin: admin / Admin123!<br>
                Customer: john_doe / JohnDoe123!
            </p>
        </div>
    </div>`;
}

function renderRegister() {
    return `
    <div class="glass-card" style="max-width:500px;margin:60px auto;padding:40px;">
        <div style="text-align:center;margin-bottom:30px;">
            <span style="font-size:3rem;">📝</span>
            <h1 style="color:#ff5722;margin-top:10px;">Create Account</h1>
            <p style="color:#666;">Join FoodieDash today</p>
        </div>
        <div id="registerMessage"></div>
        <div class="form-group"><label>Username</label><input type="text" id="regUsername" placeholder="Choose a username"></div>
        <div class="form-group"><label>Password</label><input type="password" id="regPassword" placeholder="Create a password"></div>
        <div class="form-group"><label>Confirm Password</label><input type="password" id="regConfirmPassword" placeholder="Confirm your password"></div>
        <div style="background:#fff5e6;padding:12px;border-radius:12px;margin-bottom:20px;">
            <small style="color:#ff5722;">📌 Password Requirements:</small><br>
            <small style="color:#666;">• At least 1 uppercase letter (A-Z)</small><br>
            <small style="color:#666;">• At least 1 special character (!@#$%^&*())</small>
        </div>
        <button id="doRegisterBtn" class="btn-primary" style="width:100%;padding:14px;">Create Account</button>
        <div style="text-align:center;margin-top:25px;">
            <span style="color:#666;">Already have an account? </span>
            <a class="hyperlink" id="goToLoginLink">Back to Login</a>
        </div>
    </div>`;
}

// ── Admin sidebar ────────────────────────────────────────────

function renderAdminNavBar() {
    const navItems = [
        { id: 'menu',         icon: '🍕', label: 'Menu & Inventory' },
        { id: 'inventory',    icon: '📦', label: 'Inventory Status' },
        { id: 'sales-report', icon: '📈', label: 'Sales Report' },
        { id: 'orders',       icon: '📋', label: 'All Orders' },
        { id: 'sales',        icon: '💰', label: 'Sales' },
    ];
    const navLinksHtml = navItems.map(n =>
        `<button class="admin-nav-item ${adminPage === n.id ? 'active' : ''}" data-page="${n.id}">
            <span class="admin-nav-icon">${n.icon}</span>
            <span class="admin-nav-label">${n.label}</span>
        </button>`
    ).join('');

    return `
    <div class="admin-sidebar">
        <div class="admin-sidebar-logo">
            <span>🍽️</span>
            <div>
                <div class="sidebar-brand">FoodieDash</div>
                <div class="sidebar-role">Admin Panel</div>
            </div>
        </div>
        <nav class="admin-nav">${navLinksHtml}</nav>
        <div class="sidebar-footer">
            <div class="sidebar-user">👑 ${currentUser.username}</div>
            <button class="btn-logout" id="logoutBtn">🚪 Logout</button>
        </div>
    </div>`;
}

// ── Admin pages ──────────────────────────────────────────────

function renderPageMenu() {
    let menuHtml = '';
    for (const item of _menuItems) {
        const stockStatus = item.stock === 0
            ? '🔴 Out of Stock'
            : item.stock < 10
                ? '🟡 Low Stock (' + item.stock + ')'
                : '🟢 In Stock (' + item.stock + ')';
        menuHtml += `
        <div class="menu-row">
            <span>
                <strong>${item.name}</strong>
                <br><small>₱${(item.price / 100).toFixed(2)} &nbsp;|&nbsp; ${stockStatus}</small>
            </span>
            <div>
                <button class="editStockBtn btn-secondary small-btn" data-id="${item.itemID}" data-stock="${item.stock}">✏️ Update Stock</button>
            </div>
        </div>`;
    }

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>🍕 Menu &amp; Inventory Management</h1>
            <p>Manage your menu items, prices and stock levels</p>
        </div>
        <div class="panel">
            <h2>Current Menu Items</h2>
            <div class="item-list">${menuHtml || '<p style="text-align:center;color:#aaa;padding:20px;">No items found.</p>'}</div>
        </div>
        <div class="panel">
            <h2>➕ Add New Item</h2>
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
                <div class="form-group" style="flex:2;min-width:160px;margin-bottom:0;">
                    <label>Item Name</label>
                    <input type="text" id="newItemName" placeholder="e.g. Garlic Bread">
                </div>
                <div class="form-group" style="flex:1;min-width:120px;margin-bottom:0;">
                    <label>Price (cents, e.g. 499 = ₱4.99)</label>
                    <input type="number" id="newItemPrice" placeholder="e.g. 499">
                </div>
                <div class="form-group" style="flex:1;min-width:100px;margin-bottom:0;">
                    <label>Stock</label>
                    <input type="number" id="newItemStock" placeholder="e.g. 50">
                </div>
                <button id="addItemBtn" class="btn-primary" style="padding:12px 24px;white-space:nowrap;">Add Item</button>
            </div>
        </div>
    </div>`;
}

function renderPageInventory() {
    const lowStock   = _menuItems.filter(i => i.stock <= 10 && i.stock > 0);
    const outOfStock = _menuItems.filter(i => i.stock === 0);
    const goodStock  = _menuItems.filter(i => i.stock > 10);

    const rowsHtml = _menuItems.map(item => {
        const pct      = Math.min(100, (item.stock / 60) * 100);
        const barColor = item.stock === 0 ? '#dc2626' : item.stock < 10 ? '#f59e0b' : '#10b981';
        return `
        <tr>
            <td><strong>${item.name}</strong></td>
            <td>${item.stock}</td>
            <td>
                <div class="stock-bar-wrap">
                    <div class="stock-bar-fill" style="width:${pct}%;background:${barColor};"></div>
                </div>
            </td>
            <td>
                <span class="inv-badge" style="background:${barColor}20;color:${barColor};">
                    ${item.stock === 0 ? 'Out of Stock' : item.stock < 10 ? 'Low Stock' : 'Good'}
                </span>
            </td>
            <td><button class="editStockBtn btn-secondary small-btn" data-id="${item.itemID}" data-stock="${item.stock}">Update</button></td>
        </tr>`;
    }).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>📦 Inventory Status</h1>
            <p>Monitor stock levels across all menu items</p>
        </div>
        <div class="grid-3col" style="margin-bottom:28px;">
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">✅</div>
                <div class="stat-val">${goodStock.length}</div>
                <div class="stat-label">Well Stocked</div>
            </div>
            <div class="stat-card" style="--accent:#f59e0b;">
                <div class="stat-icon">⚠️</div>
                <div class="stat-val">${lowStock.length}</div>
                <div class="stat-label">Low Stock</div>
            </div>
            <div class="stat-card" style="--accent:#dc2626;">
                <div class="stat-icon">🔴</div>
                <div class="stat-val">${outOfStock.length}</div>
                <div class="stat-label">Out of Stock</div>
            </div>
        </div>
        ${lowStock.length > 0 ? `<div class="alert-banner">⚠️ <strong>Low stock alert:</strong> ${lowStock.map(i => i.name).join(', ')}</div>` : ''}
        <div class="panel">
            <h2>Stock Overview</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>Item</th><th>Qty</th><th style="min-width:160px;">Level</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function renderPageSalesReport() {
    const completionRate = (_orderStats.Complete + _orderStats.Preparing + _orderStats.Cancelled) > 0
        ? ((_orderStats.Complete / (_orderStats.Complete + _orderStats.Preparing + _orderStats.Cancelled)) * 100).toFixed(1)
        : 0;
    const totalOrders = _orderStats.Complete + _orderStats.Preparing + _orderStats.Cancelled;

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>📈 Sales Report</h1>
            <p>Overview of revenue, orders and performance metrics</p>
        </div>
        <div class="grid-2col" style="margin-bottom:28px;">
            <div class="stat-card big" style="--accent:#ff7b2c;">
                <div class="stat-icon">☀️</div>
                <div class="stat-val">₱${(_dailySales.totalSales / 100).toFixed(2)}</div>
                <div class="stat-label">Today's Revenue</div>
                <div class="stat-sub">${_dailySales.orderCount} orders completed</div>
            </div>
            <div class="stat-card big" style="--accent:#ff5722;">
                <div class="stat-icon">📅</div>
                <div class="stat-val">₱${(_monthlySales.totalSales / 100).toFixed(2)}</div>
                <div class="stat-label">Monthly Revenue (30 days)</div>
                <div class="stat-sub">${_monthlySales.orderCount} orders completed</div>
            </div>
        </div>
        <div class="grid-3col" style="margin-bottom:28px;">
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">✅</div>
                <div class="stat-val">${_orderStats.Complete}</div>
                <div class="stat-label">Completed Orders</div>
            </div>
            <div class="stat-card" style="--accent:#f59e0b;">
                <div class="stat-icon">⏳</div>
                <div class="stat-val">${_orderStats.Preparing}</div>
                <div class="stat-label">In Progress</div>
            </div>
            <div class="stat-card" style="--accent:#dc2626;">
                <div class="stat-icon">❌</div>
                <div class="stat-val">${_orderStats.Cancelled}</div>
                <div class="stat-label">Cancelled</div>
            </div>
        </div>
        <div class="panel">
            <h2>Performance Summary</h2>
            <div style="display:flex;flex-direction:column;gap:16px;">
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-weight:600;">Order Completion Rate</span>
                        <span style="color:#10b981;font-weight:700;">${completionRate}%</span>
                    </div>
                    <div class="stock-bar-wrap" style="height:12px;">
                        <div class="stock-bar-fill" style="width:${completionRate}%;background:#10b981;height:12px;border-radius:6px;"></div>
                    </div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-weight:600;">Total Orders</span>
                        <span style="color:#ff5722;font-weight:700;">${totalOrders}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderPageOrders() {
    const ordersHtml = _orders.map(order =>
        `<tr>
            <td><strong>#${order.OrderID}</strong></td>
            <td>${order.customer_name || 'Unknown'}</td>
            <td>${order.order_date ? new Date(order.order_date).toLocaleString() : '—'}</td>
            <td><strong>₱${(order.TotalPayment / 100).toFixed(2)}</strong></td>
            <td><span class="order-status status-${order.Status}">${order.Status}</span></td>
            <td>
                <select class="statusSelect" data-id="${order.OrderID}">
                    <option ${order.Status === 'Preparing'  ? 'selected' : ''}>Preparing</option>
                    <option ${order.Status === 'Complete'   ? 'selected' : ''}>Complete</option>
                    <option ${order.Status === 'Cancelled'  ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>${order.referenceNumber || 'N/A'}</td>
        </tr>`
    ).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>📋 All Orders</h1>
            <p>View and manage all customer orders</p>
        </div>
        <div class="panel">
            <h2>Order Management</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th><th>Customer</th><th>Date</th><th>Total</th>
                            <th>Status</th><th>Update Status</th><th>Payment Ref</th>
                        </tr>
                    </thead>
                    <tbody>${ordersHtml || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px;">No orders yet.</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>`;
}

function renderPageSales() {
    const totalRevenue = _salesByDate.reduce((s, r) => s + r.revenue, 0);
    const totalOrderCount = _salesByDate.reduce((s, r) => s + r.order_count, 0);

    const dateRows = _salesByDate.map(r =>
        `<tr>
            <td>${r.sale_date}</td>
            <td>${r.order_count}</td>
            <td><strong style="color:#ff5722;">₱${(r.revenue / 100).toFixed(2)}</strong></td>
        </tr>`
    ).join('');

    const customerRows = _salesByCustomer.map(r =>
        `<tr>
            <td>👤 ${r.customer_name}</td>
            <td>${r.order_count} orders</td>
            <td><strong style="color:#ff5722;">₱${(r.revenue / 100).toFixed(2)}</strong></td>
        </tr>`
    ).join('');

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>💰 Sales</h1>
            <p>Detailed sales breakdown by date and customer</p>
        </div>
        <div class="stat-card big" style="--accent:#ff5722;margin-bottom:28px;">
            <div class="stat-icon">💰</div>
            <div class="stat-val">₱${(totalRevenue / 100).toFixed(2)}</div>
            <div class="stat-label">Total Revenue (All Time)</div>
            <div class="stat-sub">From ${totalOrderCount} completed orders</div>
        </div>
        <div class="grid-2col">
            <div class="panel" style="margin-bottom:0;">
                <h2>📅 Sales by Date</h2>
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th></tr></thead>
                        <tbody>${dateRows || '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:20px;">No sales data yet.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            <div class="panel" style="margin-bottom:0;">
                <h2>👥 Sales by Customer</h2>
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Customer</th><th>Orders</th><th>Total Spent</th></tr></thead>
                        <tbody>${customerRows || '<tr><td colspan="3" style="text-align:center;color:#aaa;padding:20px;">No customer data yet.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;
}

function renderAdmin() {
    let pageContent = '';
    if      (adminPage === 'menu')         pageContent = renderPageMenu();
    else if (adminPage === 'inventory')    pageContent = renderPageInventory();
    else if (adminPage === 'sales-report') pageContent = renderPageSalesReport();
    else if (adminPage === 'orders')       pageContent = renderPageOrders();
    else if (adminPage === 'sales')        pageContent = renderPageSales();

    return `
    <div class="admin-layout">
        ${renderAdminNavBar()}
        <main class="admin-main">${pageContent}</main>
    </div>`;
}

function renderCustomer() {
    const availableItems = _menuItems.filter(i => i.stock > 0);
    const myOrders = _orders; // already filtered by customerId
    const cartTotal = getCartTotal();

    let menuHtml = '';
    for (const item of availableItems) {
        menuHtml += '<div class="menu-row">' +
            '<span><strong>' + item.name + '</strong><br><small>₱' + (item.price / 100).toFixed(2) + ' | Stock: ' + item.stock + '</small></span>' +
            '<button class="addToCartBtn" data-id="' + item.itemID + '" data-name="' + item.name + '" data-price="' + item.price + '" data-stock="' + item.stock + '">Add to Cart</button>' +
            '</div>';
    }

    let cartHtml = '';
    if (customerCart.length === 0) {
        cartHtml = '<p style="color:gray;text-align:center;padding:20px;">🛒 Your cart is empty</p>';
    } else {
        for (const item of customerCart) {
            cartHtml += '<div class="cart-item">' +
                '<span><b>' + item.name + '</b> x' + item.quantity + '</span>' +
                '<span>₱' + (item.price * item.quantity / 100).toFixed(2) + ' ' +
                '<button class="qtyUp" data-id="' + item.ItemID + '">+</button> ' +
                '<button class="qtyDown" data-id="' + item.ItemID + '">-</button> ' +
                '<button class="removeCart" data-id="' + item.ItemID + '">🗑️</button></span>' +
                '</div>';
        }
    }

    let ordersHtml = '';
    for (const order of myOrders) {
        ordersHtml += '<tr>' +
            '<td>#' + order.OrderID + '</td>' +
            '<td>' + (order.order_date ? new Date(order.order_date).toLocaleString() : '—') + '</td>' +
            '<td>₱' + (order.TotalPayment / 100).toFixed(2) + '</td>' +
            '<td><span class="order-status status-' + order.Status + '">' + order.Status + '</span></td>' +
            '<td>' + (order.referenceNumber || 'N/A') + '</td>' +
            '<td>' + (order.Status === 'Preparing'
                ? '<button class="cancelOrderBtn small-btn btn-danger" data-id="' + order.OrderID + '">Cancel</button>'
                : '-') + '</td>' +
            '</tr>';
    }

    return '<div class="top-bar">' +
        '<div class="logo">🍔 FoodieDash <span>Customer</span></div>' +
        '<div class="user-dropdown-wrapper">' +
            '<button class="user-dropdown-btn" id="userDropdownBtn">' +
                '🧑 ' + currentUser.username +
                ' <span class="dropdown-arrow" id="dropdownArrow">▼</span>' +
            '</button>' +
            '<div class="dropdown-menu" id="dropdownMenu">' +
                '<div class="dropdown-header">My Account</div>' +
                '<button class="dropdown-item" id="viewOrdersDropBtn">📜&nbsp; Order History</button>' +
                '<button class="dropdown-item danger" id="logoutBtn">🚪&nbsp; Logout</button>' +
            '</div>' +
        '</div>' +
        '</div>' +
        '<div class="grid-2col">' +
        '<div class="card"><h3>📜 Our Menu</h3>' +
        (menuHtml || '<p style="text-align:center;">No items available</p>') +
        '</div>' +
        '<div class="card"><h3>🛒 Your Cart</h3>' +
        '<div>' + cartHtml + '</div>' +
        '<div class="total">Total: ₱' + (cartTotal / 100).toFixed(2) + '</div>' +
        '<button id="placeOrderBtn" class="btn-order">✅ Place Order</button>' +
        '</div></div>' +
        '<div class="panel" id="orderHistoryPanel"><h2>📜 My Order History</h2>' +
        '<div style="overflow-x:auto;">' +
        '<table><thead><tr><th>Order ID</th><th>Date</th><th>Total</th><th>Status</th><th>Payment Ref</th><th>Action</th></tr></thead>' +
        '<tbody>' + (ordersHtml || '<tr><td colspan="6" style="text-align:center;">No orders yet</td></tr>') + '</tbody></table>' +
        '</div></div>';
}

// ============================================================
//  EVENTS
// ============================================================

function attachEvents() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    if (currentUser && currentUser.role === 'admin') {
        document.querySelectorAll('.admin-nav-item').forEach(btn => {
            btn.addEventListener('click', function () { setAdminPage(this.dataset.page); });
        });

        document.querySelectorAll('.editStockBtn').forEach(btn => {
            btn.addEventListener('click', function () {
                const id       = parseInt(this.dataset.id);
                const newStock = prompt('Enter new stock quantity:', this.dataset.stock);
                if (newStock !== null && !isNaN(newStock)) {
                    updateStock(id, parseInt(newStock))
                        .then(() => renderApp())
                        .catch(e => alert(e.message));
                }
            });
        });

        const addBtn = document.getElementById('addItemBtn');
        if (addBtn) {
            addBtn.addEventListener('click', function () {
                const name  = document.getElementById('newItemName').value.trim();
                const price = parseInt(document.getElementById('newItemPrice').value);
                const stock = parseInt(document.getElementById('newItemStock').value);
                if (!name || isNaN(price) || isNaN(stock)) { alert('Please fill all fields'); return; }
                apiPost('addMenuItem', { name, price, stock, category_id: 1 })
                    .then(() => renderApp())
                    .catch(e => alert(e.message));
            });
        }

        document.querySelectorAll('.statusSelect').forEach(sel => {
            sel.addEventListener('change', function () {
                updateOrderStatus(parseInt(this.dataset.id), this.value)
                    .then(() => renderApp())
                    .catch(e => alert(e.message));
            });
        });
    }

    if (currentUser && currentUser.role === 'customer') {
        const dropdownBtn   = document.getElementById('userDropdownBtn');
        const dropdownMenu  = document.getElementById('dropdownMenu');
        const dropdownArrow = document.getElementById('dropdownArrow');

        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                const isOpen = dropdownMenu.classList.toggle('open');
                if (dropdownArrow) dropdownArrow.classList.toggle('open', isOpen);
            });
            document.addEventListener('click', function () {
                dropdownMenu.classList.remove('open');
                if (dropdownArrow) dropdownArrow.classList.remove('open');
            });
        }

        const viewOrdersBtn = document.getElementById('viewOrdersDropBtn');
        if (viewOrdersBtn) {
            viewOrdersBtn.addEventListener('click', function () {
                if (dropdownMenu)  dropdownMenu.classList.remove('open');
                if (dropdownArrow) dropdownArrow.classList.remove('open');
                const panel = document.getElementById('orderHistoryPanel');
                if (panel) panel.scrollIntoView({ behavior: 'smooth' });
            });
        }

        document.querySelectorAll('.addToCartBtn').forEach(btn => {
            btn.addEventListener('click', function () {
                addToCart({
                    itemID: parseInt(this.dataset.id),
                    name:   this.dataset.name,
                    price:  parseInt(this.dataset.price),
                    stock:  parseInt(this.dataset.stock),
                });
            });
        });

        document.querySelectorAll('.qtyUp').forEach(btn => {
            btn.addEventListener('click', function () { updateQuantity(parseInt(this.dataset.id),  1); });
        });
        document.querySelectorAll('.qtyDown').forEach(btn => {
            btn.addEventListener('click', function () { updateQuantity(parseInt(this.dataset.id), -1); });
        });
        document.querySelectorAll('.removeCart').forEach(btn => {
            btn.addEventListener('click', function () { removeFromCart(parseInt(this.dataset.id)); });
        });

        const placeBtn = document.getElementById('placeOrderBtn');
        if (placeBtn) placeBtn.addEventListener('click', placeOrder);

        document.querySelectorAll('.cancelOrderBtn').forEach(btn => {
            btn.addEventListener('click', function () { cancelOrder(parseInt(this.dataset.id)); });
        });
    }
}

// ============================================================
//  MAIN RENDER  (async – fetches fresh data every time)
// ============================================================

async function renderApp() {
    const root = document.getElementById('app');
    if (!root) return;

    // ── Not logged in ────────────────────────────────────────
    if (!currentUser) {
        if (currentPage === 'login') {
            root.innerHTML = renderLogin();

            document.getElementById('doLoginBtn').addEventListener('click', async function () {
                const uname = document.getElementById('loginUsername').value;
                const pwd   = document.getElementById('loginPassword').value;
                const msgDiv = document.getElementById('loginMessage');
                try {
                    const ok = await login(uname, pwd);
                    if (ok) { renderApp(); }
                    else {
                        msgDiv.innerHTML = '<div class="error-message">❌ Invalid username or password</div>';
                        setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                    }
                } catch (e) {
                    msgDiv.innerHTML = '<div class="error-message">❌ ' + e.message + '</div>';
                    setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                }
            });

            // Allow pressing Enter to login
            ['loginUsername', 'loginPassword'].forEach(id => {
                document.getElementById(id).addEventListener('keydown', e => {
                    if (e.key === 'Enter') document.getElementById('doLoginBtn').click();
                });
            });

            const registerLink = document.getElementById('goToRegisterLink');
            if (registerLink) registerLink.addEventListener('click', showRegisterPage);

        } else {
            root.innerHTML = renderRegister();

            document.getElementById('doRegisterBtn').addEventListener('click', async function () {
                const uname      = document.getElementById('regUsername').value;
                const pwd        = document.getElementById('regPassword').value;
                const confirmPwd = document.getElementById('regConfirmPassword').value;
                const msgDiv     = document.getElementById('registerMessage');

                if (!uname || !pwd) {
                    msgDiv.innerHTML = '<div class="error-message">❌ Please fill all fields</div>';
                    setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                    return;
                }
                if (pwd !== confirmPwd) {
                    msgDiv.innerHTML = '<div class="error-message">❌ Passwords do not match</div>';
                    setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                    return;
                }
                const result = await registerUser(uname, pwd);
                if (result.success) {
                    msgDiv.innerHTML = '<div class="success-message">✅ ' + result.message + '</div>';
                    setTimeout(showLoginPage, 2000);
                } else {
                    msgDiv.innerHTML = '<div class="error-message">❌ ' + result.message + '</div>';
                    setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                }
            });

            const loginLink = document.getElementById('goToLoginLink');
            if (loginLink) loginLink.addEventListener('click', showLoginPage);
        }
        return;
    }

    // ── Admin ────────────────────────────────────────────────
    if (currentUser.role === 'admin') {
        root.innerHTML = '<div style="text-align:center;padding:60px;color:#999;">Loading admin data…</div>';
        try {
            await Promise.all([loadMenuItems(), loadOrders(), loadAdminExtras()]);
        } catch (e) {
            root.innerHTML = '<div class="error-message" style="margin:40px auto;max-width:500px;">❌ Failed to load data: ' + e.message + '</div>';
            return;
        }
        root.innerHTML = renderAdmin();
        attachEvents();
        return;
    }

    // ── Customer ─────────────────────────────────────────────
    if (currentUser.role === 'customer') {
        root.innerHTML = '<div style="text-align:center;padding:60px;color:#999;">Loading menu…</div>';
        try {
            await Promise.all([loadMenuItems(), loadOrders(currentUser.userID)]);
        } catch (e) {
            root.innerHTML = '<div class="error-message" style="margin:40px auto;max-width:500px;">❌ Failed to load data: ' + e.message + '</div>';
            return;
        }
        root.innerHTML = renderCustomer();
        attachEvents();
    }
}

// ============================================================
//  BOOT – seed DB on first visit, then render
// ============================================================
(async () => {
    try {
        await apiGet('initSampleData');
    } catch (e) {
        console.warn('initSampleData skipped:', e.message);
    }
    renderApp();
})();