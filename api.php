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

        $stmt = $conn->prepare(
            "SELECT userID, username, password FROM Users WHERE username = ? AND password = ?"
        );
        $stmt->bind_param('ss', $username, $password);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();
        $stmt->close();

        if (!$user) respond(['user' => null]);

        // Detect admin by username convention (username === 'admin')
        $user['role'] = ($user['username'] === 'admin') ? 'admin' : 'customer';
        respond(['user' => $user]);
    }

    // POST api.php?action=register
    // Body: { username, password }
    case 'register': {
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (!$username || !$password) respondError('Username and password are required.');

        // Password validation (mirrors DB constraints)
        if (!preg_match('/[A-Z]/', $password))
            respondError('Password must contain at least one uppercase letter.');
        if (!preg_match('/[!@#$%^&*()\[\],.?":{}|<>]/', $password))
            respondError('Password must contain at least one special character.');

        // Check duplicate
        $chk = $conn->prepare("SELECT userID FROM Users WHERE username = ?");
        $chk->bind_param('s', $username);
        $chk->execute();
        $chk->store_result();
        if ($chk->num_rows > 0) respondError('Username already exists.');
        $chk->close();

        $stmt = $conn->prepare("INSERT INTO Users (username, password) VALUES (?, ?)");
        $stmt->bind_param('ss', $username, $password);
        if (!$stmt->execute()) respondError('Registration failed: ' . $stmt->error);
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
        // NOTE: Menu_Items table has no "name" column per the schema.
        // We store name in a VARCHAR added during init, or you can add it.
        // The app.js requires: itemID, name, price, stock, available
        $result = $conn->query(
            "SELECT itemID,
                    COALESCE(name, CONCAT('Item #', itemID)) AS name,
                    price,
                    stock,
                    category_id,
                    (stock > 0) AS available,
                    timeToPrepare
             FROM Menu_Items
             ORDER BY itemID"
        );
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $row['itemID']    = (int)$row['itemID'];
            $row['price']     = (int)$row['price'];
            $row['stock']     = (int)$row['stock'];
            $row['available'] = (bool)$row['available'];
            $row['category_id'] = isset($row['category_id']) ? (int)$row['category_id'] : 1;
            $items[] = $row;
        }
        respond($items);
    }

    // POST api.php?action=addMenuItem
    // Body: { name, price, stock, category_id }
    case 'addMenuItem': {
        $name       = trim($body['name'] ?? '');
        $price      = (int)($body['price'] ?? 0);
        $stock      = (int)($body['stock'] ?? 0);
        $categoryId = (int)($body['category_id'] ?? 1);

        if (!$name)    respondError('Item name is required.');
        if ($price <= 0) respondError('Price must be positive.');
        if ($stock < 0)  respondError('Stock cannot be negative.');

        $stmt = $conn->prepare(
            "INSERT INTO Menu_Items (name, price, stock, category_id, timeToPrepare) VALUES (?, ?, ?, ?, NOW())"
        );
        $stmt->bind_param('siii', $name, $price, $stock, $categoryId);
        if (!$stmt->execute()) respondError('Failed to add item: ' . $stmt->error);
        $newId = $stmt->insert_id;
        $stmt->close();

        respond([
            'itemID'      => $newId,
            'name'        => $name,
            'price'       => $price,
            'stock'       => $stock,
            'category_id' => $categoryId,
            'available'   => $stock > 0,
        ]);
    }

    // POST api.php?action=updateStock
    // Body: { itemId, stock }
    case 'updateStock': {
        $itemId   = (int)($body['itemId'] ?? 0);
        $newStock = (int)($body['stock'] ?? -1);

        if ($newStock < 0) respondError('Stock cannot be negative.');

        $stmt = $conn->prepare("UPDATE Menu_Items SET stock = ? WHERE itemID = ?");
        $stmt->bind_param('ii', $newStock, $itemId);
        if (!$stmt->execute()) respondError('Failed to update stock: ' . $stmt->error);
        $stmt->close();

        respond(['success' => true]);
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
                    p.UserID       AS customer_id,
                    u.username     AS customer_name,
                    p.referenceNumber,
                    o.order_date
                FROM Orders o
                LEFT JOIN Payments p ON p.OrderID = o.OrderID
                LEFT JOIN Users    u ON u.userID  = p.UserID";

        if ($customerId) {
            $sql .= " WHERE p.UserID = $customerId";
        }
        $sql .= " ORDER BY o.OrderID DESC";

        $result = $conn->query($sql);
        $orders = [];
        while ($row = $result->fetch_assoc()) {
            $row['OrderID']         = (int)$row['OrderID'];
            $row['TotalPayment']    = (int)$row['TotalPayment'];
            $row['customer_id']     = isset($row['customer_id']) ? (int)$row['customer_id'] : null;
            $row['referenceNumber'] = isset($row['referenceNumber']) ? (int)$row['referenceNumber'] : null;
            // Provide an order_date fallback if column doesn't exist yet
            $row['order_date'] = $row['order_date'] ?? date('Y-m-d H:i:s');
            $orders[] = $row;
        }
        respond($orders);
    }

    // POST api.php?action=createOrder
    // Body: { customerId, totalPayment, cartItems: [{itemID, quantity, price}] }
    case 'createOrder': {
        $customerId   = (int)($body['customerId'] ?? 0);
        $totalPayment = (int)($body['totalPayment'] ?? 0);
        $cartItems    = $body['cartItems'] ?? [];

        if (!$customerId)      respondError('Customer ID is required.');
        if ($totalPayment <= 0) respondError('Total payment must be positive.');
        if (empty($cartItems)) respondError('Cart is empty.');

        $conn->begin_transaction();
        try {
            // 1. Create order
            $stmt = $conn->prepare(
                "INSERT INTO Orders (Status, TotalPayment, order_date) VALUES ('Preparing', ?, NOW())"
            );
            $stmt->bind_param('i', $totalPayment);
            $stmt->execute();
            $orderId = $stmt->insert_id;
            $stmt->close();

            // 2. Add order items & deduct stock
            foreach ($cartItems as $ci) {
                $itemId  = (int)$ci['itemID'];
                $qty     = (int)$ci['quantity'];
                $price   = (int)$ci['price'];

                if ($qty <= 0 || $price <= 0) throw new Exception('Invalid cart item data.');

                // Check stock
                $chk = $conn->prepare("SELECT stock FROM Menu_Items WHERE itemID = ? FOR UPDATE");
                $chk->bind_param('i', $itemId);
                $chk->execute();
                $chk->bind_result($currentStock);
                $chk->fetch();
                $chk->close();

                if ($currentStock < $qty)
                    throw new Exception("Not enough stock for item #$itemId.");

                // Insert order item
                $oi = $conn->prepare(
                    "INSERT INTO OrderItems (OrderID, ItemID, quantity, price) VALUES (?, ?, ?, ?)"
                );
                $oi->bind_param('iiii', $orderId, $itemId, $qty, $price);
                $oi->execute();
                $oi->close();

                // Deduct stock
                $upd = $conn->prepare("UPDATE Menu_Items SET stock = stock - ? WHERE itemID = ?");
                $upd->bind_param('ii', $qty, $itemId);
                $upd->execute();
                $upd->close();
            }

            // 3. Generate payment reference
            $refNum = rand(100000000, 999999999);
            $pay = $conn->prepare(
                "INSERT INTO Payments (referenceNumber, OrderID, UserID) VALUES (?, ?, ?)"
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

        $stmt = $conn->prepare("UPDATE Orders SET Status = ? WHERE OrderID = ?");
        $stmt->bind_param('si', $newStatus, $orderId);
        if (!$stmt->execute()) respondError('Failed to update status: ' . $stmt->error);
        $stmt->close();

        respond(['success' => true]);
    }

    // ── SALES / REPORTS ─────────────────────────────────────

    // GET api.php?action=getSalesReport&period=daily|monthly
    case 'getSalesReport': {
        $period = $_GET['period'] ?? 'monthly';

        if ($period === 'daily') {
            $sql = "SELECT COALESCE(SUM(TotalPayment),0) AS totalSales, COUNT(*) AS orderCount
                    FROM Orders
                    WHERE Status = 'Complete' AND DATE(order_date) = CURDATE()";
        } else {
            $sql = "SELECT COALESCE(SUM(TotalPayment),0) AS totalSales, COUNT(*) AS orderCount
                    FROM Orders
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
            "SELECT Status, COUNT(*) AS cnt FROM Orders GROUP BY Status"
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
             FROM Orders
             WHERE Status = 'Complete'
             GROUP BY DATE(order_date)
             ORDER BY sale_date DESC
             LIMIT 30"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['order_count'] = (int)$row['order_count'];
            $row['revenue']     = (int)$row['revenue'];
            $rows[] = $row;
        }
        respond($rows);
    }

    // GET api.php?action=getSalesByCustomer
    case 'getSalesByCustomer': {
        $result = $conn->query(
            "SELECT u.username AS customer_name,
                    COUNT(o.OrderID) AS order_count,
                    SUM(o.TotalPayment) AS revenue
             FROM Orders o
             JOIN Payments p ON p.OrderID = o.OrderID
             JOIN Users    u ON u.userID  = p.UserID
             WHERE o.Status = 'Complete'
             GROUP BY u.username
             ORDER BY revenue DESC"
        );
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['order_count'] = (int)$row['order_count'];
            $row['revenue']     = (int)$row['revenue'];
            $rows[] = $row;
        }
        respond($rows);
    }

    // ── DB INITIALISATION (run once) ─────────────────────────

    // GET api.php?action=initSampleData
    // Adds sample users/items/orders if tables are empty. Safe to call repeatedly.
    case 'initSampleData': {
        $msgs = [];

        // Users
        $r = $conn->query("SELECT COUNT(*) AS c FROM Users");
        if ((int)$r->fetch_assoc()['c'] === 0) {
            $conn->query("INSERT INTO Users (username, password) VALUES ('admin','Admin123!'),('john_doe','JohnDoe123!'),('emma_watson','Emma456!')");
            $msgs[] = 'Users seeded.';
        }

        // Menu items – requires name column; add it if missing
        $cols = $conn->query("SHOW COLUMNS FROM Menu_Items LIKE 'name'");
        if ($cols->num_rows === 0) {
            $conn->query("ALTER TABLE Menu_Items ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT '' AFTER itemID");
            $msgs[] = 'Added name column to Menu_Items.';
        }
        $cols2 = $conn->query("SHOW COLUMNS FROM Menu_Items LIKE 'category_id'");
        if ($cols2->num_rows === 0) {
            $conn->query("ALTER TABLE Menu_Items ADD COLUMN category_id INT NOT NULL DEFAULT 1 AFTER name");
            $msgs[] = 'Added category_id column to Menu_Items.';
        }

        $r2 = $conn->query("SELECT COUNT(*) AS c FROM Menu_Items");
        if ((int)$r2->fetch_assoc()['c'] === 0) {
            $conn->query("INSERT INTO Menu_Items (name, price, stock, category_id, timeToPrepare) VALUES
                ('Margherita Pizza', 1299, 50, 1, NOW()),
                ('Pepperoni Feast',  1549, 35, 1, NOW()),
                ('Classic Cheeseburger', 999, 45, 2, NOW()),
                ('Vegan Burger',    1149, 30, 2, NOW()),
                ('Caesar Salad',     899, 60, 3, NOW()),
                ('Iced Tea',         299,100, 4, NOW())");
            $msgs[] = 'Menu items seeded.';
        }

        // Orders table – add order_date if missing
        $colsOrd = $conn->query("SHOW COLUMNS FROM Orders LIKE 'order_date'");
        if ($colsOrd->num_rows === 0) {
            $conn->query("ALTER TABLE Orders ADD COLUMN order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
            $msgs[] = 'Added order_date column to Orders.';
        }

        // Sample order
        $r3 = $conn->query("SELECT COUNT(*) AS c FROM Orders");
        if ((int)$r3->fetch_assoc()['c'] === 0) {
            $customer = $conn->query("SELECT userID FROM Users WHERE username='john_doe'")->fetch_assoc();
            if ($customer) {
                $cid = (int)$customer['userID'];
                $conn->query("INSERT INTO Orders (Status, TotalPayment, order_date) VALUES ('Complete', 2598, NOW())");
                $oid = $conn->insert_id;
                $conn->query("INSERT INTO OrderItems (OrderID, ItemID, quantity, price) VALUES ($oid, 1, 2, 1299)");
                $conn->query("INSERT INTO Payments (referenceNumber, OrderID, UserID) VALUES (123456789, $oid, $cid)");
                $conn->query("UPDATE Menu_Items SET stock = stock - 2 WHERE itemID = 1");
                $msgs[] = 'Sample order created.';
            }
        }

        respond(['success' => true, 'messages' => $msgs]);
    }

    default:
        respondError("Unknown action: '$action'", 404);
}

$conn->close();