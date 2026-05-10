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

        // Keep visible tags for card badges, but include all active tags for search.
        if (!empty($items)) {
            $itemIds = array_column($items, 'itemID');
            $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
            $types = str_repeat('i', count($itemIds));
            $hasVisibilityColumn = hasTableColumn($conn, 'tags', 'is_visible');
            $hasSoftDeleteColumn = hasTableColumn($conn, 'tags', 'is_deleted');
            $visibilitySelect = $hasVisibilityColumn ? ', t.is_visible' : ', 1 AS is_visible';
            $tagFilters = ['ta.itemID IN (' . $placeholders . ')'];

            if ($hasSoftDeleteColumn) {
                $tagFilters[] = 'COALESCE(t.is_deleted, 0) = 0';
            }

            $tagStmt = $conn->prepare("
                SELECT ta.itemID, t.tagID, t.tag_name$visibilitySelect
                FROM tag_assignments ta
                JOIN tags t ON t.tagID = ta.tagID
                WHERE " . implode(' AND ', $tagFilters) . "
            ");
            $tagStmt->bind_param($types, ...$itemIds);
            $tagStmt->execute();
            $tagRes = $tagStmt->get_result();
            $visibleTagMap = [];
            $searchTagMap = [];
            while ($row = $tagRes->fetch_assoc()) {
                $itemId = (int)$row['itemID'];
                $tag = [
                    'tagID' => (int)$row['tagID'],
                    'tag_name' => $row['tag_name']
                ];

                $searchTagMap[$itemId][] = $tag;

                if ((int)$row['is_visible'] === 1) {
                    $visibleTagMap[$itemId][] = $tag;
                }
            }
            $tagStmt->close();
            foreach ($items as &$item) {
                $item['tags'] = $visibleTagMap[$item['itemID']] ?? [];
                $item['search_tags'] = $searchTagMap[$item['itemID']] ?? [];
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
