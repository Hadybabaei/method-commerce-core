-- CreateTable
CREATE TABLE `otp_challenge` (
    `phone_number` VARCHAR(20) NOT NULL,
    `code` VARCHAR(10) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `otp_challenge_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`phone_number`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

