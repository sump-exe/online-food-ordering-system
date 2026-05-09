<?php

function tagVisibilityColumnExists($conn) {
    return hasTableColumn($conn, 'tags', 'is_visible');
}

$adminTagsActions = [
    'getTags' => function ($conn, $body) {
        $visibilitySelect = tagVisibilityColumnExists($conn)
            ? 't.is_visible'
            : '1 AS is_visible';

        $result = $conn->query("
            SELECT t.tagID, t.tag_name, $visibilitySelect,
                   COUNT(ta.itemID) as usage_count
            FROM tags t
            LEFT JOIN tag_assignments ta ON ta.tagID = t.tagID
            WHERE COALESCE(t.is_deleted, 0) = 0
            GROUP BY t.tagID
            ORDER BY t.tag_name
        ");
        
        $tags = [];
        while ($row = $result->fetch_assoc()) {
            $tags[] = [
                'tagID' => (int)$row['tagID'],
                'tag_name' => $row['tag_name'],
                'is_visible' => (bool)$row['is_visible'],
                'usage_count' => (int)$row['usage_count']
            ];
        }
        respond($tags);
    },
    
    'getDeletedTags' => function ($conn, $body) {
        $visibilitySelect = tagVisibilityColumnExists($conn)
            ? 't.is_visible'
            : '1 AS is_visible';

        $result = $conn->query("
            SELECT t.tagID, t.tag_name, $visibilitySelect,
                   COUNT(ta.itemID) as usage_count,
                   t.deleted_at
            FROM tags t
            LEFT JOIN tag_assignments ta ON ta.tagID = t.tagID
            WHERE COALESCE(t.is_deleted, 0) = 1
            GROUP BY t.tagID
            ORDER BY t.deleted_at DESC, t.tag_name
        ");
        
        $tags = [];
        while ($row = $result->fetch_assoc()) {
            $tags[] = [
                'tagID' => (int)$row['tagID'],
                'tag_name' => $row['tag_name'],
                'is_visible' => (bool)$row['is_visible'],
                'usage_count' => (int)$row['usage_count'],
                'deleted_at' => $row['deleted_at']
            ];
        }
        respond($tags);
    },
    
    'addTag' => function ($conn, $body) {
        $tagName = trim($body['tag_name'] ?? '');
        
        if (empty($tagName)) {
            respondError('Tag name is required.');
        }
        
        $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ? AND COALESCE(is_deleted, 0) = 0");
        $check->bind_param('s', $tagName);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Tag name already exists.');
        }
        $check->close();

        $insertSql = tagVisibilityColumnExists($conn)
            ? "INSERT INTO tags (tag_name, is_visible) VALUES (?, 1)"
            : "INSERT INTO tags (tag_name) VALUES (?)";
        $stmt = $conn->prepare($insertSql);
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
            'is_visible' => true,
            'message' => 'Tag added successfully'
        ]);
    },
    
    'updateTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        $tagName = trim($body['tag_name'] ?? '');
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        if (empty($tagName)) {
            respondError('Tag name is required.');
        }
        
        $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ? AND tagID != ? AND COALESCE(is_deleted, 0) = 0");
        $check->bind_param('si', $tagName, $tagId);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Tag name already exists.');
        }
        $check->close();
        
        $stmt = $conn->prepare("UPDATE tags SET tag_name = ? WHERE tagID = ? AND COALESCE(is_deleted, 0) = 0");
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
    
    'updateTagVisibility' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        $isVisible = $body['is_visible'] ?? null;
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        if ($isVisible === null) {
            respondError('Visibility value is required.');
        }
        if (!tagVisibilityColumnExists($conn)) {
            respondError("Tag visibility requires the 'is_visible' database column. Run api/add_tag_visibility.php once to enable it.", 500);
        }

        $visible = $isVisible ? 1 : 0;
        
        $stmt = $conn->prepare("UPDATE tags SET is_visible = ? WHERE tagID = ? AND COALESCE(is_deleted, 0) = 0");
        $stmt->bind_param('ii', $visible, $tagId);
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to update visibility: ' . $conn->error);
        }
        $stmt->close();
        
        respond([
            'success' => true,
            'message' => 'Visibility updated.'
        ]);
    },
    
    // Soft delete (move to trash)
    'deleteTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        
        // Get tag info for response
        $stmt = $conn->prepare("SELECT tag_name FROM tags WHERE tagID = ? AND COALESCE(is_deleted, 0) = 0");
        $stmt->bind_param('i', $tagId);
        $stmt->execute();
        $result = $stmt->get_result();
        $tag = $result->fetch_assoc();
        $stmt->close();
        
        if (!$tag) {
            respondError('Tag not found or already deleted.');
        }
        
        // Check usage count for warning
        $check = $conn->prepare("SELECT COUNT(*) as count FROM tag_assignments WHERE tagID = ?");
        $check->bind_param('i', $tagId);
        $check->execute();
        $res = $check->get_result();
        $row = $res->fetch_assoc();
        $usageCount = (int)($row['count'] ?? 0);
        $check->close();
        
        // Soft delete
        $stmt = $conn->prepare("UPDATE tags SET is_deleted = 1, deleted_at = NOW() WHERE tagID = ? AND COALESCE(is_deleted, 0) = 0");
        $stmt->bind_param('i', $tagId);
        executePrepared($stmt, 'Failed to move tag to trash');
        $deleted = $stmt->affected_rows;
        $stmt->close();
        
        if ($deleted === 0) {
            respondError('Tag not found or already deleted.');
        }
        
        $message = "Tag '{$tag['tag_name']}' moved to trash.";
        if ($usageCount > 0) {
            $message .= " It was used by {$usageCount} menu item(s).";
        }
        
        respond([
            'success' => true,
            'message' => $message,
            'usage_count' => $usageCount
        ]);
    },
    
    // Restore tag from trash
    'restoreTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        
        $stmt = $conn->prepare("UPDATE tags SET is_deleted = 0, deleted_at = NULL WHERE tagID = ? AND COALESCE(is_deleted, 0) = 1");
        $stmt->bind_param('i', $tagId);
        executePrepared($stmt, 'Failed to restore tag');
        $restored = $stmt->affected_rows;
        $stmt->close();
        
        if ($restored === 0) {
            respondError('Tag not found in trash.');
        }
        
        respond([
            'success' => true,
            'message' => 'Tag restored successfully.'
        ]);
    },
    
    // Permanently delete tag (only from trash)
    'permanentlyDeleteTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }
        
        // Get tag info for message
        $stmt = $conn->prepare("SELECT tag_name FROM tags WHERE tagID = ? AND COALESCE(is_deleted, 0) = 1");
        $stmt->bind_param('i', $tagId);
        $stmt->execute();
        $result = $stmt->get_result();
        $tag = $result->fetch_assoc();
        $stmt->close();
        
        if (!$tag) {
            respondError('Tag not found in trash.');
        }
        
        // Remove tag assignments first
        $stmt = $conn->prepare("DELETE FROM tag_assignments WHERE tagID = ?");
        $stmt->bind_param('i', $tagId);
        $stmt->execute();
        $stmt->close();
        
        // Permanently delete the tag
        $stmt = $conn->prepare("DELETE FROM tags WHERE tagID = ? AND COALESCE(is_deleted, 0) = 1");
        $stmt->bind_param('i', $tagId);
        executePrepared($stmt, 'Failed to permanently delete tag');
        $deleted = $stmt->affected_rows;
        $stmt->close();
        
        if ($deleted === 0) {
            respondError('Tag not found in trash.');
        }
        
        respond([
            'success' => true,
            'message' => "Tag '{$tag['tag_name']}' permanently deleted."
        ]);
    },
    
    'getTagById' => function ($conn, $body) {
        $tagId = (int)($_GET['tagID'] ?? 0);
        
        if ($tagId <= 0) {
            respondError('Invalid tag ID.');
        }

        $visibilitySelect = tagVisibilityColumnExists($conn)
            ? 'is_visible'
            : '1 AS is_visible';
        $stmt = $conn->prepare("SELECT tagID, tag_name, $visibilitySelect FROM tags WHERE tagID = ? AND COALESCE(is_deleted, 0) = 0");
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
            'tag_name' => $tag['tag_name'],
            'is_visible' => (bool)$tag['is_visible']
        ]);
    }
];