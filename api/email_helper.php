<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Mask email address for display (e.g., t***@gmail.com)
 * 
 * @param string $email Email address to mask
 * @return string Masked email address
 */
function maskEmail($email) {
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return '';
    }
    
    $parts = explode('@', $email);
    if (count($parts) !== 2) {
        return '';
    }
    
    $local = $parts[0];
    $domain = $parts[1];
    
    if (strlen($local) <= 2) {
        $maskedLocal = str_repeat('*', strlen($local));
    } else {
        $maskedLocal = $local[0] . str_repeat('*', strlen($local) - 2) . $local[strlen($local) - 1];
    }
    
    return $maskedLocal . '@' . $domain;
}

// Gmail configuration
define('GMAIL_USERNAME', 'tokwa1324@gmail.com');
define('GMAIL_APP_PASSWORD', 'isgesxuryfgrgbug');
define('GMAIL_SMTP_HOST', 'smtp.gmail.com');
define('GMAIL_SMTP_PORT', 587);
define('GMAIL_SMTP_ENCRYPTION', 'tls');

/**
 * Send OTP email for password reset
 * 
 * @param string $email Recipient email address
 * @param string $otp 6-digit OTP code
 * @param string $username Username of the account
 * @return array Result with success status and message
 */
function sendOTPEmail($email, $otp, $username) {
    $mail = new PHPMailer(true);
    
    try {
        // Server settings
        $mail->SMTPDebug = SMTP::DEBUG_OFF;
        $mail->isSMTP();
        $mail->Host = GMAIL_SMTP_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = GMAIL_USERNAME;
        $mail->Password = GMAIL_APP_PASSWORD;
        $mail->SMTPSecure = GMAIL_SMTP_ENCRYPTION;
        $mail->Port = GMAIL_SMTP_PORT;
        
        // Recipients
        $mail->setFrom(GMAIL_USERNAME, 'FoodieDash');
        $mail->addAddress($email, $username);
        
        // Content
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = 'Password Reset OTP - FoodieDash';
        $mail->Body = '
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
                .header { text-align: center; margin-bottom: 20px; }
                .logo { color: #ff5722; font-size: 24px; font-weight: bold; }
                .content { font-size: 16px; color: #333; }
                .otp-box { 
                    background: linear-gradient(135deg, #ff5722, #ff9800); 
                    color: white; 
                    padding: 20px; 
                    text-align: center; 
                    border-radius: 8px; 
                    font-size: 32px; 
                    font-weight: bold; 
                    letter-spacing: 8px; 
                    margin: 20px 0;
                }
                .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🍔 FoodieDash</div>
                </div>
                <div class="content">
                    <p>Hello <strong>' . htmlspecialchars($username) . '</strong>,</p>
                    <p>We received a request to reset your password. Use the OTP below to verify your identity:</p>
                    <div class="otp-box">' . $otp . '</div>
                    <p>This OTP will expire in <strong>10 minutes</strong>.</p>
                    <p>If you did not request this password reset, please ignore this email or contact support.</p>
                </div>
                <div class="footer">
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        ';
        $mail->AltBody = "Hello $username,\n\nWe received a request to reset your password. Your OTP is: $otp\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request this password reset, please ignore this email.";
        
        $mail->send();
        return ['success' => true, 'message' => 'OTP sent successfully'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Failed to send OTP email: ' . $mail->ErrorInfo];
    }
}

/**
 * Send password changed confirmation email
 * 
 * @param string $email Recipient email address
 * @param string $username Username of the account
 * @return array Result with success status and message
 */
function sendPasswordChangedEmail($email, $username) {
    $mail = new PHPMailer(true);
    
    try {
        // Server settings
        $mail->SMTPDebug = SMTP::DEBUG_OFF;
        $mail->isSMTP();
        $mail->Host = GMAIL_SMTP_HOST;
        $mail->SMTPAuth = true;
        $mail->Username = GMAIL_USERNAME;
        $mail->Password = GMAIL_APP_PASSWORD;
        $mail->SMTPSecure = GMAIL_SMTP_ENCRYPTION;
        $mail->Port = GMAIL_SMTP_PORT;
        
        // Recipients
        $mail->setFrom(GMAIL_USERNAME, 'FoodieDash');
        $mail->addAddress($email, $username);
        
        // Content
        $mail->isHTML(true);
        $mail->CharSet = 'UTF-8';
        $mail->Subject = 'Password Changed Successfully - FoodieDash';
        $mail->Body = '
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
                .header { text-align: center; margin-bottom: 20px; }
                .logo { color: #ff5722; font-size: 24px; font-weight: bold; }
                .content { font-size: 16px; color: #333; }
                .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🍔 FoodieDash</div>
                </div>
                <div class="content">
                    <p>Hello <strong>' . htmlspecialchars($username) . '</strong>,</p>
                    <div class="success-icon">✅</div>
                    <p>Your password has been changed successfully!</p>
                    <p>If you did not make this change, please contact support immediately.</p>
                </div>
                <div class="footer">
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        ';
        $mail->AltBody = "Hello $username,\n\nYour password has been changed successfully!\n\nIf you did not make this change, please contact support immediately.";
        
        $mail->send();
        return ['success' => true, 'message' => 'Confirmation email sent'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Failed to send confirmation email: ' . $mail->ErrorInfo];
    }
}
