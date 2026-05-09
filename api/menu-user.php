<?php

$userMenuActions = [
    'getMenuItems' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT m.itemID,
                    COALESCE(m.name, CONCAT('Item #', m.itemID)) AS name,
                    m.price,
                    m.stock,
                    m.categoryID AS categoryID,
                    c.name AS category_name,
                    (m.stock > 0) AS available
             FROM menu_items m
             LEFT JOIN categories c
                    ON c.categoryID = m.categoryID
                   AND COALESCE(c.is_deleted, 0) = 0
             WHERE COALESCE(m.is_deleted, 0) = 0
             ORDER BY m.itemID"
        );
        $items = fetchAllRows($result, ['itemID', 'price', 'stock', 'categoryID'], ['available']);
        foreach ($items as &$item) {
            $item['image_url'] = getMenuItemImageUrl($item['itemID']);
        }
        unset($item);

        // Attach only visible tags for each item
        if (!empty($items)) {
            $itemIds = array_column($items, 'itemID');
            $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
            $types = str_repeat('i', count($itemIds));
            $tagJoin = hasTableColumn($conn, 'tags', 'is_visible')
                ? 'JOIN tags t ON t.tagID = ta.tagID AND t.is_visible = 1'
                : 'JOIN tags t ON t.tagID = ta.tagID';
            $tagStmt = $conn->prepare("
                SELECT ta.itemID, t.tagID, t.tag_name
                FROM tag_assignments ta
                $tagJoin
                WHERE ta.itemID IN ($placeholders)
            ");
            $tagStmt->bind_param($types, ...$itemIds);
            $tagStmt->execute();
            $tagRes = $tagStmt->get_result();
            $tagMap = [];
            while ($row = $tagRes->fetch_assoc()) {
                $tagMap[(int)$row['itemID']][] = [
                    'tagID' => (int)$row['tagID'],
                    'tag_name' => $row['tag_name']
                ];
            }
            $tagStmt->close();
            foreach ($items as &$item) {
                $item['tags'] = $tagMap[$item['itemID']] ?? [];
            }
            unset($item);
        }

        respond($items);
    },
    'getCategories' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT categoryID, name
             FROM categories
             WHERE COALESCE(is_deleted, 0) = 0
             ORDER BY categoryID"
        );
        respond(fetchAllRows($result, ['categoryID']));
    },
];
