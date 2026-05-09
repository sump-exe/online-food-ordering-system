<?php

/**
 * Helper functions
 */
function tagVisibilityColumnExists($conn) {
    return hasTableColumn($conn, 'tags', 'is_visible');
}

function tagSoftDeleteColumnsExist($conn) {
    return hasTableColumn($conn, 'tags', 'is_deleted') && hasTableColumn($conn, 'tags', 'deleted_at');
}

$adminTagsActions = [
    'getTags' => function ($conn, $body) {
        $visibilitySelect = tagVisibilityColumnExists($conn) ? 't.is_visible' : '1 AS is_visible';

        if (tagSoftDeleteColumnsExist($conn)) {
            $sql = "SELECT t.tagID, t.tag_name, $visibilitySelect,
                           COUNT(ta.itemID) as usage_count
                    FROM tags t
                    LEFT JOIN tag_assignments ta ON ta.tagID = t.tagID
                    WHERE t.is_deleted = 0
                    GROUP BY t.tagID
                    ORDER BY t.tag_name";
        } else {
            $sql = "SELECT t.tagID, t.tag_name, $visibilitySelect,
                           COUNT(ta.itemID) as usage_count
                    FROM tags t
                    LEFT JOIN tag_assignments ta ON ta.tagID = t.tagID
                    GROUP BY t.tagID
                    ORDER BY t.tag_name";
        }

        $result = $conn->query($sql);
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
        if (!tagSoftDeleteColumnsExist($conn)) {
            respond([]);
        }

        $visibilitySelect = tagVisibilityColumnExists($conn) ? 't.is_visible' : '1 AS is_visible';
        $result = $conn->query("
            SELECT t.tagID, t.tag_name, $visibilitySelect, t.deleted_at,
                   COUNT(ta.itemID) as usage_count
            FROM tags t
            LEFT JOIN tag_assignments ta ON ta.tagID = t.tagID
            WHERE t.is_deleted = 1
            GROUP BY t.tagID
            ORDER BY t.deleted_at DESC
        ");
        $tags = [];
        while ($row = $result->fetch_assoc()) {
            $tags[] = [
                'tagID' => (int)$row['tagID'],
                'tag_name' => $row['tag_name'],
                'is_visible' => (bool)$row['is_visible'],
                'deleted_at' => $row['deleted_at'],
                'usage_count' => (int)$row['usage_count']
            ];
        }
        respond($tags);
    },
    
    'addTag' => function ($conn, $body) {
        $tagName = trim($body['tag_name'] ?? '');
        if (empty($tagName)) respondError('Tag name is required.');

        if (tagSoftDeleteColumnsExist($conn)) {
            $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ? AND is_deleted = 0");
        } else {
            $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ?");
        }
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
        if ($tagId <= 0) respondError('Invalid tag ID.');
        if (empty($tagName)) respondError('Tag name is required.');

        if (tagSoftDeleteColumnsExist($conn)) {
            $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ? AND tagID != ? AND is_deleted = 0");
        } else {
            $check = $conn->prepare("SELECT tagID FROM tags WHERE tag_name = ? AND tagID != ?");
        }
        $check->bind_param('si', $tagName, $tagId);
        $check->execute();
        $check->store_result();
        if ($check->num_rows > 0) {
            $check->close();
            respondError('Tag name already exists.');
        }
        $check->close();

        if (tagSoftDeleteColumnsExist($conn)) {
            $stmt = $conn->prepare("UPDATE tags SET tag_name = ? WHERE tagID = ? AND is_deleted = 0");
        } else {
            $stmt = $conn->prepare("UPDATE tags SET tag_name = ? WHERE tagID = ?");
        }
        $stmt->bind_param('si', $tagName, $tagId);
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to update tag: ' . $conn->error);
        }
        $stmt->close();

        respond(['success' => true, 'message' => 'Tag updated successfully']);
    },
    
    'updateTagVisibility' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        $isVisible = $body['is_visible'] ?? null;
        if ($tagId <= 0) respondError('Invalid tag ID.');
        if ($isVisible === null) respondError('Visibility value is required.');
        if (!tagVisibilityColumnExists($conn)) {
            respondError("Tag visibility requires the 'is_visible' database column. Run api/add_tag_visibility.php once to enable it.", 500);
        }
        $visible = $isVisible ? 1 : 0;

        if (tagSoftDeleteColumnsExist($conn)) {
            $stmt = $conn->prepare("UPDATE tags SET is_visible = ? WHERE tagID = ? AND is_deleted = 0");
        } else {
            $stmt = $conn->prepare("UPDATE tags SET is_visible = ? WHERE tagID = ?");
        }
        $stmt->bind_param('ii', $visible, $tagId);
        if (!$stmt->execute()) {
            $stmt->close();
            respondError('Failed to update visibility: ' . $conn->error);
        }
        $stmt->close();

        respond(['success' => true, 'message' => 'Visibility updated.']);
    },
    
    // Soft delete
    'deleteTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        if ($tagId <= 0) respondError('Invalid tag ID.');

        if (tagSoftDeleteColumnsExist($conn)) {
            $stmt = $conn->prepare("SELECT tagID FROM tags WHERE tagID = ? AND is_deleted = 0");
            $stmt->bind_param('i', $tagId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows === 0) {
                $stmt->close();
                respondError('Tag not found or already deleted.');
            }
            $stmt->close();

            $stmt = $conn->prepare("UPDATE tags SET is_deleted = 1, deleted_at = NOW() WHERE tagID = ?");
            $stmt->bind_param('i', $tagId);
            executePrepared($stmt, 'Failed to move tag to trash');
            $deleted = $stmt->affected_rows;
            $stmt->close();
            if ($deleted === 0) respondError('Tag not found or already deleted.');
            respond(['success' => true, 'message' => 'Tag moved to Trash.']);
        } else {
            // Fallback to hard delete if columns missing
            $stmt = $conn->prepare("DELETE FROM tag_assignments WHERE tagID = ?");
            $stmt->bind_param('i', $tagId);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("DELETE FROM tags WHERE tagID = ?");
            $stmt->bind_param('i', $tagId);
            executePrepared($stmt, 'Failed to delete tag');
            $stmt->close();
            respond(['success' => true, 'message' => 'Tag permanently deleted (soft‑delete columns missing).']);
        }
    },
    
    // Restore
    'restoreTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        if ($tagId <= 0) respondError('Invalid tag ID.');
        if (!tagSoftDeleteColumnsExist($conn)) respondError('Soft‑delete columns missing.');

        $stmt = $conn->prepare("UPDATE tags SET is_deleted = 0, deleted_at = NULL WHERE tagID = ? AND is_deleted = 1");
        $stmt->bind_param('i', $tagId);
        executePrepared($stmt, 'Failed to restore tag');
        $restored = $stmt->affected_rows;
        $stmt->close();
        if ($restored === 0) respondError('Tag not found in Trash.');
        respond(['success' => true, 'message' => 'Tag restored successfully.']);
    },
    
    // Permanent delete
    'permanentlyDeleteTag' => function ($conn, $body) {
        $tagId = (int)($body['tagID'] ?? 0);
        if ($tagId <= 0) respondError('Invalid tag ID.');
        if (!tagSoftDeleteColumnsExist($conn)) respondError('Soft‑delete columns missing.');

        $stmt = $conn->prepare("SELECT tagID FROM tags WHERE tagID = ? AND is_deleted = 1");
        $stmt->bind_param('i', $tagId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            $stmt->close();
            respondError('Tag not found in Trash.');
        }
        $stmt->close();

        $delAssign = $conn->prepare("DELETE FROM tag_assignments WHERE tagID = ?");
        $delAssign->bind_param('i', $tagId);
        $delAssign->execute();
        $delAssign->close();

        $delTag = $conn->prepare("DELETE FROM tags WHERE tagID = ? AND is_deleted = 1");
        $delTag->bind_param('i', $tagId);
        executePrepared($delTag, 'Failed to permanently delete tag');
        $delTag->close();

        respond(['success' => true, 'message' => 'Tag permanently deleted.']);
    },
    
    'getTagById' => function ($conn, $body) {
        $tagId = (int)($_GET['tagID'] ?? 0);
        if ($tagId <= 0) respondError('Invalid tag ID.');

        $visibilitySelect = tagVisibilityColumnExists($conn) ? 'is_visible' : '1 AS is_visible';
        $stmt = $conn->prepare("SELECT tagID, tag_name, $visibilitySelect FROM tags WHERE tagID = ?");
        $stmt->bind_param('i', $tagId);
        $stmt->execute();
        $result = $stmt->get_result();
        $tag = $result->fetch_assoc();
        $stmt->close();

        if (!$tag) respondError('Tag not found.');
        respond([
            'tagID' => (int)$tag['tagID'],
            'tag_name' => $tag['tag_name'],
            'is_visible' => (bool)$tag['is_visible']
        ]);
    }
];