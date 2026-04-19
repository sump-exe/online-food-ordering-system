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
        itemID: newId, name,
        price: parseInt(price), stock: parseInt(stock),
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
    items = items.map(i => i.itemID === itemId ? { ...i, stock: newStock, available: newStock > 0 } : i);
    setData(STORAGE_KEYS.menu_items, items);
}

function createOrder(customerId, totalPayment) {
    const orders = getData(STORAGE_KEYS.orders);
    const newId = orders.length ? Math.max(...orders.map(o => o.OrderID)) + 1 : 1001;
    const newOrder = {
        OrderID: newId, customer_id: customerId,
        Status: 'Preparing', TotalPayment: parseInt(totalPayment),
        order_date: new Date().toISOString()
    };
    orders.push(newOrder);
    setData(STORAGE_KEYS.orders, orders);
    return newOrder;
}

function updateOrderStatus(orderId, newStatus) {
    if (!['Preparing', 'Complete', 'Cancelled'].includes(newStatus)) throw new Error('Invalid status');
    let orders = getData(STORAGE_KEYS.orders);
    orders = orders.map(o => o.OrderID === orderId ? { ...o, Status: newStatus } : o);
    setData(STORAGE_KEYS.orders, orders);
}

function createPayment(referenceNumber, orderId, userId) {
    const payments = getData(STORAGE_KEYS.payments);
    const newPayment = {
        referenceNumber: parseInt(referenceNumber),
        OrderID: orderId, UserID: userId,
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
        if (newQty <= 0) { customerCart.splice(idx, 1); }
        else if (newQty > maxStock) { alert('Cannot add more than ' + maxStock + ' items'); return; }
        else { customerCart[idx].quantity = newQty; }
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
        try { updateOrderStatus(orderId, 'Cancelled'); renderApp(); alert('Order cancelled'); }
        catch (error) { alert(error.message); }
    }
}

function login(username, password) {
    const user = loginUser(username, password);
    if (user) { currentUser = user; currentPage = 'login'; return true; }
    return false;
}

function logout() {
    currentUser = null; customerCart = []; currentPage = 'login'; renderApp();
}

function registerUser(username, password) {
    try {
        createUser(username, password, 'customer');
        return { success: true, message: 'Registration successful! Please login.' };
    } catch (error) { return { success: false, message: error.message }; }
}

function showRegisterPage() { currentPage = 'register'; renderApp(); }
function showLoginPage() { currentPage = 'login'; renderApp(); }

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

function renderAdmin() {
    const menuItems = getData(STORAGE_KEYS.menu_items);
    const orders = getOrdersWithDetails();
    const salesReport = getSalesReport('monthly');
    const lowStock = getLowStockItems(10);

    let menuHtml = '';
    for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        const stockStatus = item.stock === 0 ? 'Out of Stock' : (item.stock < 10 ? 'Low Stock (' + item.stock + ')' : 'In Stock (' + item.stock + ')');
        menuHtml += '<div class="menu-row">' +
            '<span><strong>' + item.name + '</strong><br><small>$' + (item.price / 100).toFixed(2) + ' | ' + stockStatus + '</small></span>' +
            '<div><button class="editStockBtn" data-id="' + item.itemID + '" data-stock="' + item.stock + '">Update Stock</button></div>' +
            '</div>';
    }

    let ordersHtml = '';
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        ordersHtml += '<tr>' +
            '<td>#' + order.OrderID + '</td>' +
            '<td>' + order.customer_name + '</td>' +
            '<td>' + new Date(order.order_date).toLocaleString() + '</td>' +
            '<td>$' + (order.TotalPayment / 100).toFixed(2) + '</td>' +
            '<td><span class="order-status status-' + order.Status + '">' + order.Status + '</span></td>' +
            '<td><select class="statusSelect" data-id="' + order.OrderID + '">' +
            '<option ' + (order.Status === 'Preparing' ? 'selected' : '') + '>Preparing</option>' +
            '<option ' + (order.Status === 'Complete' ? 'selected' : '') + '>Complete</option>' +
            '<option ' + (order.Status === 'Cancelled' ? 'selected' : '') + '>Cancelled</option>' +
            '</select></td>' +
            '<td>' + (order.referenceNumber || 'N/A') + '</td>' +
            '</tr>';
    }

    /* Admin top-bar keeps the original plain pill with logout button */
    return '<div class="top-bar">' +
        '<div class="logo">🍽️ FoodieDash <span>Admin</span></div>' +
        '<div class="user-info">👑 ' + currentUser.username +
        ' <button class="btn-logout" id="logoutBtn">Logout</button></div>' +
        '</div>' +
        '<div class="grid-2col">' +
        '<div class="card"><h3>📊 Inventory Status</h3>' +
        (lowStock.length > 0 ? '<div class="stock-warning">⚠️ Low stock: ' + lowStock.map(i => i.name).join(', ') + '</div>' : '<p>All stock levels are good ✅</p>') +
        '</div>' +
        '<div class="card"><h3>📈 Sales Report (30 days)</h3>' +
        '<p>💰 Total Sales: $' + (salesReport.totalSales / 100).toFixed(2) + '</p>' +
        '<p>📦 Orders Completed: ' + salesReport.orderCount + '</p>' +
        '<button id="dailyReportBtn" class="btn-secondary small-btn">View Today</button>' +
        '</div></div>' +
        '<div class="panel"><h2>🍕 Menu & Inventory Management</h2>' +
        '<div class="item-list">' + menuHtml + '</div>' +
        '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">' +
        '<input type="text" id="newItemName" placeholder="New item name" style="flex:1"> ' +
        '<input type="number" id="newItemPrice" placeholder="Price (cents)" style="width:120px"> ' +
        '<input type="number" id="newItemStock" placeholder="Stock" style="width:100px"> ' +
        '<button id="addItemBtn" class="btn-primary">Add Item</button>' +
        '</div></div>' +
        '<div class="panel"><h2>📋 All Orders</h2>' +
        '<div style="overflow-x:auto;">' +
        '<table><thead><tr><th>ID</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Update</th><th>Payment Ref</th></tr></thead>' +
        '<tbody>' + ordersHtml + '</tbody></table>' +
        '</div></div>';
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

    /* Customer top-bar uses the dropdown instead of plain logout button */
    return '<div class="top-bar">' +
        '<div class="logo">🍔 FoodieDash <span>Customer</span></div>' +

        /* ── DROPDOWN (customer only) ── */
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

        const dailyBtn = document.getElementById('dailyReportBtn');
        if (dailyBtn) {
            dailyBtn.addEventListener('click', function() {
                const daily = getSalesReport('daily');
                alert('Today\'s Sales: $' + (daily.totalSales / 100).toFixed(2) + ' | Orders: ' + daily.orderCount);
            });
        }
    }

    if (currentUser && currentUser.role === 'customer') {

        /* ── Dropdown toggle ── */
        const dropdownBtn  = document.getElementById('userDropdownBtn');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const dropdownArrow = document.getElementById('dropdownArrow');

        if (dropdownBtn && dropdownMenu) {
            dropdownBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const isOpen = dropdownMenu.classList.toggle('open');
                if (dropdownArrow) dropdownArrow.classList.toggle('open', isOpen);
            });

            /* Close when clicking anywhere outside */
            document.addEventListener('click', function closeDD() {
                dropdownMenu.classList.remove('open');
                if (dropdownArrow) dropdownArrow.classList.remove('open');
            });
        }

        /* ── Scroll to Order History ── */
        const viewOrdersBtn = document.getElementById('viewOrdersDropBtn');
        if (viewOrdersBtn) {
            viewOrdersBtn.addEventListener('click', function() {
                if (dropdownMenu) dropdownMenu.classList.remove('open');
                if (dropdownArrow) dropdownArrow.classList.remove('open');
                const panel = document.getElementById('orderHistoryPanel');
                if (panel) panel.scrollIntoView({ behavior: 'smooth' });
            });
        }

        /* ── Add to cart ── */
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