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
