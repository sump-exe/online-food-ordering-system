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
        $year = $_GET['year'] ?? null;
        $month = $_GET['month'] ?? null;
        $day = $_GET['day'] ?? null;
        $username = $_GET['username'] ?? null;
        
        $dateCondition = "";
        
        if ($year && $year !== 'null') {
            $year = $conn->real_escape_string($year);
            $dateCondition .= " AND YEAR(o.order_date) = '$year'";
        }
        
        if ($month && $month !== 'null') {
            $month = $conn->real_escape_string($month);
            $dateCondition .= " AND MONTH(o.order_date) = '$month'";
        }
        
        if ($day && $day !== 'null') {
            $day = $conn->real_escape_string($day);
            $dateCondition .= " AND DAY(o.order_date) = '$day'";
        }
        
        $userCondition = "";
        if ($username && $username !== 'null') {
            $username = $conn->real_escape_string($username);
            $userCondition = " JOIN customers c ON o.customerID = c.customerID AND c.username = '$username'";
        }
        
        $sql = "SELECT DATE(o.order_date) AS sale_date,
                       COUNT(*) AS order_count,
                       SUM(o.TotalPayment) AS revenue
                FROM orders o
                $userCondition
                WHERE o.Status = 'Complete' $dateCondition
                GROUP BY DATE(o.order_date)
                ORDER BY sale_date DESC
                LIMIT 30";
        
        $result = $conn->query($sql);
        if (!$result) {
            respond([]);
            return;
        }
        
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
        $year = $_GET['year'] ?? null;
        $month = $_GET['month'] ?? null;
        $day = $_GET['day'] ?? null;
        $username = $_GET['username'] ?? null;
        
        $dateCondition = "";
        
        if ($year && $year !== 'null') {
            $year = $conn->real_escape_string($year);
            $dateCondition .= " AND YEAR(o.order_date) = '$year'";
        }
        
        if ($month && $month !== 'null') {
            $month = $conn->real_escape_string($month);
            $dateCondition .= " AND MONTH(o.order_date) = '$month'";
        }
        
        if ($day && $day !== 'null') {
            $day = $conn->real_escape_string($day);
            $dateCondition .= " AND DAY(o.order_date) = '$day'";
        }
        
        $userCondition = "";
        if ($username && $username !== 'null') {
            $username = $conn->real_escape_string($username);
            $userCondition = " AND c.username = '$username'";
        }
        
        $sql = "SELECT c.username AS customer_name,
                       COUNT(o.OrderID) AS order_count,
                       SUM(o.TotalPayment) AS revenue
                FROM orders o
                JOIN customers c ON c.customerID = o.customerID
                WHERE o.Status = 'Complete' $dateCondition $userCondition
                GROUP BY c.username
                ORDER BY revenue DESC
                LIMIT 20";
        
        $result = $conn->query($sql);
        if (!$result) {
            respond([]);
            return;
        }
        
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
    
    'getMostOrderedItem' => function ($conn, $body) {
        $year = $_GET['year'] ?? '';
        $month = $_GET['month'] ?? '';
        $day = $_GET['day'] ?? '';
        $username = $_GET['username'] ?? '';
        
        $conditions = ["o.Status = 'Complete'"];
        
        if (!empty($year) && $year !== 'null') {
            $year = $conn->real_escape_string($year);
            $conditions[] = "YEAR(o.order_date) = '$year'";
        }
        
        if (!empty($month) && $month !== 'null') {
            $month = $conn->real_escape_string($month);
            $conditions[] = "MONTH(o.order_date) = '$month'";
        }
        
        if (!empty($day) && $day !== 'null') {
            $day = $conn->real_escape_string($day);
            $conditions[] = "DAY(o.order_date) = '$day'";
        }
        
        $whereClause = implode(' AND ', $conditions);
        
        $userJoinClause = "";
        if (!empty($username) && $username !== 'null') {
            $username = $conn->real_escape_string($username);
            $userJoinClause = "JOIN customers c ON o.customerID = c.customerID AND c.username = '$username'";
        }
        
        $sql = "SELECT mi.itemID, mi.name, SUM(oi.quantity) AS order_frequency
                FROM orderitems oi
                INNER JOIN orders o ON oi.OrderID = o.OrderID
                INNER JOIN menu_items mi ON oi.ItemID = mi.itemID
                $userJoinClause
                WHERE $whereClause
                GROUP BY mi.itemID, mi.name
                ORDER BY order_frequency DESC
                LIMIT 1";
        
        $result = $conn->query($sql);
        
        if (!$result) {
            respond([
                'name' => 'No data',
                'frequency' => 0
            ]);
            return;
        }
        
        $row = $result->fetch_assoc();
        
        if ($row && !empty($row['name'])) {
            respond([
                'name' => $row['name'],
                'frequency' => (int)$row['order_frequency']
            ]);
        } else {
            respond([
                'name' => 'No data',
                'frequency' => 0
            ]);
        }
    },
];