<?php
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['itemID'])) {
    $itemID = (int) $_POST['itemID'];

    // Guard: only delete items already in Trash
    $stmt = $pdo->prepare("DELETE FROM menu_items WHERE itemID = ? AND is_deleted = 1");
    $stmt->execute([$itemID]);

    header("Location: trash.php?msg=item_permanently_deleted");
    exit;
}