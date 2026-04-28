<?php

function getMenuItemPayload($body) {
    return !empty($_POST) ? $_POST : $body;
}

function removeExistingMenuItemImages($itemId) {
    $matches = glob(getMenuItemImageDirectory() . DIRECTORY_SEPARATOR . 'menu-item-' . (int)$itemId . '.*');
    if (!$matches) {
        return;
    }

    foreach ($matches as $match) {
        if (is_file($match)) {
            @unlink($match);
        }
    }
}

function storeMenuItemImage($conn, $itemId, $fileField = 'image') {
    if (!isset($_FILES[$fileField]) || !is_array($_FILES[$fileField])) {
        return getMenuItemImageUrl($itemId);
    }

    $file = $_FILES[$fileField];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return getMenuItemImageUrl($itemId);
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        respondError('Failed to upload image.');
    }
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        respondError('Image must be 5MB or smaller.');
    }

    $imageInfo = @getimagesize($file['tmp_name']);
    if (!$imageInfo || empty($imageInfo['mime'])) {
        respondError('Uploaded file must be a valid image.');
    }

    $extensionByMime = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
    ];
    $mimeType = strtolower($imageInfo['mime']);
    $extension = $extensionByMime[$mimeType] ?? null;
    if (!$extension) {
        respondError('Only JPG, PNG, GIF, and WEBP images are allowed.');
    }

    $directory = ensureMenuItemImageDirectory();
    removeExistingMenuItemImages($itemId);

    $targetPath = $directory . DIRECTORY_SEPARATOR . 'menu-item-' . (int)$itemId . '.' . $extension;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        respondError('Failed to save uploaded image.', 500);
    }

    $imageData = file_get_contents($targetPath);
    if ($imageData === false) {
        respondError('Failed to read saved image.', 500);
    }

    $stmt = $conn->prepare("UPDATE menu_items SET image = ? WHERE itemID = ?");
    $blob = null;
    $stmt->bind_param('bi', $blob, $itemId);
    $stmt->send_long_data(0, $imageData);
    executePrepared($stmt, 'Failed to store item image');
    $stmt->close();

    return getMenuItemImageUrl($itemId);
}

$adminMenuInventoryActions = [
    'addMenuItem' => function ($conn, $body) {
        $payload    = getMenuItemPayload($body);
        $name       = trim($payload['name'] ?? '');
        $price      = (int)($payload['price'] ?? 0);
        $stock      = (int)($payload['stock'] ?? 0);
        $categoryID = (int)($payload['categoryID'] ?? 1);

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
            "INSERT INTO menu_items (name, price, stock, categoryID, timeToPrepare) VALUES (?, ?, ?, ?, NOW())"
        );
        $stmt->bind_param('siii', $name, $price, $stock, $categoryID);
        executePrepared($stmt, 'Failed to add item');
        $newId = $stmt->insert_id;
        $stmt->close();

        $imageUrl = storeMenuItemImage($conn, $newId);

        respond([
            'itemID'      => $newId,
            'name'        => $name,
            'price'       => $price,
            'stock'       => $stock,
            'categoryID'  => $categoryID,
            'available'   => $stock > 0,
            'image_url'   => $imageUrl,
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
    'updateMenuItemImage' => function ($conn, $body) {
        $payload = getMenuItemPayload($body);
        $itemId = (int)($payload['itemId'] ?? 0);

        if ($itemId <= 0) {
            respondError('A valid item ID is required.');
        }

        $imageUrl = storeMenuItemImage($conn, $itemId);
        if (!$imageUrl) {
            respondError('Please choose an image to upload.');
        }

        respond([
            'success' => true,
            'itemId' => $itemId,
            'image_url' => $imageUrl,
        ]);
    },
];
