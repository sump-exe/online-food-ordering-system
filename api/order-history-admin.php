<?php

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
];

