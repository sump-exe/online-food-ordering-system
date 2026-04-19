<?php
require __DIR__ . '/food-ordering-system.html';

// no html syntax necessary, as the HTML file is included above
// php code here meant to connect to the database

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'food_ordering_db';

// try lang ng condition para ma-check kung successful ang connection
$conn = new mysqli($host, $user, $pass);
if (!$conn) {
    echo "Connection failed: " . mysqli_connect_error();
}