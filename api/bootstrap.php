<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db   = 'food_ordering_db';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

function respond($data) {
    echo json_encode($data);
    exit;
}

function respondError($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function castRow($row, $intFields = []) {
    foreach ($intFields as $field) {
        if (isset($row[$field])) {
            $row[$field] = (int)$row[$field];
        }
    }
    return $row;
}

function fetchAllRows($result, $intFields = [], $boolFields = []) {
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $row = castRow($row, $intFields);
        foreach ($boolFields as $field) {
            if (isset($row[$field])) {
                $row[$field] = (bool)$row[$field];
            }
        }
        $rows[] = $row;
    }
    return $rows;
}

function validatePassword($password) {
    if (strlen($password) < 8) {
        respondError('Password must be at least 8 characters long.');
    }
    if (!preg_match('/[A-Z]/', $password)) {
        respondError('Password must contain at least one uppercase letter.');
    }
    if (!preg_match('/[!@#$%^&*()\[\],.?":{}|<>]/', $password)) {
        respondError('Password must contain at least one special character.');
    }
}

function checkUsernameExists($conn, $username) {
    $tables = ['customers' => 'customerID', 'users' => 'userID'];
    foreach ($tables as $table => $idField) {
        $chk = $conn->prepare("SELECT $idField FROM $table WHERE username = ?");
        $chk->bind_param('s', $username);
        $chk->execute();
        $chk->store_result();
        if ($chk->num_rows > 0) {
            $chk->close();
            return true;
        }
        $chk->close();
    }
    return false;
}

function verifyAndUpgradePassword($conn, $table, $idField, $account, $inputPassword) {
    $storedPassword = $account['password'] ?? '';

    if ($storedPassword === '') {
        return false;
    }

    if (password_verify($inputPassword, $storedPassword)) {
        return true;
    }

    if (!password_get_info($storedPassword)['algo'] && hash_equals($storedPassword, $inputPassword)) {
        $hashedPassword = password_hash($inputPassword, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE $table SET password = ? WHERE $idField = ?");
        $stmt->bind_param('si', $hashedPassword, $account['id']);
        executePrepared($stmt, 'Failed to upgrade password hash');
        $stmt->close();
        return true;
    }

    return false;
}

function findAccount($conn, $table, $idField, $role, $username, $password) {
    $stmt = $conn->prepare(
        "SELECT $idField AS id, username, password, ? AS role FROM $table WHERE username = ?"
    );
    $stmt->bind_param('ss', $role, $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $account = $result->fetch_assoc();
    $stmt->close();

    if ($account && verifyAndUpgradePassword($conn, $table, $idField, $account, $password)) {
        return [
            'id' => $account['id'],
            'username' => $account['username'],
            'role' => $account['role'],
        ];
    }
    return null;
}

function executePrepared($stmt, $errorMessage) {
    if (!$stmt->execute()) {
        $message = $errorMessage . ': ' . $stmt->error;
        $stmt->close();
        respondError($message);
    }
}

function respondSuccess() {
    respond(['success' => true]);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? '';

