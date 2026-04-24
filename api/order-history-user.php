<?php

$userOrderHistoryActions = [
    'getOrders' => function ($conn, $body) {
        $customerId = isset($_GET['customerId']) ? (int)$_GET['customerId'] : null;

        if (!$customerId) {
            respondError('Customer ID is required.');
        }

        $stmt = $conn->prepare(
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
             WHERE o.customerID = ?
             ORDER BY o.OrderID DESC"
        );
        $stmt->bind_param('i', $customerId);
        $stmt->execute();
        $result = $stmt->get_result();
        $orders = fetchAllRows($result, ['OrderID', 'TotalPayment', 'customer_id', 'referenceNumber']);
        $stmt->close();

        foreach ($orders as &$order) {
            $order['order_date'] = $order['order_date'] ?? date('Y-m-d H:i:s');
        }
        unset($order);

        respond($orders);
    },
    'updateOrderStatus' => function ($conn, $body) {
        $orderId = (int)($body['orderId'] ?? 0);
        $newStatus = $body['status'] ?? '';

        if ($newStatus !== 'Cancelled') {
            respondError('Users can only cancel orders.');
        }

        $stmt = $conn->prepare("UPDATE orders SET Status = ? WHERE OrderID = ?");
        $stmt->bind_param('si', $newStatus, $orderId);
        executePrepared($stmt, 'Failed to cancel order');
        $stmt->close();

        respondSuccess();
    },
];

