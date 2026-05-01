<?php

$adminCategoryActions = [
    'getCategories' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT categoryID, name, description, date_created 
             FROM categories 
             ORDER BY categoryID"
        );
        $categories = [];
        while ($row = $result->fetch_assoc()) {
            $categories[] = [
                'categoryID' => (int)$row['categoryID'],
                'name' => $row['name'],
                'description' => $row['description'] ?? '',
                'date_created' => $row['date_created']
            ];
        }
        respond($categories);
    },
    
    'addCategory' => function ($conn, $body) {
        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        
        if (empty($name)) {
            respondError('Category name is required.');
        }
        
        // Check for duplicate
        $check = $conn->prepare("SELECT categoryID FROM categories WHERE name = ?");
        $check->bind_param('s', $name);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Category name already exists.');
        }
        $check->close();
        
        $stmt = $conn->prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
        $stmt->bind_param('ss', $name, $description);
        executePrepared($stmt, 'Failed to add category');
        $newId = $stmt->insert_id;
        $stmt->close();
        
        respond([
            'success' => true,
            'categoryID' => $newId,
            'message' => 'Category added successfully'
        ]);
    },
    
    'updateCategory' => function ($conn, $body) {
        $categoryId = (int)($body['categoryID'] ?? 0);
        $name = trim($body['name'] ?? '');
        $description = trim($body['description'] ?? '');
        
        if ($categoryId <= 0) {
            respondError('Invalid category ID.');
        }
        
        if (empty($name)) {
            respondError('Category name is required.');
        }
        
        // Check for duplicate (excluding current category)
        $check = $conn->prepare("SELECT categoryID FROM categories WHERE name = ? AND categoryID != ?");
        $check->bind_param('si', $name, $categoryId);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Category name already exists.');
        }
        $check->close();
        
        $stmt = $conn->prepare("UPDATE categories SET name = ?, description = ? WHERE categoryID = ?");
        $stmt->bind_param('ssi', $name, $description, $categoryId);
        executePrepared($stmt, 'Failed to update category');
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => 'Category updated successfully'
        ]);
    },
    
    'deleteCategory' => function ($conn, $body) {
        $categoryId = (int)($body['categoryID'] ?? 0);
        
        if ($categoryId <= 0) {
            respondError('Invalid category ID.');
        }
        
        // Check if category has menu items
        $check = $conn->prepare("SELECT COUNT(*) as count FROM menu_items WHERE categoryID = ? OR category_id = ?");
        $check->bind_param('ii', $categoryId, $categoryId);
        $check->execute();
        $result = $check->get_result();
        $row = $result->fetch_assoc();
        $check->close();
        
        if ($row['count'] > 0) {
            respondError('Cannot delete category with existing menu items. Please reassign or delete the menu items first.');
        }
        
        $stmt = $conn->prepare("DELETE FROM categories WHERE categoryID = ?");
        $stmt->bind_param('i', $categoryId);
        executePrepared($stmt, 'Failed to delete category');
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => 'Category deleted successfully'
        ]);
    },
];