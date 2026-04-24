<?php
// ============================================================
//  FoodieDash – API Backend
//  Place this file in the same folder as index.php
//  Every request returns JSON.
// ============================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// ---------- DB CONNECTION ----------
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db   = 'food_ordering_db';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

// ---------- HELPERS ----------
function respond($data) {
    echo json_encode($data);
    exit;
}

function respondError($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function castRow($row, $intFields = []) {
    foreach ($intFields as $field) {
        if (isset($row[$field])) {
            $row[$field] = (int)$row[$field];
        }
    }
    return $row;
}

function fetchAllRows($result, $intFields = [], $boolFields = []) {
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $row = castRow($row, $intFields);
        foreach ($boolFields as $field) {
            if (isset($row[$field])) {
                $row[$field] = (bool)$row[$field];
            }
        }
        $rows[] = $row;
    }
    return $rows;
}

function validatePassword($password) {
    if (strlen($password) < 8) {
        respondError('Password must be at least 8 characters long.');
    }
    if (!preg_match('/[A-Z]/', $password))
        respondError('Password must contain at least one uppercase letter.');
    if (!preg_match('/[!@#$%^&*()\[\],.?":{}|<>]/', $password))
        respondError('Password must contain at least one special character.');
}

function checkUsernameExists($conn, $username) {
    $tables = ['customers' => 'customerID', 'users' => 'userID'];
    foreach ($tables as $table => $idField) {
        $chk = $conn->prepare("SELECT $idField FROM $table WHERE username = ?");
        $chk->bind_param('s', $username);
        $chk->execute();
        $chk->store_result();
        if ($chk->num_rows > 0) {
            $chk->close();
            return true;
        }
        $chk->close();
    }
    return false;
}

function findAccount($conn, $table, $idField, $role, $username, $password) {
    $stmt = $conn->prepare(
        "SELECT $idField AS id, username, password, ? AS role FROM $table WHERE username = ?"
    );
    $stmt->bind_param('ss', $role, $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $account = $result->fetch_assoc();
    $stmt->close();
    
    if ($account && verifyAndUpgradePassword($conn, $table, $idField, $account, $password)) {
        return [
            'id' => $account['id'],
            'username' => $account['username'],
            'role' => $account['role']
        ];
    }
    return null;
}

function verifyAndUpgradePassword($conn, $table, $idField, $account, $inputPassword) {
    $storedPassword = $account['password'] ?? '';

    if ($storedPassword === '') {
        return false;
    }

    if (password_verify($inputPassword, $storedPassword)) {
        return true;
    }

    // Backward compatibility for accounts created before hashing was added.
    if (!password_get_info($storedPassword)['algo'] && hash_equals($storedPassword, $inputPassword)) {
        $hashedPassword = password_hash($inputPassword, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE $table SET password = ? WHERE $idField = ?");
        $stmt->bind_param('si', $hashedPassword, $account['id']);
        executePrepared($stmt, 'Failed to upgrade password hash');
        $stmt->close();
        return true;
    }

    return false;
}

function executePrepared($stmt, $errorMessage) {
    if (!$stmt->execute()) {
        $message = $errorMessage . ': ' . $stmt->error;
        $stmt->close();
        respondError($message);
    }
}

function respondSuccess() {
    respond(['success' => true]);
}

// Read raw JSON body (used for POST requests)
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$action = $_GET['action'] ?? '';

// ============================================================
//  ROUTING
// ============================================================
switch ($action) {

    // ── AUTH ────────────────────────────────────────────────

    // GET api.php?action=login&username=X&password=Y
    case 'login': {
        $username = $_GET['username'] ?? '';
        $password = $_GET['password'] ?? '';

        $account = findAccount($conn, 'users', 'userID', 'admin', $username, $password);
        if (!$account) {
            $account = findAccount($conn, 'customers', 'customerID', 'customer', $username, $password);
        }

        if (!$account) respond(['user' => null]);

        respond(['user' => [
            'userID'   => (int)$account['id'],
            'username' => $account['username'],
            'role'     => $account['role'],
        ]]);
    }

    // POST api.php?action=register
    // Body: { username, password }
    case 'register': {
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (!$username || !$password) respondError('Username and password are required.');

        validatePassword($password);

        if (checkUsernameExists($conn, $username)) respondError('Username already exists.');

        // Hash the password before storing
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
        
        $stmt = $conn->prepare("INSERT INTO customers (username, password) VALUES (?, ?)");
        $stmt->bind_param('ss', $username, $hashedPassword);
        executePrepared($stmt, 'Registration failed');
        $newId = $stmt->insert_id;
        $stmt->close();

        respond([
            'user' => [
                'userID'   => $newId,
                'username' => $username,
                'role'     => 'customer',
            ],
            'message' => 'Registration successful! Please login.'
        ]);
    }

    // ── MENU ITEMS ──────────────────────────────────────────

    // GET api.php?action=getMenuItems
    case 'getMenuItems': {
        $result = $conn->query(
            "SELECT m.itemID,
                    COALESCE(m.name, CONCAT('Item #', m.itemID)) AS name,
                    m.price,
                    m.stock,
                    m.categoryID,
                    c.name AS category_name,
                    (m.stock > 0) AS available,
                    m.timeToPrepare
             FROM menu_items m
             LEFT JOIN categories c ON c.categoryID = m.categoryID
             ORDER BY m.itemID"
        );
        respond(fetchAllRows($result, ['itemID', 'price', 'stock', 'categoryID'], ['available']));
    }

    // POST api.php?action=addMenuItem
    // Body: { name, price, stock, categoryID }
    case 'addMenuItem': {
        $name       = trim($body['name'] ?? '');
        $price      = (int)($body['price'] ?? 0);
        $stock      = (int)($body['stock'] ?? 0);
        $categoryID = (int)($body['categoryID'] ?? 1);

        if (!$name)      respondError('Item name is required.');
        if ($price <= 0) respondError('Price must be positive.');
        if ($stock < 0)  respondError('Stock cannot be negative.');

        $stmt = $conn->prepare(
            "INSERT INTO menu_items (name, price, stock, categoryID, timeToPrepare) VALUES (?, ?, ?, ?, NOW())"
        );
        $stmt->bind_param('siii', $name, $price, $stock, $categoryID);
        executePrepared($stmt, 'Failed to add item');
        $newId = $stmt->insert_id;
        $stmt->close();

        respond([
            'itemID'      => $newId,
            'name'        => $name,
            'price'       => $price,
            'stock'       => $stock,
            'categoryID'  => $categoryID,
            'available'   => $stock > 0,
        ]);
    }

    // POST api.php?action=updateStock
    // Body: { itemId, stock }
    case 'updateStock': {
        $itemId   = (int)($body['itemId'] ?? 0);
        $newStock = (int)($body['stock'] ?? -1);

        if ($newStock < 0) respondError('Stock cannot be negative.');

        $stmt = $conn->prepare("UPDATE menu_items SET stock = ? WHERE itemID = ?");
        $stmt->bind_param('ii', $newStock, $itemId);
        executePrepared($stmt, 'Failed to update stock');
        $stmt->close();

        respondSuccess();
    }

    // ── ORDERS ──────────────────────────────────────────────

    // GET api.php?action=getOrders
    // Optional: ?customerId=X  → filter by customer
    case 'getOrders': {
        $customerId = isset($_GET['customerId']) ? (int)$_GET['customerId'] : null;

        $sql = "SELECT
                    o.OrderID,
                    o.Status,
                    o.TotalPayment,
                    c.customerID   AS customer_id,
                    c.username     AS customer_name,
                    p.referenceNumber,
                    o.order_date
                FROM orders o
                LEFT JOIN payments  p ON p.OrderID    = o.OrderID
                LEFT JOIN customers c ON c.customerID = o.customerID";

        if ($customerId) {
            $sql .= " WHERE o.customerID = " . (int)$customerId;
        }
        $sql .= " ORDER BY o.OrderID DESC";

        $result = $conn->query($sql);
        $orders = fetchAllRows($result, ['OrderID', 'TotalPayment', 'customer_id', 'referenceNumber']);
        foreach ($orders as &$order) {
            $order['order_date'] = $order['order_date'] ?? date('Y-m-d H:i:s');
        }
        unset($order);
        respond($orders);
    }

    // POST api.php?action=createOrder
    // Body: { customerId, totalPayment, cartItems: [{itemID, quantity, price}] }
    case 'createOrder': {
        $customerId   = (int)($body['customerId'] ?? 0);
        $totalPayment = (int)($body['totalPayment'] ?? 0);
        $cartItems    = $body['cartItems'] ?? [];

        if (!$customerId)       respondError('Customer ID is required.');
        if ($totalPayment <= 0) respondError('Total payment must be positive.');
        if (empty($cartItems))  respondError('Cart is empty.');

        $conn->begin_transaction();
        try {
            // 1. Create order (linked to customer)
            $stmt = $conn->prepare(
                "INSERT INTO orders (Status, TotalPayment, customerID, order_date) VALUES ('Preparing', ?, ?, NOW())"
            );
            $stmt->bind_param('ii', $totalPayment, $customerId);
            $stmt->execute();
            $orderId = $stmt->insert_id;
            $stmt->close();

            // 2. Add order items & deduct stock
            foreach ($cartItems as $ci) {
                $itemId = (int)$ci['itemID'];
                $qty    = (int)$ci['quantity'];
                $price  = (int)$ci['price'];

                if ($qty <= 0 || $price <= 0) throw new Exception('Invalid cart item data.');

                // Check stock
                $chk = $conn->prepare("SELECT stock FROM menu_items WHERE itemID = ? FOR UPDATE");
                $chk->bind_param('i', $itemId);
                $chk->execute();
                $chk->bind_result($currentStock);
                $chk->fetch();
                $chk->close();

                if ($currentStock < $qty)
                    throw new Exception("Not enough stock for item #$itemId.");

                // Insert order item
                $oi = $conn->prepare(
                    "INSERT INTO orderitems (OrderID, ItemID, quantity, price) VALUES (?, ?, ?, ?)"
                );
                $oi->bind_param('iiii', $orderId, $itemId, $qty, $price);
                $oi->execute();
                $oi->close();

                // Deduct stock
                $upd = $conn->prepare("UPDATE menu_items SET stock = stock - ? WHERE itemID = ?");
                $upd->bind_param('ii', $qty, $itemId);
                $upd->execute();
                $upd->close();
            }

            // 3. Generate payment reference
            $refNum = rand(100000000, 999999999);
            $pay = $conn->prepare(
                "INSERT INTO payments (referenceNumber, OrderID, customerID) VALUES (?, ?, ?)"
            );
            $pay->bind_param('iii', $refNum, $orderId, $customerId);
            $pay->execute();
            $pay->close();

            $conn->commit();
            respond([
                'OrderID'         => $orderId,
                'referenceNumber' => $refNum,
                'Status'          => 'Preparing',
                'TotalPayment'    => $totalPayment,
            ]);
        } catch (Exception $e) {
            $conn->rollback();
            respondError($e->getMessage());
        }
    }

    // POST api.php?action=updateOrderStatus
    // Body: { orderId, status }
    case 'updateOrderStatus': {
        $orderId   = (int)($body['orderId'] ?? 0);
        $newStatus = $body['status'] ?? '';

        $allowed = ['Preparing', 'Complete', 'Cancelled'];
        if (!in_array($newStatus, $allowed)) respondError('Invalid status value.');

        $stmt = $conn->prepare("UPDATE orders SET Status = ? WHERE OrderID = ?");
        $stmt->bind_param('si', $newStatus, $orderId);
        executePrepared($stmt, 'Failed to update status');
        $stmt->close();

        respondSuccess();
    }

    // ── SALES / REPORTS ─────────────────────────────────────

    // GET api.php?action=getSalesReport&period=daily|monthly
    case 'getSalesReport': {
        $period = $_GET['period'] ?? 'monthly';

        if ($period === 'daily') {
            $sql = "SELECT COALESCE(SUM(TotalPayment),0) AS totalSales, COUNT(*) AS orderCount
                    FROM orders
                    WHERE Status = 'Complete' AND DATE(order_date) = CURDATE()";
        } else {
            $sql = "SELECT COALESCE(SUM(TotalPayment),0) AS totalSales, COUNT(*) AS orderCount
                    FROM orders
                    WHERE Status = 'Complete' AND order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }

        $result = $conn->query($sql);
        $row = $result->fetch_assoc();
        respond([
            'totalSales'  => (int)$row['totalSales'],
            'orderCount'  => (int)$row['orderCount'],
        ]);
    }

    // GET api.php?action=getOrderStats
    case 'getOrderStats': {
        $result = $conn->query(
            "SELECT Status, COUNT(*) AS cnt FROM orders GROUP BY Status"
        );
        $stats = ['Preparing' => 0, 'Complete' => 0, 'Cancelled' => 0];
        while ($row = $result->fetch_assoc()) {
            $stats[$row['Status']] = (int)$row['cnt'];
        }
        respond($stats);
    }

    // GET api.php?action=getSalesByDate
    case 'getSalesByDate': {
        $result = $conn->query(
            "SELECT DATE(order_date) AS sale_date,
                    COUNT(*) AS order_count,
                    SUM(TotalPayment) AS revenue
             FROM orders
             WHERE Status = 'Complete'
             GROUP BY DATE(order_date)
             ORDER BY sale_date DESC
             LIMIT 30"
        );
        respond(fetchAllRows($result, ['order_count', 'revenue']));
    }

    // GET api.php?action=getSalesByCustomer
    case 'getSalesByCustomer': {
        $result = $conn->query(
            "SELECT c.username AS customer_name,
                    COUNT(o.OrderID) AS order_count,
                    SUM(o.TotalPayment) AS revenue
             FROM orders o
             JOIN customers c ON c.customerID = o.customerID
             WHERE o.Status = 'Complete'
             GROUP BY c.username
             ORDER BY revenue DESC"
        );
        respond(fetchAllRows($result, ['order_count', 'revenue']));
    }

    // ── CATEGORIES ──────────────────────────────────────────

    // GET api.php?action=getCategories
    case 'getCategories': {
        $result = $conn->query("SELECT categoryID, name FROM categories ORDER BY categoryID");
        respond(fetchAllRows($result, ['categoryID']));
    }
    
    // NEW: Get all users with masked passwords (for admin view)
    case 'getUsers': {
        $result = $conn->query(
            "SELECT customerID as id, username, 'customer' as role, 
             '******** (encrypted)' as password_display
             FROM customers 
             UNION ALL 
             SELECT userID as id, username, 'admin' as role,
             '******** (encrypted)' as password_display
             FROM users
             ORDER BY role, username"
        );
        respond(fetchAllRows($result, ['id']));
    }

    // Add this new case for forgot password request
case 'forgotPassword': {
    $username = $body['username'] ?? '';
    $email = $body['email'] ?? '';
    
    if (!$username) respondError('Username is required.');
    
    // Check if user exists
    $table = null;
    $idField = null;
    $userData = null;
    
    // Check in customers table
    $stmt = $conn->prepare("SELECT customerID, username, email FROM customers WHERE username = ?");
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $userData = $result->fetch_assoc();
    $stmt->close();
    
    if (!$userData) {
        // Check in users table (admin)
        $stmt = $conn->prepare("SELECT userID, username, email FROM users WHERE username = ?");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $userData = $result->fetch_assoc();
        $stmt->close();
    }
    
    if (!$userData) {
        respondError('Username not found.');
    }
    
    // Generate a unique reset token
    $resetToken = bin2hex(random_bytes(32));
    $tokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));
    
    // Store reset token in a new table (create this table)
    $stmt = $conn->prepare("
        INSERT INTO password_resets (username, token, expiry, created_at) 
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        token = VALUES(token), 
        expiry = VALUES(expiry),
        created_at = NOW()
    ");
    $stmt->bind_param('sss', $username, $resetToken, $tokenExpiry);
    $stmt->execute();
    $stmt->close();
    
    // In a real application, you would send an email here
    // For demo purposes, we'll return the reset link
    respond([
        'success' => true,
        'message' => 'Password reset link generated. Use this token to reset your password.',
        'reset_token' => $resetToken, // In production, email this instead
        'reset_link' => "reset-password.html?token=$resetToken&username=" . urlencode($username)
    ]);
}

// Add this case for resetting password
case 'resetPassword': {
    $token = $body['token'] ?? '';
    $username = $body['username'] ?? '';
    $newPassword = $body['newPassword'] ?? '';
    $confirmPassword = $body['confirmPassword'] ?? '';
    
    if (!$token || !$username) respondError('Token and username are required.');
    if (!$newPassword || !$confirmPassword) respondError('New password and confirmation are required.');
    if ($newPassword !== $confirmPassword) respondError('Passwords do not match.');
    
    // Validate password strength
    validatePassword($newPassword);
    
    // Verify token
    $stmt = $conn->prepare("
        SELECT * FROM password_resets 
        WHERE username = ? AND token = ? AND expiry > NOW()
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->bind_param('ss', $username, $token);
    $stmt->execute();
    $result = $stmt->get_result();
    $resetRecord = $result->fetch_assoc();
    $stmt->close();
    
    if (!$resetRecord) {
        respondError('Invalid or expired reset token. Please request a new password reset.');
    }
    
    // Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // Update password in appropriate table
    $updated = false;
    
    // Try updating in customers table
    $stmt = $conn->prepare("UPDATE customers SET password = ? WHERE username = ?");
    $stmt->bind_param('ss', $hashedPassword, $username);
    $stmt->execute();
    if ($stmt->affected_rows > 0) $updated = true;
    $stmt->close();
    
    // If not found in customers, try users table
    if (!$updated) {
        $stmt = $conn->prepare("UPDATE users SET password = ? WHERE username = ?");
        $stmt->bind_param('ss', $hashedPassword, $username);
        $stmt->execute();
        if ($stmt->affected_rows > 0) $updated = true;
        $stmt->close();
    }
    
    if (!$updated) {
        respondError('User not found.');
    }
    
    // Delete used reset token
    $stmt = $conn->prepare("DELETE FROM password_resets WHERE username = ? AND token = ?");
    $stmt->bind_param('ss', $username, $token);
    $stmt->execute();
    $stmt->close();
    
    respond([
        'success' => true,
        'message' => 'Password has been reset successfully! Please login with your new password.'
    ]);
}

    // Add this case to verify reset token
    case 'verifyResetToken': {
        $token = $_GET['token'] ?? '';
        $username = $_GET['username'] ?? '';
        
        if (!$token || !$username) {
            respond(['valid' => false, 'message' => 'Missing token or username']);
        }
        
        $stmt = $conn->prepare("
            SELECT * FROM password_resets 
            WHERE username = ? AND token = ? AND expiry > NOW()
        ");
        $stmt->bind_param('ss', $username, $token);
        $stmt->execute();
        $result = $stmt->get_result();
        $valid = $result->num_rows > 0;
        $stmt->close();
        
        respond(['valid' => $valid]);
    }

    default:
        respondError("Unknown action: '$action'", 404);
}

$conn->close();
