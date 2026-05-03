<?php

require_once __DIR__ . '/email_helper.php';

const OTP_EXPIRY_MINUTES = 2;

function normalizeOtpInput($otp) {
    $otp = trim((string)$otp);

    if ($otp === '' || !ctype_digit($otp)) {
        return null;
    }

    return str_pad($otp, 6, '0', STR_PAD_LEFT);
}

function createOtpRecord($conn, $username, $email, $otp, $type) {
    $stmt = $conn->prepare("
        INSERT INTO password_otps (username, email, otp, expires_at, type)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL " . OTP_EXPIRY_MINUTES . " MINUTE), ?)
    ");
    $stmt->bind_param('ssss', $username, $email, $otp, $type);
    executePrepared($stmt, 'Failed to create OTP');
    $stmt->close();
}

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
        $email = trim($body['email'] ?? '');

        if (!$username || !$password) {
            respondError('Username and password are required.');
        }

        if (!$email) {
            respondError('Email is required for registration.');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            respondError('Invalid email address.');
        }

        validatePassword($password);

        if (checkUsernameExists($conn, $username)) {
            respondError('Username already exists.');
        }

        // Check if email is already used
        $stmt = $conn->prepare("SELECT customerID FROM customers WHERE email = ?");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            $stmt->close();
            respondError('Email address is already registered.');
        }
        $stmt->close();

        // Generate 6-digit OTP for email verification
        $otp = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Delete any existing OTPs for this email/username
        $stmt = $conn->prepare("DELETE FROM password_otps WHERE (username = ? OR email = ?) AND type = 'registration' AND used = 0");
        $stmt->bind_param('ss', $username, $email);
        $stmt->execute();
        $stmt->close();

        // Insert OTP with type = registration
        createOtpRecord($conn, $username, $email, $otp, 'registration');

        // Send verification OTP via email
        $emailResult = sendVerificationEmail($email, $otp, $username);
        
        if (!$emailResult['success']) {
            respondError('Failed to send verification email: ' . $emailResult['message']);
        }

        respond([
            'success' => true,
            'message' => 'Registration started! Please check your email to verify your account.',
            'email' => maskEmail($email),
        ]);
    },
    'verifyRegistration' => function ($conn, $body) {
        $username = $body['username'] ?? '';
        $otp = normalizeOtpInput($body['otp'] ?? '');
        $password = $body['password'] ?? '';

        if (!$username || !$otp || !$password) {
            respondError('Username, OTP, and password are required.');
        }

        if (strlen($otp) !== 6 || !ctype_digit($otp)) {
            respondError('Invalid OTP format. Please enter a 6-digit code.');
        }

        validatePassword($password);

        // Find valid registration OTP
        $stmt = $conn->prepare("
            SELECT id, username, email 
            FROM password_otps 
            WHERE username = ? AND otp = ? AND type = 'registration' AND used = 0 AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
        ");
        $stmt->bind_param('ss', $username, $otp);
        $stmt->execute();
        $result = $stmt->get_result();
        $otpRecord = $result->fetch_assoc();
        $stmt->close();

        if (!$otpRecord) {
            respondError('Invalid or expired verification OTP. Please request a new registration.', 400);
        }

        $email = $otpRecord['email'];
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        // Create the customer account
        $stmt = $conn->prepare("INSERT INTO customers (username, email, password) VALUES (?, ?, ?)");
        $stmt->bind_param('sss', $username, $email, $hashedPassword);
        executePrepared($stmt, 'Registration failed');
        $newId = $stmt->insert_id;
        $stmt->close();

        // Mark OTP as used
        $stmt = $conn->prepare("UPDATE password_otps SET used = 1 WHERE id = ?");
        $stmt->bind_param('i', $otpRecord['id']);
        $stmt->execute();
        $stmt->close();

        respond([
            'user' => [
                'userID'   => $newId,
                'username' => $username,
                'role'     => 'customer',
            ],
            'message' => 'Email verified! Registration complete. Please login.',
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

        // Delete any existing unused password_reset OTPs for this username
        $stmt = $conn->prepare("DELETE FROM password_otps WHERE username = ? AND used = 0 AND (type = 'password_reset' OR type IS NULL OR type = '')");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $stmt->close();

        // Insert new OTP with explicit type
        createOtpRecord($conn, $username, $email, $otp, 'password_reset');

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
        $otp = normalizeOtpInput($body['otp'] ?? '');
        $email = $body['email'] ?? ''; // Optional: allow email for verification

        if ((!$username && !$email) || !$otp) {
            respondError('Username or email and OTP are required.');
        }

        if (strlen($otp) !== 6 || !ctype_digit($otp)) {
            respondError('Invalid OTP format. Please enter a 6-digit code.');
        }

        // First try to find by username
        $otpRecord = null;
        
        if ($username) {
            // Try with type check first
            $stmt = $conn->prepare("
                SELECT id, username, email 
                FROM password_otps 
                WHERE username = ? AND otp = ? AND (type = 'password_reset' OR type IS NULL OR type = '') AND used = 0 AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmt->bind_param('ss', $username, $otp);
            $stmt->execute();
            $result = $stmt->get_result();
            $otpRecord = $result->fetch_assoc();
            $stmt->close();
        }
        
        // If not found by username and email provided, try by email
        if (!$otpRecord && $email) {
            $stmt = $conn->prepare("
                SELECT id, username, email 
                FROM password_otps 
                WHERE email = ? AND otp = ? AND (type = 'password_reset' OR type IS NULL OR type = '') AND used = 0 AND expires_at > NOW()
                ORDER BY created_at DESC LIMIT 1
            ");
            $stmt->bind_param('ss', $email, $otp);
            $stmt->execute();
            $result = $stmt->get_result();
            $otpRecord = $result->fetch_assoc();
            $stmt->close();
        }

        if (!$otpRecord) {
            respondError('Invalid or expired OTP. Please request a new one.');
        }

        // Use the verified username from the record
        $verifiedUsername = $otpRecord['username'];

        // Mark OTP as used
        $stmt = $conn->prepare("UPDATE password_otps SET used = 1 WHERE id = ?");
        $stmt->bind_param('i', $otpRecord['id']);
        $stmt->execute();
        $stmt->close();

        respond([
            'success' => true,
            'message' => 'OTP verified successfully. You can now reset your password.',
            'username' => $verifiedUsername,
            'otp' => $otp,
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

// Delete any existing unused password_reset OTPs for this username
        $stmt = $conn->prepare("DELETE FROM password_otps WHERE username = ? AND used = 0 AND (type = 'password_reset' OR type IS NULL OR type = '')");
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $stmt->close();

        // Insert new OTP with explicit type
        createOtpRecord($conn, $username, $email, $otp, 'password_reset');

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
        $otp = normalizeOtpInput($body['otp'] ?? '');
        $username = $body['username'] ?? '';
        $email = $body['email'] ?? ''; // Optional email for verification
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

// Check if password_reset OTP was verified (used = 1)
        $stmt = $conn->prepare("
            SELECT id, email 
            FROM password_otps 
            WHERE username = ? AND otp = ? AND (type = 'password_reset' OR type IS NULL OR type = '') AND used = 1 AND expires_at > NOW()
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
