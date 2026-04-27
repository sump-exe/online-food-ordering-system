<?php

$loginActions = [
    'login' => function ($conn, $body) {
        $username = $_GET['username'] ?? '';
        $password = $_GET['password'] ?? '';

        $account = findAccount($conn, 'users', 'userID', 'admin', $username, $password);
        if (!$account) {
            $account = findAccount($conn, 'customers', 'customerID', 'customer', $username, $password);
        }

        if (!$account) {
            respond(['user' => null]);
        }

        respond(['user' => [
            'userID'   => (int)$account['id'],
            'username' => $account['username'],
            'role'     => $account['role'],
        ]]);
    },
    'register' => function ($conn, $body) {
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';

        if (!$username || !$password) {
            respondError('Username and password are required.');
        }

        validatePassword($password);

        if (checkUsernameExists($conn, $username)) {
            respondError('Username already exists.');
        }

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $conn->prepare("INSERT INTO customers (username, password) VALUES (?, ?)");
        $stmt->bind_param('ss', $username, $hashedPassword);
        executePrepared($stmt, 'Registration failed');
        $newId = $stmt->insert_id;
        $stmt->close();

        respond([
            'user' => [
                'userID'   => $newId,
                'username' => $username,
                'role'     => 'customer',
            ],
            'message' => 'Registration successful! Please login.',
        ]);
    },
    'forgotPassword' => function ($conn, $body) {
        $username = $body['username'] ?? '';

        if (!$username) {
            respondError('Username is required.');
        }

        $stmt = $conn->prepare("SELECT customerID, username, email FROM customers WHERE username = ?");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $userData = $result->fetch_assoc();
        $stmt->close();

        if (!$userData) {
            $stmt = $conn->prepare("SELECT userID, username, email FROM users WHERE username = ?");
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $result = $stmt->get_result();
            $userData = $result->fetch_assoc();
            $stmt->close();
        }

        if (!$userData) {
            respondError('Username not found.');
        }

        $resetToken = bin2hex(random_bytes(32));
        $tokenExpiry = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $stmt = $conn->prepare("
            INSERT INTO password_resets (username, token, expiry, created_at)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
            token = VALUES(token),
            expiry = VALUES(expiry),
            created_at = NOW()
        ");
        $stmt->bind_param('sss', $username, $resetToken, $tokenExpiry);
        executePrepared($stmt, 'Failed to create password reset');
        $stmt->close();

        respond([
            'success' => true,
            'message' => 'Password reset link generated. Use this token to reset your password.',
            'reset_token' => $resetToken,
            'reset_link' => "reset-password.html?token=$resetToken&username=" . urlencode($username),
        ]);
    },
    'resetPassword' => function ($conn, $body) {
        $token = $body['token'] ?? '';
        $username = $body['username'] ?? '';
        $newPassword = $body['newPassword'] ?? '';
        $confirmPassword = $body['confirmPassword'] ?? '';

        if (!$token || !$username) {
            respondError('Token and username are required.');
        }
        if (!$newPassword || !$confirmPassword) {
            respondError('New password and confirmation are required.');
        }
        if ($newPassword !== $confirmPassword) {
            respondError('Passwords do not match.');
        }

        validatePassword($newPassword);

        $stmt = $conn->prepare("
            SELECT * FROM password_resets
            WHERE username = ? AND token = ? AND expiry > NOW()
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->bind_param('ss', $username, $token);
        $stmt->execute();
        $result = $stmt->get_result();
        $resetRecord = $result->fetch_assoc();
        $stmt->close();

        if (!$resetRecord) {
            respondError('Invalid or expired reset token. Please request a new password reset.');
        }

        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = false;

        $stmt = $conn->prepare("UPDATE customers SET password = ? WHERE username = ?");
        $stmt->bind_param('ss', $hashedPassword, $username);
        $stmt->execute();
        if ($stmt->affected_rows > 0) {
            $updated = true;
        }
        $stmt->close();

        if (!$updated) {
            $stmt = $conn->prepare("UPDATE users SET password = ? WHERE username = ?");
            $stmt->bind_param('ss', $hashedPassword, $username);
            $stmt->execute();
            if ($stmt->affected_rows > 0) {
                $updated = true;
            }
            $stmt->close();
        }

        if (!$updated) {
            respondError('User not found.');
        }

        $stmt = $conn->prepare("DELETE FROM password_resets WHERE username = ? AND token = ?");
        $stmt->bind_param('ss', $username, $token);
        executePrepared($stmt, 'Failed to delete password reset token');
        $stmt->close();

        respond([
            'success' => true,
            'message' => 'Password has been reset successfully! Please login with your new password.',
        ]);
    },
    'verifyResetToken' => function ($conn, $body) {
        $token = $_GET['token'] ?? '';
        $username = $_GET['username'] ?? '';

        if (!$token || !$username) {
            respond(['valid' => false, 'message' => 'Missing token or username']);
        }

        $stmt = $conn->prepare("
            SELECT * FROM password_resets
            WHERE username = ? AND token = ? AND expiry > NOW()
        ");
        $stmt->bind_param('ss', $username, $token);
        $stmt->execute();
        $result = $stmt->get_result();
        $valid = $result->num_rows > 0;
        $stmt->close();

        respond(['valid' => $valid]);
    },
    'getAccountSettings' => function ($conn, $body) {
        $customerId = (int)($_GET['customerId'] ?? 0);

        if ($customerId <= 0) {
            respondError('Customer ID is required.');
        }

        $stmt = $conn->prepare(
            "SELECT customerID AS userID, username, email, phone_number
             FROM customers
             WHERE customerID = ?"
        );
        $stmt->bind_param('i', $customerId);
        executePrepared($stmt, 'Failed to fetch account settings');
        $result = $stmt->get_result();
        $account = $result->fetch_assoc();
        $stmt->close();

        if (!$account) {
            respondError('Customer account not found.', 404);
        }

        respond([
            'userID' => (int)$account['userID'],
            'username' => $account['username'],
            'email' => $account['email'] ?? '',
            'phone_number' => $account['phone_number'] ?? '',
        ]);
    },
    'updateAccountSettings' => function ($conn, $body) {
        $customerId = (int)($body['customerId'] ?? 0);
        $email = trim((string)($body['email'] ?? ''));
        $phoneNumber = trim((string)($body['phoneNumber'] ?? ''));
        $currentPassword = $body['currentPassword'] ?? '';
        $newPassword = $body['newPassword'] ?? '';
        $confirmPassword = $body['confirmPassword'] ?? '';

        if ($customerId <= 0) {
            respondError('Customer ID is required.');
        }

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondError('Invalid email address.');
        }

        $stmt = $conn->prepare("SELECT username, password FROM customers WHERE customerID = ?");
        $stmt->bind_param('i', $customerId);
        executePrepared($stmt, 'Failed to verify account');
        $result = $stmt->get_result();
        $account = $result->fetch_assoc();
        $stmt->close();

        if (!$account) {
            respondError('Customer account not found.', 404);
        }

        $hashedPassword = null;
        if ($newPassword !== '' || $confirmPassword !== '' || $currentPassword !== '') {
            if ($currentPassword === '') {
                respondError('Current password is required to change password.');
            }
            if (!verifyAndUpgradePassword($conn, 'customers', 'customerID', ['id' => $customerId, 'password' => $account['password']], $currentPassword)) {
                respondError('Current password is incorrect.');
            }
            if ($newPassword === '' || $confirmPassword === '') {
                respondError('New password and confirmation are required.');
            }
            if ($newPassword !== $confirmPassword) {
                respondError('New passwords do not match.');
            }

            validatePassword($newPassword);
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        }

        if ($hashedPassword !== null) {
            $stmt = $conn->prepare(
                "UPDATE customers
                 SET email = ?, phone_number = ?, password = ?
                 WHERE customerID = ?"
            );
            $stmt->bind_param('sssi', $email, $phoneNumber, $hashedPassword, $customerId);
        } else {
            $stmt = $conn->prepare(
                "UPDATE customers
                 SET email = ?, phone_number = ?
                 WHERE customerID = ?"
            );
            $stmt->bind_param('ssi', $email, $phoneNumber, $customerId);
        }

        executePrepared($stmt, 'Failed to update account settings');
        $stmt->close();

        respond([
            'success' => true,
            'user' => [
                'userID' => $customerId,
                'username' => $account['username'],
                'role' => 'customer',
                'email' => $email,
                'phone_number' => $phoneNumber,
            ],
        ]);
    },
];
