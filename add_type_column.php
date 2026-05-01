<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'food_ordering_db';
$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die('Connection failed: ' . $conn->connect_error);
}

// Check if type column exists
$result = $conn->query("SHOW COLUMNS FROM password_otps LIKE 'type'");
if ($result->num_rows === 0) {
    // Add type column
    $sql = "ALTER TABLE password_otps ADD COLUMN type VARCHAR(20) DEFAULT 'password_reset'";
    if ($conn->query($sql) === TRUE) {
        echo "Column 'type' added successfully";
    } else {
        echo "Error adding column: " . $conn->error;
    }
} else {
    echo "Column 'type' already exists";
}
$conn->close();
