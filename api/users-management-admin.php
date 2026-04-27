<?php

$adminUsersManagementActions = [
    'getUsers' => function ($conn, $body) {
        $result = $conn->query(
            "SELECT username, 'customer' AS role
             FROM customers
             UNION ALL
             SELECT username, 'admin' AS role
             FROM users
             ORDER BY role, username"
        );
        respond(fetchAllRows($result));
    },
];
