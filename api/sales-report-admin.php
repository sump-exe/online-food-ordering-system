<?php

$adminSalesReportActions = [
    'getSalesReport' => function ($conn, $body) {
        $period = $_GET['period'] ?? 'monthly';
        $startDate = $_GET['startDate'] ?? null;
        $endDate = $_GET['endDate'] ?? null;
        
        $dateCondition = "";
        
        if ($period === 'daily') {
            $dateCondition = "AND DATE(order_date) = CURDATE()";
        } elseif ($period === 'weekly') {
            $dateCondition = "AND order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } elseif ($period === 'monthly') {
            $dateCondition = "AND order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        } elseif ($period === 'yearly') {
            $dateCondition = "AND order_date >= DATE_SUB(NOW(), INTERVAL 365 DAY)";
        } elseif ($period === 'custom' && $startDate && $endDate) {
            $startDate = $conn->real_escape_string($startDate);
            $endDate = $conn->real_escape_string($endDate);
            $dateCondition = "AND DATE(order_date) BETWEEN '$startDate' AND '$endDate'";
        }
        
        $sql = "SELECT COALESCE(SUM(TotalPayment), 0) AS totalSales, COUNT(*) AS orderCount
                FROM orders
                WHERE Status = 'Complete' $dateCondition";
        
        $result = $conn->query($sql);
        $row = $result->fetch_assoc();
        respond([
            'totalSales' => (int)($row['totalSales'] ?? 0),
            'orderCount' => (int)($row['orderCount'] ?? 0),
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
        $period = $_GET['period'] ?? 'monthly';
        $startDate = $_GET['startDate'] ?? null;
        $endDate = $_GET['endDate'] ?? null;
        
        $dateCondition = "";
        $groupBy = "DATE(order_date)";
        
        if ($period === 'daily') {
            $dateCondition = "AND DATE(order_date) = CURDATE()";
            $groupBy = "DATE(order_date)";
        } elseif ($period === 'weekly') {
            $dateCondition = "AND order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            $groupBy = "DATE(order_date)";
        } elseif ($period === 'monthly') {
            $dateCondition = "AND order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            $groupBy = "DATE(order_date)";
        } elseif ($period === 'yearly') {
            $dateCondition = "AND order_date >= DATE_SUB(NOW(), INTERVAL 365 DAY)";
            $groupBy = "DATE_FORMAT(order_date, '%Y-%m')";
        } elseif ($period === 'custom' && $startDate && $endDate) {
            $startDate = $conn->real_escape_string($startDate);
            $endDate = $conn->real_escape_string($endDate);
            $dateCondition = "AND DATE(order_date) BETWEEN '$startDate' AND '$endDate'";
            $groupBy = "DATE(order_date)";
        }
        
        $sql = "SELECT DATE(order_date) AS sale_date,
                       COUNT(*) AS order_count,
                       SUM(TotalPayment) AS revenue
                FROM orders
                WHERE Status = 'Complete' $dateCondition
                GROUP BY $groupBy
                ORDER BY sale_date DESC
                LIMIT 30";
        
        $result = $conn->query($sql);
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'sale_date' => $row['sale_date'] ?? date('Y-m-d'),
                'order_count' => (int)$row['order_count'],
                'revenue' => (int)($row['revenue'] ?? 0)
            ];
        }
        respond($rows);
    },
    
    'getSalesByCustomer' => function ($conn, $body) {
        $period = $_GET['period'] ?? 'monthly';
        $startDate = $_GET['startDate'] ?? null;
        $endDate = $_GET['endDate'] ?? null;
        
        $dateCondition = "";
        
        if ($period === 'daily') {
            $dateCondition = "AND DATE(o.order_date) = CURDATE()";
        } elseif ($period === 'weekly') {
            $dateCondition = "AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } elseif ($period === 'monthly') {
            $dateCondition = "AND o.order_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        } elseif ($period === 'yearly') {
            $dateCondition = "AND o.order_date >= DATE_SUB(NOW(), INTERVAL 365 DAY)";
        } elseif ($period === 'custom' && $startDate && $endDate) {
            $startDate = $conn->real_escape_string($startDate);
            $endDate = $conn->real_escape_string($endDate);
            $dateCondition = "AND DATE(o.order_date) BETWEEN '$startDate' AND '$endDate'";
        }
        
        $sql = "SELECT c.username AS customer_name,
                       COUNT(o.OrderID) AS order_count,
                       SUM(o.TotalPayment) AS revenue
                FROM orders o
                JOIN customers c ON c.customerID = o.customerID
                WHERE o.Status = 'Complete' $dateCondition
                GROUP BY c.username
                ORDER BY revenue DESC
                LIMIT 20";
        
        $result = $conn->query($sql);
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'customer_name' => $row['customer_name'],
                'order_count' => (int)$row['order_count'],
                'revenue' => (int)($row['revenue'] ?? 0)
            ];
        }
        respond($rows);
    },
];