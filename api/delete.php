<?php
require 'db.php'; // your database connection

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['itemID'])) {
    $itemID = (int) $_POST['itemID'];

    $stmt = $pdo->prepare("UPDATE menu_items SET is_deleted = 1, deleted_at = NOW() WHERE itemID = ?");
    $stmt->execute([$itemID]);

    header("Location: menu_items.php?msg=item_deleted");
    exit;
}