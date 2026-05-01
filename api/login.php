<?php

require_once __DIR__ . '/email_helper.php';

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

        // Check customers table first
        $stmt = $conn->prepare("SELECT customerID, username, email FROM customers WHERE username = ?");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $result = $stmt->get_result();
        $userData = $result->fetch_assoc();
        $stmt->close();

        // If not found, check users table
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

        // Check if email exists
        $email = $userData['email'] ?? '';
        if (empty($email)) {
            respondError('No email address found for this user. Please contact support.');
        }

        // Generate 6-digit OTP
        $otp = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $otpExpiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));

        // Delete any existing unused OTPs for this username
        $stmt = $conn->prepare("DELETE FROM password_otps WHERE username = ? AND used = 0");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $stmt->close();

        // Insert new OTP
        $stmt = $conn->prepare("INSERT INTO password_otps (username, email, otp, expires_at) VALUES (?, ?, ?, ?)");
        $stmt->bind_param('ssss', $username, $email, $otp, $otpExpiry);
        executePrepared($stmt, 'Failed to create OTP');
        $stmt->close();

        // Send OTP via email
        $emailResult = sendOTPEmail($email, $otp, $username);
        
        if (!$emailResult['success']) {
            respondError('Failed to send OTP email: ' . $emailResult['message']);
        }

        respond([
            'success' => true,
            'message' => 'OTP sent to your email address. Please check your inbox.',
            'email' => maskEmail($email),
        ]);
    },
    'verifyOTP' => function ($conn, $body) {
        $username = $body['username'] ?? '';
        $otp = $body['otp'] ?? '';

        if (!$username || !$otp) {
            respondError('Username and OTP are required.');
        }

        if (strlen($otp) !== 6 || !ctype_digit($otp)) {
            respondError('Invalid OTP format. Please enter a 6-digit code.');
        }

        // Find valid OTP
        $stmt = $conn->prepare("
            SELECT id, username, email 
            FROM password_otps 
            WHERE username = ? AND otp = ? AND used = 0 AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->bind_param('ss', $username, $otp);
        $stmt->execute();
        $result = $stmt->get_result();
        $otpRecord = $result->fetch_assoc();
        $stmt->close();

        if (!$otpRecord) {
            respondError('Invalid or expired OTP. Please request a new one.');
        }

        // Mark OTP as used
        $stmt = $conn->prepare("UPDATE password_otps SET used = 1 WHERE id = ?");
        $stmt->bind_param('i', $otpRecord['id']);
        $stmt->execute();
        $stmt->close();

        respond([
            'success' => true,
            'message' => 'OTP verified successfully. You can now reset your password.',
            'username' => $username,
        ]);
    },
    'resendOTP' => function ($conn, $body) {
        $username = $body['username'] ?? '';

        if (!$username) {
            respondError('Username is required.');
        }

        // Find user email
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

        $email = $userData['email'] ?? '';
        if (empty($email)) {
            respondError('No email address found for this user. Please contact support.');
        }

        // Generate new 6-digit OTP
        $otp = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $otpExpiry = date('Y-m-d H:i:s', strtotime('+10 minutes'));

        // Delete any existing unused OTPs for this username
        $stmt = $conn->prepare("DELETE FROM password_otps WHERE username = ? AND used = 0");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $stmt->close();

        // Insert new OTP
        $stmt = $conn->prepare("INSERT INTO password_otps (username, email, otp, expires_at) VALUES (?, ?, ?, ?)");
        $stmt->bind_param('ssss', $username, $email, $otp, $otpExpiry);
        executePrepared($stmt, 'Failed to create OTP');
        $stmt->close();

        // Send OTP via email
        $emailResult = sendOTPEmail($email, $otp, $username);
        
        if (!$emailResult['success']) {
            respondError('Failed to send OTP email: ' . $emailResult['message']);
        }

        respond([
            'success' => true,
            'message' => 'New OTP sent to your email address.',
            'email' => maskEmail($email),
        ]);
    },
'resetPassword' => function ($conn, $body) {
        $otp = $body['otp'] ?? '';
        $username = $body['username'] ?? '';
        $newPassword = $body['newPassword'] ?? '';
        $confirmPassword = $body['confirmPassword'] ?? '';

        if (!$otp || !$username) {
            respondError('OTP and username are required.');
        }
        if (!$newPassword || !$confirmPassword) {
            respondError('New password and confirmation are required.');
        }
        if ($newPassword !== $confirmPassword) {
            respondError('Passwords do not match.');
        }

        validatePassword($newPassword);

        // Check if OTP was verified (used = 1)
        $stmt = $conn->prepare("
            SELECT id, email 
            FROM password_otps 
            WHERE username = ? AND otp = ? AND used = 1
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->bind_param('ss', $username, $otp);
        $stmt->execute();
        $result = $stmt->get_result();
        $otpRecord = $result->fetch_assoc();
        $stmt->close();

        if (!$otpRecord) {
            respondError('Invalid OTP. Please verify your OTP first before resetting password.');
        }

        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = false;

        // Try customers table first
        $stmt = $conn->prepare("UPDATE customers SET password = ? WHERE username = ?");
        $stmt->bind_param('ss', $hashedPassword, $username);
        $stmt->execute();
        if ($stmt->affected_rows > 0) {
            $updated = true;
        }
        $stmt->close();

        // If not updated, try users table
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

        // Delete used OTP
        $stmt = $conn->prepare("DELETE FROM password_otps WHERE username = ? AND otp = ?");
        $stmt->bind_param('ss', $username, $otp);
        $stmt->execute();
        $stmt->close();

        // Send confirmation email if we have the email
        if (!empty($otpRecord['email'])) {
            sendPasswordChangedEmail($otpRecord['email'], $username);
        }

        respond([
            'success' => true,
            'message' => 'Password has been reset successfully! Please login with your new password.',
        ]);
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

        $stmt = $conn->prepare("SELECT username, email, password FROM customers WHERE customerID = ?");
        $stmt->bind_param('i', $customerId);
        executePrepared($stmt, 'Failed to verify account');
        $result = $stmt->get_result();
        $account = $result->fetch_assoc();
        $stmt->close();

        if (!$account) {
            respondError('Customer account not found.', 404);
        }

        $currentEmail = $account['email'] ?? '';
        $username = $account['username'];
        $hashedPassword = null;
        $passwordChanged = false;

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
            $passwordChanged = true;
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

        // Send confirmation email if password was changed
        if ($passwordChanged) {
            $notificationEmail = !empty($email) ? $email : $currentEmail;
            if (!empty($notificationEmail)) {
                sendPasswordChangedEmail($notificationEmail, $username);
            }
        }

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
    'deleteAccount' => function ($conn, $body) {
        $customerId = (int)($body['customerId'] ?? 0);
        $password = $body['password'] ?? '';

        if ($customerId <= 0) {
            respondError('Customer ID is required.');
        }
        if ($password === '') {
            respondError('Password is required to delete account.');
        }

        $stmt = $conn->prepare("SELECT customerID, username, password FROM customers WHERE customerID = ?");
        $stmt->bind_param('i', $customerId);
        executePrepared($stmt, 'Failed to verify account');
        $result = $stmt->get_result();
        $account = $result->fetch_assoc();
        $stmt->close();

        if (!$account) {
            respondError('Customer account not found.', 404);
        }

        if (!password_verify($password, $account['password'])) {
            respondError('Incorrect password.');
        }

        $conn->begin_transaction();
        try {
            $stmt = $conn->prepare("DELETE FROM orderitems WHERE OrderID IN (SELECT OrderID FROM orders WHERE customerID = ?)");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("DELETE FROM payments WHERE customerID = ?");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("DELETE FROM orders WHERE customerID = ?");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $stmt->close();

            $stmt = $conn->prepare("DELETE FROM customers WHERE customerID = ?");
            $stmt->bind_param('i', $customerId);
            $stmt->execute();
            $stmt->close();

            $conn->commit();
            respond(['success' => true, 'message' => 'Account deleted successfully.']);
        } catch (Exception $e) {
            $conn->rollback();
            respondError('Failed to delete account: ' . $e->getMessage());
        }
    },
];
