<?php

$adminMenuInventoryActions = [
    'addMenuItem' => function ($conn, $body) {
        $name       = trim($body['name'] ?? '');
        $price      = (int)($body['price'] ?? 0);
        $stock      = (int)($body['stock'] ?? 0);
        $categoryID = (int)($body['categoryID'] ?? 1);

        if (!$name) {
            respondError('Item name is required.');
        }
        if ($price <= 0) {
            respondError('Price must be positive.');
        }
        if ($stock < 0) {
            respondError('Stock cannot be negative.');
        }

        $stmt = $conn->prepare(
            "INSERT INTO menu_items (name, price, stock, category_id, categoryID, timeToPrepare) VALUES (?, ?, ?, ?, ?, NOW())"
        );
        $stmt->bind_param('siiii', $name, $price, $stock, $categoryID, $categoryID);
        executePrepared($stmt, 'Failed to add item');
        $newId = $stmt->insert_id;
        $stmt->close();

        respond([
            'itemID'      => $newId,
            'name'        => $name,
            'price'       => $price,
            'stock'       => $stock,
            'categoryID'  => $categoryID,
            'available'   => $stock > 0,
        ]);
    },
    'updateStock' => function ($conn, $body) {
        $itemId   = (int)($body['itemId'] ?? 0);
        $newStock = (int)($body['stock'] ?? -1);

        if ($newStock < 0) {
            respondError('Stock cannot be negative.');
        }

        $stmt = $conn->prepare("UPDATE menu_items SET stock = ? WHERE itemID = ?");
        $stmt->bind_param('ii', $newStock, $itemId);
        executePrepared($stmt, 'Failed to update stock');
        $stmt->close();

        respondSuccess();
    },
    'updatePrice' => function ($conn, $body) {
        $itemId   = (int)($body['itemId'] ?? 0);
        $newPrice = (int)($body['price'] ?? 0);

        if ($newPrice <= 0) {
            respondError('Price must be positive.');
        }

        $stmt = $conn->prepare("UPDATE menu_items SET price = ? WHERE itemID = ?");
        $stmt->bind_param('ii', $newPrice, $itemId);
        executePrepared($stmt, 'Failed to update price');
        $stmt->close();

        respondSuccess();
    },
];
