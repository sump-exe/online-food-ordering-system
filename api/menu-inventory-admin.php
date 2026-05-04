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
            "INSERT INTO menu_items (name, price, stock, categoryID, timeToPrepare) VALUES (?, ?, ?, ?, NOW())"
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
    
    'getMenuItem' => function ($conn, $body) {
        $itemId = (int)($_GET['itemId'] ?? 0);
        
        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }
        
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
    
    'deleteMenuItem' => function ($conn, $body) {
        $itemId = (int)($body['itemId'] ?? 0);
        
        if ($itemId <= 0) {
            respondError('Invalid item ID.');
        }
        
        // Check if item exists in any orders
        $check = $conn->prepare("SELECT COUNT(*) as count FROM orderitems WHERE ItemID = ?");
        $check->bind_param('i', $itemId);
        $check->execute();
        $result = $check->get_result();
        $row = $result->fetch_assoc();
        $check->close();
        
        if ($row['count'] > 0) {
            respondError('Cannot delete item that has been ordered. You can only update stock to 0.');
        }
        
        // Delete image file if exists
        $stmt = $conn->prepare("SELECT image FROM menu_items WHERE itemID = ?");
        $stmt->bind_param('i', $itemId);
        $stmt->execute();
        $result = $stmt->get_result();
        $item = $result->fetch_assoc();
        $stmt->close();
        
        if ($item && $item['image'] && file_exists('../' . $item['image'])) {
            unlink('../' . $item['image']);
        }
        
        $stmt = $conn->prepare("DELETE FROM menu_items WHERE itemID = ?");
        $stmt->bind_param('i', $itemId);
        executePrepared($stmt, 'Failed to delete item');
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => 'Item deleted successfully'
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