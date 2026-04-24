<?php

$adminUsersManagementActions = [
    'getUsers' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT customerID AS id, username, 'customer' AS role,
                    '******** (encrypted)' AS password_display
             FROM customers
             UNION ALL
             SELECT userID AS id, username, 'admin' AS role,
                    '******** (encrypted)' AS password_display
             FROM users
             ORDER BY role, username"
        );
        respond(fetchAllRows($result, ['id']));
    },
];

