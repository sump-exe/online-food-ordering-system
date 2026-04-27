<?php

$adminSalesReportActions = [
    'getAdminSalesReport' => function ($conn, $body) {
        $year = trim((string)($_GET['year'] ?? ''));
        $month = trim((string)($_GET['month'] ?? ''));
        $day = trim((string)($_GET['day'] ?? ''));
        $customerId = (int)($_GET['customerId'] ?? 0);

        if ($year !== '' && !preg_match('/^\d{4}$/', $year)) {
            respondError('Invalid year filter.');
        }
        if ($month !== '' && !preg_match('/^(0?[1-9]|1[0-2])$/', $month)) {
            respondError('Invalid month filter.');
        }
        if ($day !== '' && !preg_match('/^(0?[1-9]|[12][0-9]|3[01])$/', $day)) {
            respondError('Invalid day filter.');
        }

        $buildFilters = function ($alias = 'o', $exclude = []) use ($year, $month, $day, $customerId) {
            $whereClauses = ["{$alias}.Status = 'Complete'"];
            $paramTypes = '';
            $params = [];

            if ($year !== '' && !in_array('year', $exclude, true)) {
                $whereClauses[] = "YEAR({$alias}.order_date) = ?";
                $paramTypes .= 'i';
                $params[] = (int)$year;
            }
            if ($month !== '' && !in_array('month', $exclude, true)) {
                $whereClauses[] = "MONTH({$alias}.order_date) = ?";
                $paramTypes .= 'i';
                $params[] = (int)$month;
            }
            if ($day !== '' && !in_array('day', $exclude, true)) {
                $whereClauses[] = "DAY({$alias}.order_date) = ?";
                $paramTypes .= 'i';
                $params[] = (int)$day;
            }
            if ($customerId > 0 && !in_array('user', $exclude, true)) {
                $whereClauses[] = "{$alias}.customerID = ?";
                $paramTypes .= 'i';
                $params[] = $customerId;
            }

            return [
                'whereSql' => implode(' AND ', $whereClauses),
                'paramTypes' => $paramTypes,
                'params' => $params,
            ];
        };

        $filters = $buildFilters();
        $whereSql = $filters['whereSql'];
        $paramTypes = $filters['paramTypes'];
        $params = $filters['params'];

        $runRowsQuery = function ($sql, $paramTypes, $params, $intFields = []) use ($conn) {
            $stmt = $conn->prepare($sql);
            if ($paramTypes !== '') {
                $stmt->bind_param($paramTypes, ...$params);
            }
            executePrepared($stmt, 'Failed to fetch sales filter options');
            $result = $stmt->get_result();
            $rows = fetchAllRows($result, $intFields);
            $stmt->close();
            return $rows;
        };

        $summarySql = "SELECT COALESCE(SUM(o.TotalPayment), 0) AS totalRevenue,
                              COUNT(*) AS orderCount
                       FROM orders o
                       WHERE $whereSql";
        $summaryStmt = $conn->prepare($summarySql);
        if ($paramTypes !== '') {
            $summaryStmt->bind_param($paramTypes, ...$params);
        }
        executePrepared($summaryStmt, 'Failed to fetch sales summary');
        $summaryResult = $summaryStmt->get_result();
        $summaryRow = $summaryResult->fetch_assoc() ?: ['totalRevenue' => 0, 'orderCount' => 0];
        $summaryStmt->close();

        $bestSellerSql = "SELECT
                            m.name AS item_name,
                            SUM(oi.quantity) AS quantity_sold,
                            SUM(oi.quantity * oi.price) AS revenue
                          FROM orders o
                          JOIN orderitems oi ON oi.OrderID = o.OrderID
                          JOIN menu_items m ON m.itemID = oi.ItemID
                          WHERE $whereSql
                          GROUP BY oi.ItemID, m.name
                          ORDER BY quantity_sold DESC, revenue DESC, m.name ASC
                          LIMIT 1";
        $bestSellerStmt = $conn->prepare($bestSellerSql);
        if ($paramTypes !== '') {
            $bestSellerStmt->bind_param($paramTypes, ...$params);
        }
        executePrepared($bestSellerStmt, 'Failed to fetch best seller');
        $bestSellerResult = $bestSellerStmt->get_result();
        $bestSeller = $bestSellerResult->fetch_assoc();
        $bestSellerStmt->close();

        if ($bestSeller) {
            $bestSeller = castRow($bestSeller, ['quantity_sold', 'revenue']);
        }

        $ordersSql = "SELECT
                        o.OrderID,
                        o.order_date,
                        c.username AS customer_name,
                        p.referenceNumber,
                        o.TotalPayment
                      FROM orders o
                      LEFT JOIN customers c ON c.customerID = o.customerID
                      LEFT JOIN payments p ON p.OrderID = o.OrderID
                      WHERE $whereSql
                      ORDER BY o.order_date DESC, o.OrderID DESC";
        $ordersStmt = $conn->prepare($ordersSql);
        if ($paramTypes !== '') {
            $ordersStmt->bind_param($paramTypes, ...$params);
        }
        executePrepared($ordersStmt, 'Failed to fetch sales orders');
        $ordersResult = $ordersStmt->get_result();
        $orders = fetchAllRows($ordersResult, ['OrderID', 'referenceNumber', 'TotalPayment']);
        $ordersStmt->close();

        $yearFilters = $buildFilters('o', ['year']);
        $monthFilters = $buildFilters('o', ['month']);
        $dayFilters = $buildFilters('o', ['day']);
        $userFilters = $buildFilters('o', ['user']);

        $years = $runRowsQuery(
            "SELECT DISTINCT YEAR(o.order_date) AS value
             FROM orders o
             WHERE {$yearFilters['whereSql']}
             ORDER BY value DESC",
            $yearFilters['paramTypes'],
            $yearFilters['params'],
            ['value']
        );
        $months = $runRowsQuery(
            "SELECT DISTINCT MONTH(o.order_date) AS value
             FROM orders o
             WHERE {$monthFilters['whereSql']}
             ORDER BY value ASC",
            $monthFilters['paramTypes'],
            $monthFilters['params'],
            ['value']
        );
        $days = $runRowsQuery(
            "SELECT DISTINCT DAY(o.order_date) AS value
             FROM orders o
             WHERE {$dayFilters['whereSql']}
             ORDER BY value ASC",
            $dayFilters['paramTypes'],
            $dayFilters['params'],
            ['value']
        );
        $users = $runRowsQuery(
            "SELECT DISTINCT c.customerID AS id, c.username
             FROM orders o
             JOIN customers c ON c.customerID = o.customerID
             WHERE {$userFilters['whereSql']}
             ORDER BY c.username ASC",
            $userFilters['paramTypes'],
            $userFilters['params'],
            ['id']
        );

        respond([
            'totalRevenue' => (int)$summaryRow['totalRevenue'],
            'orderCount' => (int)$summaryRow['orderCount'],
            'bestSeller' => $bestSeller,
            'orders' => $orders,
            'filterOptions' => [
                'years' => $years,
                'months' => $months,
                'days' => $days,
                'users' => $users,
            ],
        ]);
    },
];
