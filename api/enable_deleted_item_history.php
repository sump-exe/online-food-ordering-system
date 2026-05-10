<?php

require __DIR__ . '/bootstrap.php';

$constraints = [];
$result = $conn->query("
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orderitems'
      AND COLUMN_NAME = 'ItemID'
      AND REFERENCED_TABLE_NAME = 'menu_items'
");

while ($row = $result->fetch_assoc()) {
    $constraints[] = $row['CONSTRAINT_NAME'];
}

if ($result instanceof mysqli_result) {
    $result->free();
}

if (empty($constraints)) {
    respond([
        'success' => true,
        'message' => 'Historical deleted-item support is already enabled.'
    ]);
}

foreach ($constraints as $constraintName) {
    $safeConstraint = str_replace('`', '``', $constraintName);
    if (!$conn->query("ALTER TABLE `orderitems` DROP FOREIGN KEY `$safeConstraint`")) {
        respondError('Failed to update orderitems foreign keys: ' . $conn->error, 500);
    }
}

respond([
    'success' => true,
    'message' => 'Historical deleted-item support enabled successfully.'
]);
