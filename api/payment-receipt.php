<?php

$paymentReceiptActions = [
    'processPayment' => function ($conn, $body) {
        $orderId = (int)($body['orderId'] ?? 0);
        $customerId = (int)($body['customerId'] ?? 0);
        $paymentMethod = $body['paymentMethod'] ?? 'Cash';
        $amountPaid = (float)($body['amountPaid'] ?? 0);
        $totalAmount = (float)($body['totalAmount'] ?? 0);
        
        if ($orderId <= 0 || $customerId <= 0) {
            respondError('Invalid order or customer ID');
        }
        
        $stmt = $conn->prepare("
            SELECT o.OrderID, o.Status, o.TotalPayment, o.order_date,
                   c.customerID, c.username as customer_name
            FROM orders o
            JOIN customers c ON c.customerID = o.customerID
            WHERE o.OrderID = ?
        ");
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        $orderData = $result->fetch_assoc();
        $stmt->close();

        if (!$orderData) {
            respondError('Order not found');
        }

        $subtotal = ((float)$orderData['TotalPayment']) / 100;
        $tax = 0.0;
        $total = $subtotal;
        $finalAmountPaid = $amountPaid > 0 ? $amountPaid : $totalAmount;
        if ($finalAmountPaid <= 0) {
            $finalAmountPaid = $total;
        }
        $changeAmount = max(0, $finalAmountPaid - $total);
        $receiptNumber = generateReceiptNumber();
        $transactionDateTime = date('Y-m-d H:i:s');

        $stmt = $conn->prepare("
            UPDATE payments 
            SET payment_method = ?, 
                amount_paid = ?, 
                change_amount = ?,
                payment_status = 'Success',
                receipt_number = ?,
                transaction_datetime = ?,
                receipt_generated = TRUE
            WHERE OrderID = ?
        ");
        $stmt->bind_param('sddssi', $paymentMethod, $finalAmountPaid, $changeAmount, $receiptNumber, $transactionDateTime, $orderId);
        $stmt->execute();
        $stmt->close();
        
        $stmt = $conn->prepare("
            SELECT oi.ItemID, oi.quantity, oi.price,
                   m.name as item_name, c.name as category_name
            FROM orderitems oi
            JOIN menu_items m ON m.itemID = oi.ItemID
            LEFT JOIN categories c ON c.categoryID = m.categoryID
            WHERE oi.OrderID = ?
        ");
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $unitPrice = ((float)$row['price']) / 100;
            $itemSubtotal = $unitPrice * (int)$row['quantity'];
            $items[] = [
                'item_name' => $row['item_name'],
                'category_name' => $row['category_name'] ?? 'Uncategorized',
                'quantity' => (int)$row['quantity'],
                'unit_price' => $unitPrice,
                'subtotal' => $itemSubtotal
            ];
        }
        $stmt->close();

        $receiptData = json_encode([
            'order_id' => $orderId,
            'customer_name' => $orderData['customer_name'],
            'items' => $items,
            'subtotal' => $subtotal,
            'tax' => $tax,
            'discount' => 0,
            'total' => $total,
            'payment_method' => $paymentMethod,
            'amount_paid' => $finalAmountPaid,
            'change_amount' => $changeAmount
        ]);

        $receiptStmt = $conn->prepare("
            INSERT INTO receipts (receipt_number, order_id, customer_id, customer_name, 
                                  payment_method, subtotal, tax, total_amount, 
                                  amount_paid, change_amount, transaction_datetime, 
                                  receipt_data, generated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $adminName = 'Customer Self-Service';
        $receiptStmt->bind_param('siissdddddsss', 
            $receiptNumber, $orderId, $customerId, $orderData['customer_name'],
            $paymentMethod, $subtotal, $tax, $total,
            $finalAmountPaid, $changeAmount, $transactionDateTime,
            $receiptData, $adminName
        );
        $receiptStmt->execute();
        $receiptId = $receiptStmt->insert_id;
        $receiptStmt->close();
        
        respond([
            'success' => true,
            'payment' => [
                'order_id' => $orderId,
                'receipt_number' => $receiptNumber,
                'transaction_datetime' => $transactionDateTime,
                'customer_name' => $orderData['customer_name'],
                'payment_method' => $paymentMethod,
                'total_amount' => $total,
                'amount_paid' => $finalAmountPaid,
                'change_amount' => $changeAmount,
                'receipt_id' => $receiptId
            ]
        ]);
    },
    
    'getReceipt' => function ($conn, $body) {
        $receiptNumber = $_GET['receipt_number'] ?? '';
        $orderId = (int)($_GET['order_id'] ?? 0);
        
        if (empty($receiptNumber) && $orderId <= 0) {
            respondError('Receipt number or Order ID required');
        }
        
        $query = "
            SELECT r.*, o.Status as order_status
            FROM receipts r
            JOIN orders o ON o.OrderID = r.order_id
        ";
        
        if (!empty($receiptNumber)) {
            $query .= " WHERE r.receipt_number = ?";
            $stmt = $conn->prepare($query);
            $stmt->bind_param('s', $receiptNumber);
        } else {
            $query .= " WHERE r.order_id = ?";
            $stmt = $conn->prepare($query);
            $stmt->bind_param('i', $orderId);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        $receipt = $result->fetch_assoc();
        $stmt->close();
        
        if (!$receipt) {
            respondError('Receipt not found');
        }
        
        // Decode receipt data
        $receiptData = json_decode($receipt['receipt_data'], true);
        
        respond([
            'receipt' => [
                'receipt_id' => $receipt['receipt_id'],
                'receipt_number' => $receipt['receipt_number'],
                'order_id' => $receipt['order_id'],
                'customer_name' => $receipt['customer_name'],
                'payment_method' => $receipt['payment_method'],
                'subtotal' => (float)$receipt['subtotal'],
                'tax' => (float)$receipt['tax'],
                'total_amount' => (float)$receipt['total_amount'],
                'amount_paid' => (float)$receipt['amount_paid'],
                'change_amount' => (float)$receipt['change_amount'],
                'transaction_datetime' => $receipt['transaction_datetime'],
                'order_status' => $receipt['order_status'],
                'items' => $receiptData['items'] ?? [],
                'generated_by' => $receipt['generated_by']
            ]
        ]);
    },
    
    'getReceiptsByCustomer' => function ($conn, $body) {
        $customerId = (int)($_GET['customer_id'] ?? 0);
        
        if ($customerId <= 0) {
            respondError('Customer ID required');
        }
        
        $stmt = $conn->prepare("
            SELECT receipt_number, order_id, total_amount, payment_method, 
                   transaction_datetime, receipt_id
            FROM receipts
            WHERE customer_id = ?
            ORDER BY transaction_datetime DESC
        ");
        $stmt->bind_param('i', $customerId);
        $stmt->execute();
        $result = $stmt->get_result();
        $receipts = [];
        while ($row = $result->fetch_assoc()) {
            $receipts[] = [
                'receipt_number' => $row['receipt_number'],
                'order_id' => $row['order_id'],
                'total_amount' => (float)$row['total_amount'],
                'payment_method' => $row['payment_method'],
                'transaction_datetime' => $row['transaction_datetime']
            ];
        }
        $stmt->close();
        
        respond($receipts);
    }
];

function generateReceiptNumber() {
    $prefix = 'FD';
    $date = date('Ymd');
    $random = strtoupper(substr(uniqid(), -6));
    return $prefix . '-' . $date . '-' . $random;
}
