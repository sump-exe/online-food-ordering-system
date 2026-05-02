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
            "INSERT INTO menu_items (name, price, stock, categoryID) VALUES (?, ?, ?, ?)"
        );
        $stmt->bind_param('siii', $name, $price, $stock, $categoryID);
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
    'getDeletedMenuItems' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT m.itemID,
                    COALESCE(m.name, CONCAT('Item #', m.itemID)) AS name,
                    m.price,
                    m.stock,
                    m.categoryID AS categoryID,
                    c.name AS category_name,
                    m.deleted_at
             FROM menu_items m
             LEFT JOIN categories c
                    ON c.categoryID = m.categoryID
                   AND COALESCE(c.is_deleted, 0) = 0
             WHERE COALESCE(m.is_deleted, 0) = 1
             ORDER BY m.deleted_at DESC, m.itemID DESC"
        );

        respond(fetchAllRows($result, ['itemID', 'price', 'stock', 'categoryID']));
    },
    'deleteMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);

        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }

        $stmt = $conn->prepare(
            "UPDATE menu_items
             SET is_deleted = 1, deleted_at = NOW()
             WHERE itemID = ? AND COALESCE(is_deleted, 0) = 0"
        );
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to move item to trash');
        $affectedRows = $stmt->affected_rows;
        $stmt->close();

        if ($affectedRows === 0) {
            respondError('Item not found or already deleted.', 404);
        }

        respondSuccess();
    },
    'restoreMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);

        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }

        $stmt = $conn->prepare(
            "UPDATE menu_items
             SET is_deleted = 0, deleted_at = NULL
             WHERE itemID = ? AND COALESCE(is_deleted, 0) = 1"
        );
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to restore item');
        $affectedRows = $stmt->affected_rows;
        $stmt->close();

        if ($affectedRows === 0) {
            respondError('Item not found in trash.', 404);
        }

        respondSuccess();
    },
    'permanentlyDeleteMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);

        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }

        $checkStmt = $conn->prepare(
            "SELECT COUNT(*) AS reference_count
             FROM orderitems
             WHERE ItemID = ?"
        );
        $checkStmt->bind_param('i', $itemId);
        executePrepared($checkStmt, 'Failed to check item references');
        $referenceCount = (int)($checkStmt->get_result()->fetch_assoc()['reference_count'] ?? 0);
        $checkStmt->close();

        if ($referenceCount > 0) {
            respondError('This item cannot be permanently deleted because it is referenced by existing orders.', 409);
        }

        $stmt = $conn->prepare(
            "DELETE FROM menu_items
             WHERE itemID = ? AND COALESCE(is_deleted, 0) = 1"
        );
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to permanently delete item');
        $affectedRows = $stmt->affected_rows;
        $stmt->close();

        if ($affectedRows === 0) {
            respondError('Item not found in trash.', 404);
        }

        respondSuccess();
    },
    
    // Get single item for editing
    'getMenuItem' => function ($conn, $body) {
        $itemId = (int)($_GET['itemId'] ?? 0);
        
        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }
        
        $stmt = $conn->prepare("
            SELECT m.itemID, m.name, m.price, m.stock, m.categoryID, m.image,
                   c.name as category_name
            FROM menu_items m
            LEFT JOIN categories c
                   ON c.categoryID = m.categoryID
                  AND COALESCE(c.is_deleted, 0) = 0
            WHERE m.itemID = ?
        ");
        $stmt->bind_param('i', $itemId);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();
        $stmt->close();
        
        if (!$item) {
            respondError('Item not found.');
        }
        
        respond([
            'itemID' => (int)$item['itemID'],
            'name' => $item['name'],
            'price' => (int)$item['price'],
            'stock' => (int)$item['stock'],
            'categoryID' => (int)($item['categoryID'] ?? 0),
            'category_name' => $item['category_name'] ?? 'Uncategorized',
            'image' => $item['image']
        ]);
    },
    
    // Update item with image upload
    'updateMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);
        $name = trim($body['name'] ?? '');
        $price = (int)($body['price'] ?? 0);
        $stock = (int)($body['stock'] ?? 0);
        $categoryID = (int)($body['categoryID'] ?? 0);
        
        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }
        if (!$name) {
            respondError('Item name is required.');
        }
        if ($price <= 0) {
            respondError('Price must be positive.');
        }
        if ($stock < 0) {
            respondError('Stock cannot be negative.');
        }
        
        // Handle image upload
        $imagePath = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = '../uploads/menu/';
            
            // Create directory if not exists
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            
            $fileExtension = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            
            if (!in_array($fileExtension, $allowedExtensions)) {
                respondError('Invalid file type. Allowed: JPG, JPEG, PNG, GIF, WEBP');
            }
            
            // Generate unique filename
            $newFilename = 'item_' . $itemId . '_' . time() . '.' . $fileExtension;
            $uploadPath = $uploadDir . $newFilename;
            $dbPath = 'uploads/menu/' . $newFilename;
            
            if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                // Delete old image if exists
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
        
        respond([
            'success' => true,
            'message' => 'Item updated successfully'
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
