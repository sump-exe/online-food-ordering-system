const STORAGE_KEYS = {
    users: 'foodie_users',
    menu_items: 'foodie_menu_items',
    orders: 'foodie_orders',
    payments: 'foodie_payments',
    order_items: 'foodie_order_items'
};

function getData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
}

function setData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function validatePassword(password) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasSymbol = /[!@#$%^&*()]/.test(password);
    return { valid: hasUppercase && hasSymbol, hasUppercase, hasSymbol };
}

function createUser(username, password, role) {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        throw new Error('Password must contain at least one uppercase letter and one special character (!@#$%^&*())');
    }
    const users = getData(STORAGE_KEYS.users);
    if (users.find(u => u.username === username)) throw new Error('Username already exists');
    const newId = users.length ? Math.max(...users.map(u => u.userID)) + 1 : 1;
    const newUser = { userID: newId, username, password, role };
    users.push(newUser);
    setData(STORAGE_KEYS.users, users);
    return newUser;
}

function loginUser(username, password) {
    const users = getData(STORAGE_KEYS.users);
    return users.find(u => u.username === username && u.password === password) || null;
}

function addMenuItem(name, price, stock, categoryId) {
    if (price <= 0) throw new Error('Price must be positive');
    if (stock < 0) throw new Error('Stock cannot be negative');
    const items = getData(STORAGE_KEYS.menu_items);
    const newId = items.length ? Math.max(...items.map(i => i.itemID)) + 1 : 1;
    const newItem = {
        itemID: newId,
        name,
        price: parseInt(price),
        stock: parseInt(stock),
        category_id: parseInt(categoryId),
        available: stock > 0,
        timeToPrepare: new Date().toISOString()
    };
    items.push(newItem);
    setData(STORAGE_KEYS.menu_items, items);
    return newItem;
}

function updateStock(itemId, newStock) {
    if (newStock < 0) throw new Error('Stock cannot be negative');
    let items = getData(STORAGE_KEYS.menu_items);
    items = items.map(i => i.itemID === itemId ? {...i, stock: newStock, available: newStock > 0 } : i);
    setData(STORAGE_KEYS.menu_items, items);
}

function createOrder(customerId, totalPayment) {
    const orders = getData(STORAGE_KEYS.orders);
    const newId = orders.length ? Math.max(...orders.map(o => o.OrderID)) + 1 : 1001;
    const newOrder = {
        OrderID: newId,
        customer_id: customerId,
        Status: 'Preparing',
        TotalPayment: parseInt(totalPayment),
        order_date: new Date().toISOString()
    };
    orders.push(newOrder);
    setData(STORAGE_KEYS.orders, orders);
    return newOrder;
}

function updateOrderStatus(orderId, newStatus) {
    if (!['Preparing', 'Complete', 'Cancelled'].includes(newStatus)) throw new Error('Invalid status');
    let orders = getData(STORAGE_KEYS.orders);
    orders = orders.map(o => o.OrderID === orderId ? {...o, Status: newStatus } : o);
    setData(STORAGE_KEYS.orders, orders);
}

function createPayment(referenceNumber, orderId, userId) {
    const payments = getData(STORAGE_KEYS.payments);
    const newPayment = {
        referenceNumber: parseInt(referenceNumber),
        OrderID: orderId,
        UserID: userId,
        payment_date: new Date().toISOString()
    };
    payments.push(newPayment);
    setData(STORAGE_KEYS.payments, payments);
    return newPayment;
}

function addOrderItem(orderId, itemId, quantity, price) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (price <= 0) throw new Error('Price must be positive');
    let orderItems = getData(STORAGE_KEYS.order_items);
    orderItems.push({ OrderID: orderId, ItemID: itemId, quantity, price });
    setData(STORAGE_KEYS.order_items, orderItems);
    const items = getData(STORAGE_KEYS.menu_items);
    const item = items.find(i => i.itemID === itemId);
    if (item) updateStock(itemId, item.stock - quantity);
}

function getOrdersWithDetails() {
    const orders = getData(STORAGE_KEYS.orders);
    const users = getData(STORAGE_KEYS.users);
    const payments = getData(STORAGE_KEYS.payments);
    return orders.map(order => {
        const customer = users.find(u => u.userID === order.customer_id);
        const payment = payments.find(p => p.OrderID === order.OrderID);
        return {
            OrderID: order.OrderID,
            customer_name: customer ? customer.username : 'Unknown',
            order_date: order.order_date,
            TotalPayment: order.TotalPayment,
            Status: order.Status,
            referenceNumber: payment ? payment.referenceNumber : null,
            customer_id: order.customer_id
        };
    }).sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
}

function getSalesReport(period) {
    const orders = getData(STORAGE_KEYS.orders).filter(o => o.Status === 'Complete');
    const now = new Date();
    const filtered = orders.filter(o => {
        const d = new Date(o.order_date);
        if (period === 'daily') return d.toDateString() === now.toDateString();
        const monthAgo = new Date();
        monthAgo.setDate(now.getDate() - 30);
        return d >= monthAgo;
    });
    return {
        totalSales: filtered.reduce((sum, o) => sum + (o.TotalPayment || 0), 0),
        orderCount: filtered.length
    };
}

function getLowStockItems(threshold) {
    return getData(STORAGE_KEYS.menu_items).filter(i => i.stock <= threshold && i.stock > 0);
}

function initSampleData() {
    try {
        if (getData(STORAGE_KEYS.users).length === 0) {
            createUser('admin', 'Admin123!', 'admin');
            createUser('john_doe', 'JohnDoe123!', 'customer');
            createUser('emma_watson', 'Emma456!', 'customer');
        }
        if (getData(STORAGE_KEYS.menu_items).length === 0) {
            addMenuItem('Margherita Pizza', 1299, 50, 1);
            addMenuItem('Pepperoni Feast', 1549, 35, 1);
            addMenuItem('Classic Cheeseburger', 999, 45, 2);
            addMenuItem('Vegan Burger', 1149, 30, 2);
            addMenuItem('Caesar Salad', 899, 60, 3);
            addMenuItem('Iced Tea', 299, 100, 4);
        }
        if (getData(STORAGE_KEYS.orders).length === 0) {
            const customer = getData(STORAGE_KEYS.users).find(u => u.username === 'john_doe');
            if (customer) {
                const order = createOrder(customer.userID, 2598);
                addOrderItem(order.OrderID, 1, 2, 1299);
                createPayment(123456789, order.OrderID, customer.userID);
                updateOrderStatus(order.OrderID, 'Complete');
            }
        }
    } catch (e) { console.error("Init error:", e); }
}

// ========== STATE ==========
let currentUser = null;
let customerCart = [];
let currentPage = 'login';
let adminPage = 'menu'; // 'menu' | 'inventory' | 'sales-report' | 'orders' | 'sales'

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
        const newQty = customerCart[idx].quantity + delta;
        const maxStock = customerCart[idx].maxStock;
        if (newQty <= 0) { customerCart.splice(idx, 1); } else if (newQty > maxStock) { alert('Cannot add more than ' + maxStock + ' items'); return; } else { customerCart[idx].quantity = newQty; }
        renderApp();
    }
}

function getCartTotal() {
    return customerCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
}

function placeOrder() {
    if (!currentUser || currentUser.role !== 'customer') { alert('Please login as customer'); return; }
    if (customerCart.length === 0) { alert('Cart is empty'); return; }
    try {
        const totalAmount = getCartTotal();
        const order = createOrder(currentUser.userID, totalAmount);
        for (let cart of customerCart) addOrderItem(order.OrderID, cart.ItemID, cart.quantity, cart.price);
        const referenceNumber = Math.floor(Math.random() * 900000000) + 100000000;
        createPayment(referenceNumber, order.OrderID, currentUser.userID);
        customerCart = [];
        renderApp();
        alert('Order #' + order.OrderID + ' placed! Total: $' + (totalAmount / 100).toFixed(2) + '\nPayment Reference: ' + referenceNumber);
    } catch (error) { alert('Error: ' + error.message); }
}

function cancelOrder(orderId) {
    if (confirm('Cancel this order?')) {
        try { updateOrderStatus(orderId, 'Cancelled');
            renderApp();
            alert('Order cancelled'); } catch (error) { alert(error.message); }
    }
}

function login(username, password) {
    const user = loginUser(username, password);
    if (user) { currentUser = user;
        currentPage = 'login'; return true; }
    return false;
}

function logout() {
    currentUser = null;
    customerCart = [];
    currentPage = 'login';
    adminPage = 'menu';
    renderApp();
}

function registerUser(username, password) {
    try {
        createUser(username, password, 'customer');
        return { success: true, message: 'Registration successful! Please login.' };
    } catch (error) { return { success: false, message: error.message }; }
}

function showRegisterPage() { currentPage = 'register';
    renderApp(); }

function showLoginPage() { currentPage = 'login';
    renderApp(); }

function setAdminPage(page) { adminPage = page;
    renderApp(); }

// ========== RENDER ==========
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

// ========== ADMIN NAV PAGES ==========

function renderAdminNavBar() {
    const navItems = [
        { id: 'menu', icon: '🍕', label: 'Menu & Inventory' },
        { id: 'inventory', icon: '📦', label: 'Inventory Status' },
        { id: 'sales-report', icon: '📈', label: 'Sales Report' },
        { id: 'orders', icon: '📋', label: 'All Orders' },
        { id: 'sales', icon: '💰', label: 'Sales' },
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
        <nav class="admin-nav">
            ${navLinksHtml}
        </nav>
        <div class="sidebar-footer">
            <div class="sidebar-user">👑 ${currentUser.username}</div>
            <button class="btn-logout" id="logoutBtn">🚪 Logout</button>
        </div>
    </div>`;
}

function renderPageMenu() {
    const menuItems = getData(STORAGE_KEYS.menu_items);
    let menuHtml = '';
    for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        const stockStatus = item.stock === 0 ? '🔴 Out of Stock' : (item.stock < 10 ? '🟡 Low Stock (' + item.stock + ')' : '🟢 In Stock (' + item.stock + ')');
        menuHtml += `
        <div class="menu-row">
            <span>
                <strong>${item.name}</strong>
                <br><small>$${(item.price / 100).toFixed(2)} &nbsp;|&nbsp; ${stockStatus}</small>
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
                    <label>Price (cents)</label>
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
    const menuItems = getData(STORAGE_KEYS.menu_items);
    const lowStock = getLowStockItems(10);
    const outOfStock = menuItems.filter(i => i.stock === 0);
    const goodStock = menuItems.filter(i => i.stock > 10);

    let rowsHtml = menuItems.map(item => {
        const pct = Math.min(100, (item.stock / 60) * 100);
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
    const daily = getSalesReport('daily');
    const monthly = getSalesReport('monthly');
    const allOrders = getData(STORAGE_KEYS.orders);
    const completedOrders = allOrders.filter(o => o.Status === 'Complete');
    const preparingOrders = allOrders.filter(o => o.Status === 'Preparing');
    const cancelledOrders = allOrders.filter(o => o.Status === 'Cancelled');

    // Revenue by status breakdown
    const completionRate = allOrders.length ? ((completedOrders.length / allOrders.length) * 100).toFixed(1) : 0;

    return `
    <div class="admin-page-content">
        <div class="page-header">
            <h1>📈 Sales Report</h1>
            <p>Overview of revenue, orders and performance metrics</p>
        </div>
        <div class="grid-2col" style="margin-bottom:28px;">
            <div class="stat-card big" style="--accent:#ff7b2c;">
                <div class="stat-icon">☀️</div>
                <div class="stat-val">$${(daily.totalSales / 100).toFixed(2)}</div>
                <div class="stat-label">Today's Revenue</div>
                <div class="stat-sub">${daily.orderCount} orders completed</div>
            </div>
            <div class="stat-card big" style="--accent:#ff5722;">
                <div class="stat-icon">📅</div>
                <div class="stat-val">$${(monthly.totalSales / 100).toFixed(2)}</div>
                <div class="stat-label">Monthly Revenue (30 days)</div>
                <div class="stat-sub">${monthly.orderCount} orders completed</div>
            </div>
        </div>
        <div class="grid-3col" style="margin-bottom:28px;">
            <div class="stat-card" style="--accent:#10b981;">
                <div class="stat-icon">✅</div>
                <div class="stat-val">${completedOrders.length}</div>
                <div class="stat-label">Completed Orders</div>
            </div>
            <div class="stat-card" style="--accent:#f59e0b;">
                <div class="stat-icon">⏳</div>
                <div class="stat-val">${preparingOrders.length}</div>
                <div class="stat-label">In Progress</div>
            </div>
            <div class="stat-card" style="--accent:#dc2626;">
                <div class="stat-icon">❌</div>
                <div class="stat-val">${cancelledOrders.length}</div>
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
                        <span style="color:#ff5722;font-weight:700;">${allOrders.length}</span>
                    </div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-weight:600;">Average Order Value (completed)</span>
                        <span style="font-weight:700;">$${completedOrders.length ? (completedOrders.reduce((s,o) => s + o.TotalPayment, 0) / completedOrders.length / 100).toFixed(2) : '0.00'}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderPageOrders() {
    const orders = getOrdersWithDetails();

    let ordersHtml = orders.map(order =>
        `<tr>
            <td><strong>#${order.OrderID}</strong></td>
            <td>${order.customer_name}</td>
            <td>${new Date(order.order_date).toLocaleString()}</td>
            <td><strong>$${(order.TotalPayment / 100).toFixed(2)}</strong></td>
            <td><span class="order-status status-${order.Status}">${order.Status}</span></td>
            <td>
                <select class="statusSelect" data-id="${order.OrderID}">
                    <option ${order.Status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option ${order.Status === 'Complete' ? 'selected' : ''}>Complete</option>
                    <option ${order.Status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
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
    const orders = getOrdersWithDetails();
    const completedOrders = orders.filter(o => o.Status === 'Complete');

    // Group by date
    const byDate = {};
    completedOrders.forEach(o => {
        const d = new Date(o.order_date).toLocaleDateString();
        if (!byDate[d]) byDate[d] = { count: 0, revenue: 0 };
        byDate[d].count++;
        byDate[d].revenue += o.TotalPayment;
    });

    const dateRows = Object.entries(byDate)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .map(([date, data]) =>
            `<tr>
                <td>${date}</td>
                <td>${data.count}</td>
                <td><strong style="color:#ff5722;">$${(data.revenue / 100).toFixed(2)}</strong></td>
            </tr>`
        ).join('');

    const totalRevenue = completedOrders.reduce((s, o) => s + o.TotalPayment, 0);

    // Per-customer breakdown
    const byCustomer = {};
    completedOrders.forEach(o => {
        if (!byCustomer[o.customer_name]) byCustomer[o.customer_name] = { count: 0, revenue: 0 };
        byCustomer[o.customer_name].count++;
        byCustomer[o.customer_name].revenue += o.TotalPayment;
    });

    const customerRows = Object.entries(byCustomer)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([name, data]) =>
            `<tr>
                <td>👤 ${name}</td>
                <td>${data.count} orders</td>
                <td><strong style="color:#ff5722;">$${(data.revenue / 100).toFixed(2)}</strong></td>
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
            <div class="stat-val">$${(totalRevenue / 100).toFixed(2)}</div>
            <div class="stat-label">Total Revenue (All Time)</div>
            <div class="stat-sub">From ${completedOrders.length} completed orders</div>
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
    if (adminPage === 'menu')         pageContent = renderPageMenu();
    else if (adminPage === 'inventory')    pageContent = renderPageInventory();
    else if (adminPage === 'sales-report') pageContent = renderPageSalesReport();
    else if (adminPage === 'orders')       pageContent = renderPageOrders();
    else if (adminPage === 'sales')        pageContent = renderPageSales();

    return `
    <div class="admin-layout">
        ${renderAdminNavBar()}
        <main class="admin-main">
            ${pageContent}
        </main>
    </div>`;
}

function renderCustomer() {
    const menuItems = getData(STORAGE_KEYS.menu_items);
    const availableItems = menuItems.filter(i => i.stock > 0);
    const orders = getOrdersWithDetails().filter(o => o.customer_id === currentUser.userID);
    const cartTotal = getCartTotal();

    let menuHtml = '';
    for (let i = 0; i < availableItems.length; i++) {
        const item = availableItems[i];
        menuHtml += '<div class="menu-row">' +
            '<span><strong>' + item.name + '</strong><br><small>$' + (item.price / 100).toFixed(2) + ' | Stock: ' + item.stock + '</small></span>' +
            '<button class="addToCartBtn" data-id="' + item.itemID + '" data-name="' + item.name + '" data-price="' + item.price + '" data-stock="' + item.stock + '">Add to Cart</button>' +
            '</div>';
    }

    let cartHtml = '';
    if (customerCart.length === 0) {
        cartHtml = '<p style="color:gray;text-align:center;padding:20px;">🛒 Your cart is empty</p>';
    } else {
        for (let i = 0; i < customerCart.length; i++) {
            const item = customerCart[i];
            cartHtml += '<div class="cart-item">' +
                '<span><b>' + item.name + '</b> x' + item.quantity + '</span>' +
                '<span>$' + (item.price * item.quantity / 100).toFixed(2) + ' ' +
                '<button class="qtyUp" data-id="' + item.ItemID + '">+</button> ' +
                '<button class="qtyDown" data-id="' + item.ItemID + '">-</button> ' +
                '<button class="removeCart" data-id="' + item.ItemID + '">🗑️</button></span>' +
                '</div>';
        }
    }

    let ordersHtml = '';
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        ordersHtml += '<tr>' +
            '<td>#' + order.OrderID + '</td>' +
            '<td>' + new Date(order.order_date).toLocaleString() + '</td>' +
            '<td>$' + (order.TotalPayment / 100).toFixed(2) + '</td>' +
            '<td><span class="order-status status-' + order.Status + '">' + order.Status + '</span></td>' +
            '<td>' + (order.referenceNumber || 'N/A') + '</td>' +
            '<td>' + (order.Status === 'Preparing' ? '<button class="cancelOrderBtn small-btn btn-danger" data-id="' + order.OrderID + '">Cancel</button>' : '-') + '</td>' +
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
        '<div class="total">Total: $' + (cartTotal / 100).toFixed(2) + '</div>' +
        '<button id="placeOrderBtn" class="btn-order">✅ Place Order</button>' +
        '</div></div>' +
        '<div class="panel" id="orderHistoryPanel"><h2>📜 My Order History</h2>' +
        '<div style="overflow-x:auto;">' +
        '<table><thead><tr><th>Order ID</th><th>Date</th><th>Total</th><th>Status</th><th>Payment Ref</th><th>Action</th></tr></thead>' +
        '<tbody>' + (ordersHtml || '<tr><td colspan="6" style="text-align:center;">No orders yet</td></tr>') + '</tbody></table>' +
        '</div></div>';
}

// ========== EVENTS ==========
function attachEvents() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    if (currentUser && currentUser.role === 'admin') {
        // Nav items
        document.querySelectorAll('.admin-nav-item').forEach(btn => {
            btn.addEventListener('click', function() {
                setAdminPage(this.dataset.page);
            });
        });

        // Page-specific events
        document.querySelectorAll('.editStockBtn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                const newStock = prompt('Enter new stock quantity:', this.dataset.stock);
                if (newStock !== null && !isNaN(newStock)) {
                    try { updateStock(id, parseInt(newStock)); renderApp(); }
                    catch (e) { alert(e.message); }
                }
            });
        });

        const addBtn = document.getElementById('addItemBtn');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                const name = document.getElementById('newItemName').value;
                const price = document.getElementById('newItemPrice').value;
                const stock = document.getElementById('newItemStock').value;
                if (name && price && stock) {
                    try { addMenuItem(name, parseInt(price), parseInt(stock), 1); renderApp(); }
                    catch (e) { alert(e.message); }
                } else { alert('Please fill all fields'); }
            });
        }

        document.querySelectorAll('.statusSelect').forEach(sel => {
            sel.addEventListener('change', function() {
                try { updateOrderStatus(parseInt(this.dataset.id), this.value); renderApp(); }
                catch (e) { alert(e.message); }
            });
        });
    }

    if (currentUser && currentUser.role === 'customer') {
        const dropdownBtn  = document.getElementById('userDropdownBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const dropdownArrow = document.getElementById('dropdownArrow');

        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const isOpen = dropdownMenu.classList.toggle('open');
                if (dropdownArrow) dropdownArrow.classList.toggle('open', isOpen);
            });
            document.addEventListener('click', function closeDD() {
                dropdownMenu.classList.remove('open');
                if (dropdownArrow) dropdownArrow.classList.remove('open');
            });
        }

        const viewOrdersBtn = document.getElementById('viewOrdersDropBtn');
        if (viewOrdersBtn) {
            viewOrdersBtn.addEventListener('click', function() {
                if (dropdownMenu) dropdownMenu.classList.remove('open');
                if (dropdownArrow) dropdownArrow.classList.remove('open');
                const panel = document.getElementById('orderHistoryPanel');
                if (panel) panel.scrollIntoView({ behavior: 'smooth' });
            });
        }

        document.querySelectorAll('.addToCartBtn').forEach(btn => {
            btn.addEventListener('click', function() {
                addToCart({
                    itemID: parseInt(this.dataset.id),
                    name: this.dataset.name,
                    price: parseInt(this.dataset.price),
                    stock: parseInt(this.dataset.stock)
                });
            });
        });

        document.querySelectorAll('.qtyUp').forEach(btn => {
            btn.addEventListener('click', function() { updateQuantity(parseInt(this.dataset.id), 1); });
        });
        document.querySelectorAll('.qtyDown').forEach(btn => {
            btn.addEventListener('click', function() { updateQuantity(parseInt(this.dataset.id), -1); });
        });
        document.querySelectorAll('.removeCart').forEach(btn => {
            btn.addEventListener('click', function() { removeFromCart(parseInt(this.dataset.id)); });
        });

        const placeBtn = document.getElementById('placeOrderBtn');
        if (placeBtn) placeBtn.addEventListener('click', placeOrder);

        document.querySelectorAll('.cancelOrderBtn').forEach(btn => {
            btn.addEventListener('click', function() { cancelOrder(parseInt(this.dataset.id)); });
        });
    }
}

function renderApp() {
    const root = document.getElementById('app');
    if (!root) return;

    if (!currentUser) {
        if (currentPage === 'login') {
            root.innerHTML = renderLogin();

            const loginBtn = document.getElementById('doLoginBtn');
            if (loginBtn) {
                loginBtn.addEventListener('click', function() {
                    const uname = document.getElementById('loginUsername').value;
                    const pwd   = document.getElementById('loginPassword').value;
                    if (login(uname, pwd)) {
                        renderApp();
                    } else {
                        const msgDiv = document.getElementById('loginMessage');
                        if (msgDiv) {
                            msgDiv.innerHTML = '<div class="error-message">❌ Invalid username or password</div>';
                            setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                        }
                    }
                });
            }

            const registerLink = document.getElementById('goToRegisterLink');
            if (registerLink) registerLink.addEventListener('click', showRegisterPage);

        } else {
            root.innerHTML = renderRegister();

            const regBtn = document.getElementById('doRegisterBtn');
            if (regBtn) {
                regBtn.addEventListener('click', function() {
                    const uname      = document.getElementById('regUsername').value;
                    const pwd        = document.getElementById('regPassword').value;
                    const confirmPwd = document.getElementById('regConfirmPassword').value;
                    const msgDiv     = document.getElementById('registerMessage');

                    if (!uname || !pwd) {
                        if (msgDiv) { msgDiv.innerHTML = '<div class="error-message">❌ Please fill all fields</div>'; setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000); }
                        return;
                    }
                    if (pwd !== confirmPwd) {
                        if (msgDiv) { msgDiv.innerHTML = '<div class="error-message">❌ Passwords do not match</div>'; setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000); }
                        return;
                    }
                    const result = registerUser(uname, pwd);
                    if (msgDiv) {
                        if (result.success) {
                            msgDiv.innerHTML = '<div class="success-message">✅ ' + result.message + '</div>';
                            setTimeout(showLoginPage, 2000);
                        } else {
                            msgDiv.innerHTML = '<div class="error-message">❌ ' + result.message + '</div>';
                            setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
                        }
                    }
                });
            }

            const loginLink = document.getElementById('goToLoginLink');
            if (loginLink) loginLink.addEventListener('click', showLoginPage);
        }

    } else if (currentUser.role === 'admin') {
        root.innerHTML = renderAdmin();
        attachEvents();
    } else if (currentUser.role === 'customer') {
        root.innerHTML = renderCustomer();
        attachEvents();
    }
}

initSampleData();
renderApp();