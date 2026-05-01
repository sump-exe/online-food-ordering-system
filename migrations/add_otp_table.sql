-- Add OTP table for password reset verification
-- Run this SQL in your MySQL database

CREATE TABLE IF NOT EXISTS password_otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    type VARCHAR(20) DEFAULT 'password_reset',
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_otp (otp),
    INDEX idx_expires (expires_at),
    INDEX idx_type (type)
);

-- If the table already exists without the 'type' column, run this ALTER statement:
-- ALTER TABLE password_otps ADD COLUMN type VARCHAR(20) DEFAULT 'password_reset' AFTER expires_at;

-- Optional: Clean up old OTPs (run periodically)
-- DELETE FROM password_otps WHERE expires_at < NOW() OR used = 1;
