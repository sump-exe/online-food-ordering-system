<?php
require __DIR__ . '/api/bootstrap.php';

echo "=== Categories table schema ===\n";
$result = $conn->query("DESCRIBE categories");
while ($row = $result->fetch_assoc()) {
    echo $row['Field'] . " - " . $row['Type'] . "\n";
}

echo "\n=== Current categories ===\n";
$result = $conn->query("SELECT * FROM categories");
while ($row = $result->fetch_assoc()) {
    var_dump($row);
}