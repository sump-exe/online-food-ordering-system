<?php

$adminMenuInventoryActions = [
    'addMenuItem' => function ($conn, $body) {
        $name       = trim($body['name'] ?? '');
        $price      = (int)($body['price'] ?? 0);
        $stock      = (int)($body['stock'] ?? 0);
        $rawCategoryID = $body['categoryID'] ?? null;
        $categoryID = is_numeric($rawCategoryID) && (int)$rawCategoryID > 0
            ? (int)$rawCategoryID
            : null;
        $tags       = $body['tags'] ?? [];

        if (!$name) { respondError('Item name is required.'); }
        if ($price <= 0) { respondError('Price must be positive.'); }
        if ($stock < 0) { respondError('Stock cannot be negative.'); }

        if ($categoryID !== null) {
            $stmt = $conn->prepare(
                "INSERT INTO menu_items (name, price, stock, categoryID) VALUES (?, ?, ?, ?)"
            );
            $stmt->bind_param('siii', $name, $price, $stock, $categoryID);
        } else {
            $stmt = $conn->prepare(
                "INSERT INTO menu_items (name, price, stock, categoryID) VALUES (?, ?, ?, NULL)"
            );
            $stmt->bind_param('sii', $name, $price, $stock);
        }

        executePrepared($stmt, 'Failed to add item');
        $newId = $stmt->insert_id;
        $stmt->close();

        // Assign tags
        if (!empty($tags) && is_array($tags)) {
            $insTag = $conn->prepare("INSERT INTO tag_assignments (itemID, tagID) VALUES (?, ?)");
            foreach ($tags as $tagId) {
                $tid = (int)$tagId;
                $insTag->bind_param('ii', $newId, $tid);
                $insTag->execute();
            }
            $insTag->close();
        }

        respond([
            'itemID'      => $newId,
            'name'        => $name,
            'price'       => $price,
            'stock'       => $stock,
            'categoryID'  => $categoryID,
            'available'   => $stock > 0,
        ]);
    },
    
    'getMenuItem' => function ($conn, $body) {
        $itemId = (int)($_GET['itemId'] ?? 0);
        
        if ($itemId <= 0) { respondError('Invalid item ID.'); }
        
        $stmt = $conn->prepare("
            SELECT m.itemID, m.name, m.price, m.stock, m.categoryID, m.image,
                   c.name as category_name
            FROM menu_items m
            LEFT JOIN categories c ON c.categoryID = m.categoryID
            WHERE m.itemID = ?
        ");
        $stmt->bind_param('i', $itemId);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();
        $stmt->close();
        
        if (!$item) { respondError('Item not found.'); }

        // Fetch tags for this item
        $tagStmt = $conn->prepare("
            SELECT t.tagID, t.tag_name
            FROM tag_assignments ta
            JOIN tags t ON t.tagID = ta.tagID
            WHERE ta.itemID = ?
        ");
        $tagStmt->bind_param('i', $itemId);
        $tagStmt->execute();
        $tagRes = $tagStmt->get_result();
        $tags = [];
        while ($t = $tagRes->fetch_assoc()) {
            $tags[] = ['tagID' => (int)$t['tagID'], 'tag_name' => $t['tag_name']];
        }
        $tagStmt->close();
        
        respond([
            'itemID' => (int)$item['itemID'],
            'name' => $item['name'],
            'price' => (int)$item['price'],
            'stock' => (int)$item['stock'],
            'categoryID' => (int)($item['categoryID'] ?? 0),
            'category_name' => $item['category_name'] ?? 'Uncategorized',
            'image' => $item['image'],
            'tags' => $tags
        ]);
    },
    
    'updateMenuItem' => function ($conn, $body) {
        $itemId = (int)($_POST['itemId'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $price = (int)($_POST['price'] ?? 0);
        $stock = (int)($_POST['stock'] ?? 0);
        $categoryID = (int)($_POST['categoryID'] ?? 0);
        $tags = isset($_POST['tags']) ? json_decode($_POST['tags'], true) : [];
        
        if ($itemId <= 0) { respondError('Invalid item ID.'); }
        if (!$name) { respondError('Item name is required.'); }
        if ($price <= 0) { respondError('Price must be positive.'); }
        if ($stock < 0) { respondError('Stock cannot be negative.'); }
        
        // Handle image upload
        $imagePath = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = '../uploads/menu/';
            if (!file_exists($uploadDir)) { mkdir($uploadDir, 0777, true); }
            $fileExtension = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            if (!in_array($fileExtension, $allowedExtensions)) {
                respondError('Invalid file type. Allowed: JPG, JPEG, PNG, GIF, WEBP');
            }
            $newFilename = 'item_' . $itemId . '_' . time() . '.' . $fileExtension;
            $uploadPath = $uploadDir . $newFilename;
            $dbPath = 'uploads/menu/' . $newFilename;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                $stmt = $conn->prepare("SELECT image FROM menu_items WHERE itemID = ?");
                $stmt->bind_param('i', $itemId);
                $stmt->execute();
                $result = $stmt->get_result();
                $oldItem = $result->fetch_assoc();
                $stmt->close();
                if ($oldItem && $oldItem['image'] && file_exists('../' . $oldItem['image'])) {
                    unlink('../' . $oldItem['image']);
                }
                $imagePath = $dbPath;
            }
        }
        
        // Build update query
        if ($imagePath) {
            $stmt = $conn->prepare("
                UPDATE menu_items 
                SET name = ?, price = ?, stock = ?, categoryID = ?, image = ? 
                WHERE itemID = ?
            ");
            $stmt->bind_param('siiisi', $name, $price, $stock, $categoryID, $imagePath, $itemId);
        } else {
            $stmt = $conn->prepare("
                UPDATE menu_items 
                SET name = ?, price = ?, stock = ?, categoryID = ? 
                WHERE itemID = ?
            ");
            $stmt->bind_param('siiii', $name, $price, $stock, $categoryID, $itemId);
        }
        executePrepared($stmt, 'Failed to update item');
        $stmt->close();
        
        // Update tags: delete existing, insert new
        $conn->query("DELETE FROM tag_assignments WHERE itemID = $itemId");
        if (!empty($tags) && is_array($tags)) {
            $insTag = $conn->prepare("INSERT INTO tag_assignments (itemID, tagID) VALUES (?, ?)");
            foreach ($tags as $tagId) {
                $tid = (int)$tagId;
                $insTag->bind_param('ii', $itemId, $tid);
                $insTag->execute();
            }
            $insTag->close();
        }
        
        respond([
            'success' => true,
            'message' => 'Item updated successfully'
        ]);
    },
    
    // Soft delete (move to trash)
    'deleteMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);
        if ($itemId <= 0) respondError('Invalid item ID.');
        $stmt = $conn->prepare("SELECT itemID FROM menu_items WHERE itemID = ? AND COALESCE(is_deleted, 0) = 0");
        $stmt->bind_param('i', $itemId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) { $stmt->close(); respondError('Item not found or already deleted.'); }
        $stmt->close();
        $stmt = $conn->prepare("UPDATE menu_items SET is_deleted = 1, deleted_at = NOW() WHERE itemID = ?");
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to move item to trash');
        $stmt->close();
        respond(['success' => true, 'message' => 'Item moved to trash.']);
    },
    
    // Restore item from trash
    'restoreMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);
        if ($itemId <= 0) respondError('Invalid item ID.');
        $stmt = $conn->prepare("UPDATE menu_items SET is_deleted = 0, deleted_at = NULL WHERE itemID = ? AND COALESCE(is_deleted, 0) = 1");
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to restore item');
        $restored = $stmt->affected_rows;
        $stmt->close();
        if ($restored === 0) respondError('Item not found in trash.');
        respond(['success' => true, 'message' => 'Item restored successfully.']);
    },
    
    // Permanently delete item (only if in trash)
    'permanentlyDeleteMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);
        if ($itemId <= 0) respondError('Invalid item ID.');
        $stmt = $conn->prepare("SELECT itemID FROM menu_items WHERE itemID = ? AND COALESCE(is_deleted, 0) = 1");
        $stmt->bind_param('i', $itemId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) { $stmt->close(); respondError('Item not found in trash.'); }
        $stmt->close();
        $stmt = $conn->prepare("DELETE FROM tag_assignments WHERE itemID = ?");
        $stmt->bind_param('i', $itemId);
        $stmt->execute();
        $stmt->close();
        $stmt = $conn->prepare("DELETE FROM menu_items WHERE itemID = ? AND COALESCE(is_deleted, 0) = 1");
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to permanently delete item');
        $stmt->close();
        respond(['success' => true, 'message' => 'Item permanently deleted.']);
    },
    
    'getDeletedMenuItems' => function ($conn, $body) {
        $result = $conn->query("
            SELECT m.itemID, m.name, m.price, m.stock, m.categoryID, m.deleted_at,
                   c.name as category_name
            FROM menu_items m
            LEFT JOIN categories c ON c.categoryID = m.categoryID
            WHERE COALESCE(m.is_deleted, 0) = 1
            ORDER BY m.deleted_at DESC
        ");
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = [
                'itemID' => (int)$row['itemID'],
                'name' => $row['name'],
                'price' => (int)$row['price'],
                'stock' => (int)$row['stock'],
                'categoryID' => (int)($row['categoryID'] ?? 0),
                'category_name' => $row['category_name'] ?? 'Uncategorized',
                'deleted_at' => $row['deleted_at']
            ];
        }
        respond($items);
    },
    
    'updateStock' => function ($conn, $body) {
        $itemId   = (int)($body['itemId'] ?? 0);
        $newStock = (int)($body['stock'] ?? -1);
        if ($newStock < 0) respondError('Stock cannot be negative.');
        $stmt = $conn->prepare("UPDATE menu_items SET stock = ? WHERE itemID = ?");
        $stmt->bind_param('ii', $newStock, $itemId);
        executePrepared($stmt, 'Failed to update stock');
        $stmt->close();
        respondSuccess();
    },
    
    'updatePrice' => function ($conn, $body) {
        $itemId   = (int)($body['itemId'] ?? 0);
        $newPrice = (int)($body['price'] ?? 0);
        if ($newPrice <= 0) respondError('Price must be positive.');
        $stmt = $conn->prepare("UPDATE menu_items SET price = ? WHERE itemID = ?");
        $stmt->bind_param('ii', $newPrice, $itemId);
        executePrepared($stmt, 'Failed to update price');
        $stmt->close();
        respondSuccess();
    },
];
