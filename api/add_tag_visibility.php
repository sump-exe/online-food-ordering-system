<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'food_ordering_db';
$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die('Connection failed: ' . $conn->connect_error);
}

$result = $conn->query("SHOW COLUMNS FROM tags LIKE 'is_visible'");
if ($result->num_rows === 0) {
    $sql = "ALTER TABLE tags ADD COLUMN is_visible TINYINT(1) NOT NULL DEFAULT 1";
    if ($conn->query($sql) === TRUE) {
        echo "Column 'is_visible' added successfully.";
    } else {
        echo "Error adding column: " . $conn->error;
    }
} else {
    echo "Column 'is_visible' already exists.";
}
$conn->close();
?>