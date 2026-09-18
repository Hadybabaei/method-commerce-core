-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phone_number` VARCHAR(191) NOT NULL,
    `auth_level` INTEGER NOT NULL DEFAULT 0,
    `email` VARCHAR(191) NULL,
    `refresh_token` TEXT NULL,
    `otp_code` VARCHAR(191) NULL,
    `otp_expiry` DATETIME(3) NULL,
    `account_status` BOOLEAN NULL,
    `type` ENUM('HOQOOQI', 'HAGHIGHI', 'NORMAL') NOT NULL DEFAULT 'NORMAL',
    `avatar` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'user',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_phone_number_key`(`phone_number`),
    INDEX `user_id_phone_number_idx`(`id`, `phone_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(191) NULL,
    `last_name` VARCHAR(191) NULL,
    `father_name` VARCHAR(191) NULL,
    `national_id` VARCHAR(191) NULL,
    `birth_date` VARCHAR(191) NULL,
    `register_code` INTEGER NULL,
    `business_role_id` INTEGER NULL,
    `company_name` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `role_id` INTEGER NULL,
    `tax_id` INTEGER NULL,
    `userId` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'operator',
    `status` BOOLEAN NOT NULL DEFAULT true,
    `first_name` VARCHAR(191) NULL,
    `last_name` VARCHAR(191) NULL,
    `nationalId` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `reset_password_token` VARCHAR(191) NULL,
    `reset_token_expire` DATETIME(3) NULL,
    `phone_number` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `province` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `tel_prefix` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `city` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `province_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_address` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `province_id` INTEGER NOT NULL,
    `city_id` INTEGER NOT NULL,
    `hood` VARCHAR(191) NOT NULL,
    `lat` DOUBLE NULL,
    `long` DOUBLE NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `pelak` VARCHAR(191) NOT NULL,
    `vahed` VARCHAR(191) NULL,
    `details` TEXT NOT NULL,
    `ownReceiver` BOOLEAN NOT NULL,
    `receiverFullName` VARCHAR(191) NULL,
    `receiverPhoneNumber` VARCHAR(191) NULL,

    INDEX `user_address_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_profile` ADD CONSTRAINT `user_profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `city` ADD CONSTRAINT `city_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_address` ADD CONSTRAINT `user_address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_address` ADD CONSTRAINT `user_address_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `province`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_address` ADD CONSTRAINT `user_address_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `city`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
