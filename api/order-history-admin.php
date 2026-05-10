<?php
// ============================================================
// File: api/order-history-admin.php (added getOrderDetails)
// ============================================================

$adminOrderHistoryActions = [
    'getAllOrders' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT
                o.OrderID,
                o.Status,
                o.TotalPayment,
                c.customerID AS customer_id,
                c.username AS customer_name,
                p.referenceNumber,
                o.order_date
             FROM orders o
             LEFT JOIN payments p ON p.OrderID = o.OrderID
             LEFT JOIN customers c ON c.customerID = o.customerID
             WHERE o.Status != 'In Cart'
             ORDER BY o.OrderID DESC"
        );
        $orders = fetchAllRows($result, ['OrderID', 'TotalPayment', 'customer_id', 'referenceNumber']);
        foreach ($orders as &$order) {
            $order['order_date'] = $order['order_date'] ?? date('Y-m-d H:i:s');
        }
        unset($order);
        respond($orders);
    },
    'updateOrderStatusAdmin' => function ($conn, $body) {
        $orderId   = (int)($body['orderId'] ?? 0);
        $newStatus = $body['status'] ?? '';

        $allowed = ['Preparing', 'Complete', 'Cancelled'];
        if (!in_array($newStatus, $allowed, true)) {
            respondError('Invalid status value.');
        }

        $stmt = $conn->prepare("UPDATE orders SET Status = ? WHERE OrderID = ?");
        $stmt->bind_param('si', $newStatus, $orderId);
        executePrepared($stmt, 'Failed to update status');
        $stmt->close();

        respondSuccess();
    },
    // New: get detailed order items for a specific order
    'getOrderDetails' => function ($conn, $body) {
        $orderId = (int)($_GET['orderId'] ?? 0);
        if ($orderId <= 0) {
            respondError('Invalid order ID.');
        }

        $stmt = $conn->prepare("
            SELECT oi.ItemID, oi.quantity, oi.price,
                   COALESCE(m.name, 'Item has been deleted') AS item_name
            FROM orderitems oi
            LEFT JOIN menu_items m ON m.itemID = oi.ItemID
            WHERE oi.OrderID = ?
        ");
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = [
                'itemID' => (int)$row['ItemID'],
                'item_name' => $row['item_name'],
                'quantity' => (int)$row['quantity'],
                'price' => (int)$row['price'],
                'subtotal' => (int)$row['price'] * (int)$row['quantity']
            ];
        }
        $stmt->close();

        respond($items);
    },
];
