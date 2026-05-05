<?php

$adminCategoryActions = [
    // Get active categories
    'getCategories' => function ($conn, $body) {
        $sql = "SELECT 
                    c.categoryID, 
                    c.name, 
                    c.description, 
                    c.category_type, 
                    c.date_created,
                    COUNT(m.itemID) as item_count
                FROM categories c
                LEFT JOIN menu_items m ON m.categoryID = c.categoryID
                    AND COALESCE(m.is_deleted, 0) = 0
                WHERE COALESCE(c.is_deleted, 0) = 0
                GROUP BY c.categoryID
                ORDER BY FIELD(c.category_type, 'food', 'drinks', 'desserts', 'addons'), c.name";
        
        $result = $conn->query($sql);
        $categories = [];
        while ($row = $result->fetch_assoc()) {
            $categories[] = [
                'categoryID' => (int)$row['categoryID'],
                'name' => $row['name'],
                'description' => $row['description'] ?? '',
                'category_type' => $row['category_type'],
                'date_created' => $row['date_created'],
                'item_count' => (int)($row['item_count'] ?? 0)
            ];
        }
        respond($categories);
    },
    'getDeletedCategories' => function ($conn, $body) {
        $sql = "SELECT
                    c.categoryID,
                    c.name,
                    c.description,
                    c.category_type,
                    c.date_created,
                    c.deleted_at,
                    COUNT(m.itemID) as item_count
                FROM categories c
                LEFT JOIN menu_items m ON m.categoryID = c.categoryID
                    AND COALESCE(m.is_deleted, 0) = 0
                WHERE COALESCE(c.is_deleted, 0) = 1
                GROUP BY c.categoryID
                ORDER BY c.deleted_at DESC, c.name";

        $result = $conn->query($sql);
        $categories = [];
        while ($row = $result->fetch_assoc()) {
            $categories[] = [
                'categoryID' => (int)$row['categoryID'],
                'name' => $row['name'],
                'description' => $row['description'] ?? '',
                'category_type' => $row['category_type'],
                'date_created' => $row['date_created'],
                'deleted_at' => $row['deleted_at'],
                'item_count' => (int)($row['item_count'] ?? 0)
            ];
        }
        respond($categories);
    },
    
    // Get menu items by category
    'getMenuItemsByCategory' => function ($conn, $body) {
        $categoryId = (int)($_GET['categoryId'] ?? 0);
        
        if ($categoryId <= 0) {
            respondError('Invalid category ID');
        }
        
        $stmt = $conn->prepare("
            SELECT itemID, name, price, stock, categoryID
            FROM menu_items 
            WHERE categoryID = ?
              AND COALESCE(is_deleted, 0) = 0
            ORDER BY name
        ");
        $stmt->bind_param('i', $categoryId);
        $stmt->execute();
        $result = $stmt->get_result();
        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = [
                'itemID' => (int)$row['itemID'],
                'name' => $row['name'],
                'price' => (int)$row['price'],
                'stock' => (int)$row['stock']
            ];
        }
        $stmt->close();
        respond($items);
    },
    
    // ADD CATEGORY - NO unnecessary duplicate restrictions
    // Only prevents exact same name AND same type combination
    'addCategory' => function ($conn, $body) {
        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        $categoryType = trim($body['category_type'] ?? 'food');
        
        // Basic validation
        if (empty($name)) {
            respondError('Category name is required.');
        }
        
        $validTypes = ['food', 'drinks', 'desserts', 'addons'];
        if (!in_array($categoryType, $validTypes)) {
            respondError('Invalid category type.');
        }
        
        // ONLY check for exact same name AND same type
        // This allows "Pizza" in food AND "Pizza" in drinks
        // This prevents duplicate "Pizza" in food only
        $check = $conn->prepare(
            "SELECT categoryID
             FROM categories
             WHERE name = ?
               AND category_type = ?
               AND COALESCE(is_deleted, 0) = 0"
        );
        $check->bind_param('ss', $name, $categoryType);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('A category with this name already exists in ' . $categoryType . '. Please use a different name or type.');
        }
        $check->close();
        
        // Insert new category
        $stmt = $conn->prepare("INSERT INTO categories (name, description, category_type) VALUES (?, ?, ?)");
        $stmt->bind_param('sss', $name, $description, $categoryType);
        
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to add category: ' . $conn->error);
        }
        
        $newId = $stmt->insert_id;
        $stmt->close();
        
        respond([
            'success' => true,
            'categoryID' => $newId,
            'message' => "Category '$name' added successfully to " . ucfirst($categoryType)
        ]);
    },
    
    // UPDATE CATEGORY
    'updateCategory' => function ($conn, $body) {
        $categoryId = (int)($body['categoryID'] ?? 0);
        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        $categoryType = trim($body['category_type'] ?? 'food');
        
        if ($categoryId <= 0) {
            respondError('Invalid category ID.');
        }
        
        if (empty($name)) {
            respondError('Category name is required.');
        }
        
        $validTypes = ['food', 'drinks', 'desserts', 'addons'];
        if (!in_array($categoryType, $validTypes)) {
            respondError('Invalid category type.');
        }
        
        // Check for duplicate excluding current category
        $check = $conn->prepare(
            "SELECT categoryID
             FROM categories
             WHERE name = ?
               AND category_type = ?
               AND categoryID != ?
               AND COALESCE(is_deleted, 0) = 0"
        );
        $check->bind_param('ssi', $name, $categoryType, $categoryId);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Another category with this name already exists in ' . $categoryType);
        }
        $check->close();
        
        $stmt = $conn->prepare("UPDATE categories SET name = ?, description = ?, category_type = ? WHERE categoryID = ?");
        $stmt->bind_param('sssi', $name, $description, $categoryType, $categoryId);
        
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to update category: ' . $conn->error);
        }
        
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => "Category updated successfully"
        ]);
    },
    
    // SOFT DELETE – with item check
    'deleteCategory' => function ($conn, $body) {
        $categoryId = (int)($body['categoryID'] ?? 0);
        
        if ($categoryId <= 0) {
            respondError('Invalid category ID.');
        }
        
        // First, get category info for response message and item count
        $stmt = $conn->prepare(
            "SELECT name, category_type
             FROM categories
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 0"
        );
        $stmt->bind_param('i', $categoryId);
        $stmt->execute();
        $result = $stmt->get_result();
        $category = $result->fetch_assoc();
        $stmt->close();
        
        if (!$category) {
            respondError('Category not found.');
        }
        
        // Check for active menu items using this category
        $checkItems = $conn->prepare(
            "SELECT COUNT(*) AS cnt
             FROM menu_items
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 0"
        );
        $checkItems->bind_param('i', $categoryId);
        $checkItems->execute();
        $res = $checkItems->get_result();
        $itemCount = (int)($res->fetch_assoc()['cnt'] ?? 0);
        $checkItems->close();
        
        if ($itemCount > 0) {
            respondError(
                "Cannot delete category '{$category['name']}' because it has {$itemCount} active menu item(s) assigned. " .
                "Please reassign or delete those items first, then try again."
            );
        }
        
        // Proceed with soft delete
        $stmt = $conn->prepare(
            "UPDATE categories
             SET is_deleted = 1, deleted_at = NOW()
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 0"
        );
        $stmt->bind_param('i', $categoryId);
        executePrepared($stmt, 'Failed to move category to trash');
        $deleted = $stmt->affected_rows;
        $stmt->close();

        if ($deleted > 0) {
            respond([
                'success' => true,
                'message' => "Category '{$category['name']}' moved to trash."
            ]);
        } else {
            respondError('Category not found or already deleted.');
        }
    },
    
    // Restore
    'restoreCategory' => function ($conn, $body) {
        $categoryId = (int)($body['categoryID'] ?? 0);

        if ($categoryId <= 0) {
            respondError('Invalid category ID.');
        }

        $stmt = $conn->prepare(
            "UPDATE categories
             SET is_deleted = 0, deleted_at = NULL
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 1"
        );
        $stmt->bind_param('i', $categoryId);
        executePrepared($stmt, 'Failed to restore category');
        $restored = $stmt->affected_rows;
        $stmt->close();

        if ($restored === 0) {
            respondError('Category not found in trash.');
        }

        respond([
            'success' => true,
            'message' => 'Category restored successfully.'
        ]);
    },
    
    // Permanent delete (already has item check)
    'permanentlyDeleteCategory' => function ($conn, $body) {
        $categoryId = (int)($body['categoryID'] ?? 0);

        if ($categoryId <= 0) {
            respondError('Invalid category ID.');
        }

        $stmt = $conn->prepare(
            "SELECT name
             FROM categories
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 1"
        );
        $stmt->bind_param('i', $categoryId);
        $stmt->execute();
        $result = $stmt->get_result();
        $category = $result->fetch_assoc();
        $stmt->close();

        if (!$category) {
            respondError('Category not found in trash.');
        }

        $stmt = $conn->prepare(
            "SELECT COUNT(*) AS count
             FROM menu_items
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 0"
        );
        $stmt->bind_param('i', $categoryId);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $affectedItems = (int)($row['count'] ?? 0);
        $stmt->close();

        $stmt = $conn->prepare(
            "DELETE FROM categories
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 1"
        );
        $stmt->bind_param('i', $categoryId);
        executePrepared($stmt, 'Failed to permanently delete category');
        $deleted = $stmt->affected_rows;
        $stmt->close();

        if ($deleted === 0) {
            respondError('Category not found in trash.');
        }

        $message = "Category '{$category['name']}' permanently deleted.";
        if ($affectedItems > 0) {
            $message .= " $affectedItems menu item(s) became uncategorized.";
        }

        respond([
            'success' => true,
            'message' => $message,
            'affected_items' => $affectedItems
        ]);
    },
    
    // REASSIGN CATEGORY for menu items
    'reassignMenuItems' => function ($conn, $body) {
        $oldCategoryId = (int)($body['oldCategoryId'] ?? 0);
        $newCategoryId = (int)($body['newCategoryId'] ?? 0);
        
        if ($oldCategoryId <= 0 || $newCategoryId <= 0) {
            respondError('Invalid category IDs.');
        }
        
        // Check if new category exists
        $stmt = $conn->prepare(
            "SELECT categoryID
             FROM categories
             WHERE categoryID = ? AND COALESCE(is_deleted, 0) = 0"
        );
        $stmt->bind_param('i', $newCategoryId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            $stmt->close();
            respondError('New category not found.');
        }
        $stmt->close();
        
        // Reassign menu items
        $stmt = $conn->prepare("UPDATE menu_items SET categoryID = ? WHERE categoryID = ?");
        $stmt->bind_param('ii', $newCategoryId, $oldCategoryId);
        
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to reassign items: ' . $conn->error);
        }
        
        $updatedCount = $stmt->affected_rows;
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => "$updatedCount menu item(s) reassigned to new category.",
            'updated_count' => $updatedCount
        ]);
    }
];