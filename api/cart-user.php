<?php

$userCartActions = [
    'createOrder' => function ($conn, $body) {
        $customerId   = (int)($body['customerId'] ?? 0);
        $totalPayment = (int)($body['totalPayment'] ?? 0);
        $cartItems    = $body['cartItems'] ?? [];

        if (!$customerId) {
            respondError('Customer ID is required.');
        }
        if ($totalPayment <= 0) {
            respondError('Total payment must be positive.');
        }
        if (empty($cartItems)) {
            respondError('Cart is empty.');
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare(
                "INSERT INTO orders (Status, TotalPayment, customerID, order_date) VALUES ('Preparing', ?, ?, NOW())"
            );
            $stmt->bind_param('ii', $totalPayment, $customerId);
            $stmt->execute();
            $orderId = $stmt->insert_id;
            $stmt->close();

            foreach ($cartItems as $ci) {
                $itemId = (int)$ci['itemID'];
                $qty    = (int)$ci['quantity'];
                $price  = (int)$ci['price'];

                if ($qty <= 0 || $price <= 0) {
                    throw new Exception('Invalid cart item data.');
                }

                $chk = $conn->prepare("SELECT stock FROM menu_items WHERE itemID = ? FOR UPDATE");
                $chk->bind_param('i', $itemId);
                $chk->execute();
                $chk->bind_result($currentStock);
                $chk->fetch();
                $chk->close();

                if ($currentStock < $qty) {
                    throw new Exception("Not enough stock for item #$itemId.");
                }

                $oi = $conn->prepare(
                    "INSERT INTO orderitems (OrderID, ItemID, quantity, price) VALUES (?, ?, ?, ?)"
                );
                $oi->bind_param('iiii', $orderId, $itemId, $qty, $price);
                $oi->execute();
                $oi->close();

                $upd = $conn->prepare("UPDATE menu_items SET stock = stock - ? WHERE itemID = ?");
                $upd->bind_param('ii', $qty, $itemId);
                $upd->execute();
                $upd->close();
            }

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
    },
];

