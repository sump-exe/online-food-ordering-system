<?php

$adminSalesReportActions = [
    'getSalesReport' => function ($conn, $body) {
        $period = $_GET['period'] ?? 'monthly';

        if ($period === 'daily') {
            $sql = "SELECT COALESCE(SUM(TotalPayment), 0) AS totalSales, COUNT(*) AS orderCount
                    FROM orders
                    WHERE Status = 'Complete' AND DATE(order_date) = CURDATE()";
        } else {
            $sql = "SELECT COALESCE(SUM(TotalPayment), 0) AS totalSales, COUNT(*) AS orderCount
                    FROM orders
                    WHERE Status = 'Complete' AND order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }

        $result = $conn->query($sql);
        $row = $result->fetch_assoc();
        respond([
            'totalSales' => (int)$row['totalSales'],
            'orderCount' => (int)$row['orderCount'],
        ]);
    },
    'getOrderStats' => function ($conn, $body) {
        $result = $conn->query("SELECT Status, COUNT(*) AS cnt FROM orders GROUP BY Status");
        $stats = ['Preparing' => 0, 'Complete' => 0, 'Cancelled' => 0];
        while ($row = $result->fetch_assoc()) {
            $stats[$row['Status']] = (int)$row['cnt'];
        }
        respond($stats);
    },
    'getSalesByDate' => function ($conn, $body) {
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
    },
    'getSalesByCustomer' => function ($conn, $body) {
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
    },
];

