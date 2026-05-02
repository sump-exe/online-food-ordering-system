<?php
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['itemID'])) {
    $itemID = (int) $_POST['itemID'];

    $stmt = $pdo->prepare("UPDATE menu_items SET is_deleted = 0, deleted_at = NULL WHERE itemID = ?");
    $stmt->execute([$itemID]);

    header("Location: trash.php?msg=item_restored");
    exit;
}