<?php
// ============================================================
//  FoodieDash – Entry Point
//  Place in C:/xampp/htdocs/your-folder/
// ============================================================

// this is what will run when you open the file in localhost

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db   = 'food_ordering_db';

$conn = new mysqli($host, $user, $pass, $db);
$dbOk = !$conn->connect_error;
if ($dbOk) $conn->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>FoodieDash | Online Food Ordering System</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <?php if (!$dbOk): ?>
    <div style="background:#fee2e2;color:#991b1b;padding:16px 24px;text-align:center;font-family:sans-serif;">
        ⚠️ <strong>Database connection failed.</strong>
        Make sure XAMPP MySQL is running and the database <code>food_ordering_db</code> exists.
    </div>
    <?php endif; ?>

    <div class="app" id="app">
        <div style="text-align:center;padding:50px;">Loading FoodieDash...</div>
    </div>

    <script>
        // Expose DB status to app.js
        window.DB_CONNECTED = <?= $dbOk ? 'true' : 'false' ?>;
    </script>
    <script src="app.js"></script>
</body>
</html>