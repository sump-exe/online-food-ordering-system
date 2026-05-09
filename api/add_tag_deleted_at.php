<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'food_ordering_db';
$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die('Connection failed: ' . $conn->connect_error);
}

$result = $conn->query("SHOW COLUMNS FROM tags LIKE 'deleted_at'");
if ($result->num_rows === 0) {
    $sql = "ALTER TABLE tags ADD COLUMN deleted_at DATETIME DEFAULT NULL";
    if ($conn->query($sql) === TRUE) {
        echo "Column 'deleted_at' added successfully.";
    } else {
        echo "Error adding column: " . $conn->error;
    }
} else {
    echo "Column 'deleted_at' already exists.";
}
$conn->close();
?>