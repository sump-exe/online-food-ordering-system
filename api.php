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

        // Check admins (users table) first
        $stmt = $conn->prepare(
            "SELECT userID AS id, username, 'admin' AS role FROM users WHERE username = ? AND password = ?"
        );
        $stmt->bind_param('ss', $username, $password);
        $stmt->execute();
        $result = $stmt->get_result();
        $account = $result->fetch_assoc();
        $stmt->close();

        // If not admin, check customers table
        if (!$account) {
            $stmt = $conn->prepare(
                "SELECT customerID AS id, username, 'customer' AS role FROM customers WHERE username = ? AND password = ?"
            );
            $stmt->bind_param('ss', $username, $password);
            $stmt->execute();
            $result = $stmt->get_result();
            $account = $result->fetch_assoc();
            $stmt->close();
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

        // Password validation
        if (!preg_match('/[A-Z]/', $password))
            respondError('Password must contain at least one uppercase letter.');
        if (!preg_match('/[!@#$%^&*()\[\],.?":{}|<>]/', $password))
            respondError('Password must contain at least one special character.');

        // Check duplicate in both tables
        $chk = $conn->prepare("SELECT customerID FROM customers WHERE username = ?");
        $chk->bind_param('s', $username);
        $chk->execute();
        $chk->store_result();
        if ($chk->num_rows > 0) respondError('Username already exists.');
        $chk->close();

        $chk2 = $conn->prepare("SELECT userID FROM users WHERE username = ?");
        $chk2->bind_param('s', $username);
        $chk2->execute();
        $chk2->store_result();
        if ($chk2->num_rows > 0) respondError('Username already exists.');
        $chk2->close();

        $stmt = $conn->prepare("INSERT INTO customers (username, password) VALUES (?, ?)");
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
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $row['itemID']     = (int)$row['itemID'];
            $row['price']      = (int)$row['price'];
            $row['stock']      = (int)$row['stock'];
            $row['available']  = (bool)$row['available'];
            $row['categoryID'] = (int)$row['categoryID'];
            $items[] = $row;
        }
        respond($items);
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
        if (!$stmt->execute()) respondError('Failed to add item: ' . $stmt->error);
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
        $orders = [];
        while ($row = $result->fetch_assoc()) {
            $row['OrderID']         = (int)$row['OrderID'];
            $row['TotalPayment']    = (int)$row['TotalPayment'];
            $row['customer_id']     = isset($row['customer_id']) ? (int)$row['customer_id'] : null;
            $row['referenceNumber'] = isset($row['referenceNumber']) ? (int)$row['referenceNumber'] : null;
            $row['order_date']      = $row['order_date'] ?? date('Y-m-d H:i:s');
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
            "SELECT c.username AS customer_name,
                    COUNT(o.OrderID) AS order_count,
                    SUM(o.TotalPayment) AS revenue
             FROM orders o
             JOIN customers c ON c.customerID = o.customerID
             WHERE o.Status = 'Complete'
             GROUP BY c.username
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

    // ── CATEGORIES ──────────────────────────────────────────

    // GET api.php?action=getCategories
    case 'getCategories': {
        $result = $conn->query("SELECT categoryID, name FROM categories ORDER BY categoryID");
        $cats = [];
        while ($row = $result->fetch_assoc()) {
            $row['categoryID'] = (int)$row['categoryID'];
            $cats[] = $row;
        }
        respond($cats);
    }

    default:
        respondError("Unknown action: '$action'", 404);
}

$conn->close();