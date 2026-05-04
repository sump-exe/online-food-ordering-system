<?php

$adminTagsActions = [
    // Get all tags
    'getTags' => function ($conn, $body) {
        $result = $conn->query("
            SELECT t.tagID, t.tag_name,
                   COUNT(ta.itemID) as usage_count
            FROM tags t
            LEFT JOIN tag_assignments ta ON ta.tagID = t.tagID
            GROUP BY t.tagID
            ORDER BY t.tag_name
        ");
        
        $tags = [];
        while ($row = $result->fetch_assoc()) {
            $tags[] = [
                'tagID' => (int)$row['tagID'],
                'tag_name' => $row['tag_name'],
                'usage_count' => (int)$row['usage_count']
            ];
        }
        respond($tags);
    },
    
    // Add new tag
    'addTag' => function ($conn, $body) {
        $tagName = trim($body['tag_name'] ?? '');
        
        if (empty($tagName)) {
            respondError('Tag name is required.');
        }
        
        // Check for duplicate
        $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ?");
        $check->bind_param('s', $tagName);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Tag name already exists.');
        }
        $check->close();
        
        $stmt = $conn->prepare("INSERT INTO tags (tag_name) VALUES (?)");
        $stmt->bind_param('s', $tagName);
        
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to add tag: ' . $conn->error);
        }
        
        $newId = $stmt->insert_id;
        $stmt->close();
        
        respond([
            'success' => true,
            'tagID' => $newId,
            'tag_name' => $tagName,
            'message' => 'Tag added successfully'
        ]);
    },
    
    // Update tag
    'updateTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        $tagName = trim($body['tag_name'] ?? '');
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        
        if (empty($tagName)) {
            respondError('Tag name is required.');
        }
        
        // Check for duplicate (excluding current tag)
        $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ? AND tagID != ?");
        $check->bind_param('si', $tagName, $tagId);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Tag name already exists.');
        }
        $check->close();
        
        $stmt = $conn->prepare("UPDATE tags SET tag_name = ? WHERE tagID = ?");
        $stmt->bind_param('si', $tagName, $tagId);
        
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to update tag: ' . $conn->error);
        }
        
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => 'Tag updated successfully'
        ]);
    },
    
    // Delete tag
    'deleteTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        
        // Check if tag is assigned to any menu items
        $check = $conn->prepare("SELECT COUNT(*) as count FROM tag_assignments WHERE tagID = ?");
        $check->bind_param('i', $tagId);
        $check->execute();
        $result = $check->get_result();
        $row = $result->fetch_assoc();
        $check->close();
        
        $message = '';
        if ($row['count'] > 0) {
            $message = " Tag was removed from {$row['count']} menu item(s).";
        }
        
        // Delete tag assignments first
        $delAssign = $conn->prepare("DELETE FROM tag_assignments WHERE tagID = ?");
        $delAssign->bind_param('i', $tagId);
        $delAssign->execute();
        $delAssign->close();
        
        // Delete tag
        $stmt = $conn->prepare("DELETE FROM tags WHERE tagID = ?");
        $stmt->bind_param('i', $tagId);
        
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to delete tag: ' . $conn->error);
        }
        
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => 'Tag deleted successfully.' . $message,
            'affected_items' => $row['count']
        ]);
    },
    
    // Get tag by ID
    'getTagById' => function ($conn, $body) {
        $tagId = (int)($_GET['tagID'] ?? 0);
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        
        $stmt = $conn->prepare("SELECT tagID, tag_name FROM tags WHERE tagID = ?");
        $stmt->bind_param('i', $tagId);
        $stmt->execute();
        $result = $stmt->get_result();
        $tag = $result->fetch_assoc();
        $stmt->close();
        
        if (!$tag) {
            respondError('Tag not found.');
        }
        
        respond([
            'tagID' => (int)$tag['tagID'],
            'tag_name' => $tag['tag_name']
        ]);
    }
];