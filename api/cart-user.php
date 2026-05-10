<?php

$userCartActions = [
    'saveCartToDb' => function ($conn, $body) {
        $customerId = (int)($body['customerId'] ?? 0);
        $cartItems = $body['cartItems'] ?? [];

        if (!$customerId) {
            respondError('Customer ID is required.');
        }
        if (empty($cartItems)) {
            respondError('Cart is empty.');
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("SELECT OrderID FROM orders WHERE customerID = ? AND Status = 'In Cart' ORDER BY OrderID DESC LIMIT 1");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $result = $stmt->get_result();
            $cartOrder = $result->fetch_assoc();
            $stmt->close();

            if ($cartOrder) {
                $del = $conn->prepare("DELETE FROM orderitems WHERE OrderID = ?");
                $del->bind_param('i', $cartOrder['OrderID']);
                $del->execute();
                $del->close();
                $orderId = $cartOrder['OrderID'];
            } else {
                $totalPayment = 0;
                $stmt = $conn->prepare(
                    "INSERT INTO orders (Status, TotalPayment, customerID, order_date) VALUES ('In Cart', ?, ?, NOW())"
                );
                $stmt->bind_param('ii', $totalPayment, $customerId);
                $stmt->execute();
                $orderId = $stmt->insert_id;
                $stmt->close();
            }

            $totalPayment = 0;
            foreach ($cartItems as $ci) {
                $itemId = (int)$ci['itemID'];
                $qty = (int)$ci['quantity'];
                $price = (int)$ci['price'];

                if ($qty <= 0 || $price <= 0) {
                    throw new Exception('Invalid cart item data.');
                }

                $totalPayment += $price * $qty;

                $oi = $conn->prepare(
                    "INSERT INTO orderitems (OrderID, ItemID, quantity, price) VALUES (?, ?, ?, ?)"
                );
                $oi->bind_param('iiii', $orderId, $itemId, $qty, $price);
                $oi->execute();
                $oi->close();
            }

            $upd = $conn->prepare("UPDATE orders SET TotalPayment = ? WHERE OrderID = ?");
            $upd->bind_param('ii', $totalPayment, $orderId);
            $upd->execute();
            $upd->close();

            $conn->commit();
            respond([
                'success' => true,
                'orderID' => $orderId,
            ]);
        } catch (Exception $e) {
            $conn->rollback();
            respondError($e->getMessage());
        }
    },
    'loadCartFromDb' => function ($conn, $body) {
        $customerId = (int)($body['customerId'] ?? 0);

        if (!$customerId) {
            respondError('Customer ID is required.');
        }

        $stmt = $conn->prepare("SELECT OrderID FROM orders WHERE customerID = ? AND Status = 'In Cart' ORDER BY OrderID DESC LIMIT 1");
        $stmt->bind_param('i', $customerId);
        $stmt->execute();
        $result = $stmt->get_result();
        $cartOrder = $result->fetch_assoc();
        $stmt->close();

        if (!$cartOrder) {
            respond(['cartItems' => [], 'orderID' => null]);
        }

        $stmt = $conn->prepare(
            "SELECT oi.ItemID, oi.quantity, oi.price,
                    COALESCE(mi.name, 'Item has been deleted') AS name,
                    COALESCE(mi.stock, 0) AS stock
             FROM orderitems oi
             LEFT JOIN menu_items mi ON mi.itemID = oi.ItemID
             WHERE oi.OrderID = ?"
        );
        $stmt->bind_param('i', $cartOrder['OrderID']);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = fetchAllRows($result, ['ItemID', 'quantity', 'price', 'stock']);
        $stmt->close();

        $cartItems = array_map(function ($item) {
            return [
                'itemID' => $item['ItemID'],
                'name' => $item['name'],
                'price' => $item['price'],
                'quantity' => $item['quantity'],
                'maxStock' => $item['stock'],
            ];
        }, $items);

        respond([
            'cartItems' => $cartItems,
            'orderID' => $cartOrder['OrderID'],
        ]);
    },
    'createOrder' => function ($conn, $body) {
        $customerId = (int)($body['customerId'] ?? 0);
        $totalPayment = (int)($body['totalPayment'] ?? 0);
        $cartItems = $body['cartItems'] ?? [];

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
            $stmt = $conn->prepare("SELECT OrderID FROM orders WHERE customerID = ? AND Status = 'In Cart' ORDER BY OrderID DESC LIMIT 1");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $result = $stmt->get_result();
            $cartOrder = $result->fetch_assoc();
            $stmt->close();

            if ($cartOrder) {
                $orderId = $cartOrder['OrderID'];

                $del = $conn->prepare("DELETE FROM orderitems WHERE OrderID = ?");
                $del->bind_param('i', $orderId);
                $del->execute();
                $del->close();
            } else {
                $stmt = $conn->prepare(
                    "INSERT INTO orders (Status, TotalPayment, customerID, order_date) VALUES ('Preparing', ?, ?, NOW())"
                );
                $stmt->bind_param('ii', $totalPayment, $customerId);
                $stmt->execute();
                $orderId = $stmt->insert_id;
                $stmt->close();
            }

            foreach ($cartItems as $ci) {
                $itemId = (int)$ci['itemID'];
                $qty = (int)$ci['quantity'];
                $price = (int)$ci['price'];

                if ($qty <= 0 || $price <= 0) {
                    throw new Exception('Invalid cart item data.');
                }

                $chk = $conn->prepare("SELECT stock FROM menu_items WHERE itemID = ? FOR UPDATE");
                $chk->bind_param('i', $itemId);
                $chk->execute();
                $result = $chk->get_result();
                $row = $result->fetch_assoc();
                $chk->close();

                if (!$row) {
                    throw new Exception('One or more items in your cart have been deleted.');
                }

                $currentStock = (int)$row['stock'];

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

            $upd = $conn->prepare("UPDATE orders SET Status = 'Preparing', TotalPayment = ? WHERE OrderID = ?");
            $upd->bind_param('ii', $totalPayment, $orderId);
            $upd->execute();
            $upd->close();

            $refNum = rand(100000000, 999999999);
            $pay = $conn->prepare(
                "INSERT INTO payments (referenceNumber, OrderID, customerID) VALUES (?, ?, ?)"
            );
            $pay->bind_param('iii', $refNum, $orderId, $customerId);
            $pay->execute();
            $pay->close();

            $conn->commit();
            respond([
                'OrderID' => $orderId,
                'referenceNumber' => $refNum,
                'Status' => 'Preparing',
                'TotalPayment' => $totalPayment,
            ]);
        } catch (Exception $e) {
            $conn->rollback();
            respondError($e->getMessage());
        }
    },
];
