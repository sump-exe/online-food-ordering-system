<?php

$userMenuActions = [
    'getMenuItems' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT m.itemID,
                    COALESCE(m.name, CONCAT('Item #', m.itemID)) AS name,
                    m.price,
                    m.stock,
                    m.categoryID,
                    c.name AS category_name,
                    (m.stock > 0) AS available,
                    m.timeToPrepare
             FROM menu_items m
             LEFT JOIN categories c ON c.categoryID = m.categoryID
             ORDER BY m.itemID"
        );
        respond(fetchAllRows($result, ['itemID', 'price', 'stock', 'categoryID'], ['available']));
    },
    'getCategories' => function ($conn, $body) {
        $result = $conn->query("SELECT categoryID, name FROM categories ORDER BY categoryID");
        respond(fetchAllRows($result, ['categoryID']));
    },
];

