-- Fix script: Add type column to password_otps table
-- Run this SQL if the password_otps table already exists without the 'type' column

-- Check if type column exists
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'food_ordering_db' 
AND TABLE_NAME = 'password_otps' 
AND COLUMN_NAME = 'type';

-- If the column doesn't exist, run this ALTER statement:
ALTER TABLE password_otps ADD COLUMN type VARCHAR(20) DEFAULT 'password_reset' AFTER expires_at;

-- Add index on type column for faster queries
ALTER TABLE password_otps ADD INDEX idx_type (type);

-- Update any existing NULL or empty type values to default 'password_reset'
UPDATE password_otps SET type = 'password_reset' WHERE type IS NULL OR type = '';
