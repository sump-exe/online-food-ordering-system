<?php
$conn = new mysqli('127.0.0.1', 'root', '', 'food_ordering_db');
$result = $conn->query('DESCRIBE password_otps');
while ($row = $result->fetch_assoc()) {
    echo $row['Field'] . ' - ' . $row['Type'] . ' - ' . $row['Null'] . ' - ' . $row['Default'] . PHP_EOL;
}
$conn->close();
