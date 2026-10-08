-- AlterTable
ALTER TABLE `user` ADD COLUMN `blocked_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `admin` ADD COLUMN `permissions` JSON NULL;

-- AlterTable
ALTER TABLE `product_variant` ADD COLUMN `low_stock_threshold` INTEGER NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `discountTotal` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `promotionId` INTEGER NULL,
    ADD COLUMN `promotionSnapshot` JSON NULL;

-- AlterTable
ALTER TABLE `order_item` ADD COLUMN `discountAmount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `promotion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NULL,
    `kind` ENUM('PERCENT', 'FIXED', 'FREE_SHIPPING') NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `max_discount` INTEGER NULL,
    `min_subtotal` INTEGER NULL,
    `starts_at` DATETIME(3) NOT NULL,
    `ends_at` DATETIME(3) NULL,
    `usage_limit` INTEGER NULL,
    `per_customer_limit` INTEGER NULL,
    `category_ids` JSON NULL,
    `brand_ids` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `used_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `promotion_code_key`(`code`),
    INDEX `promotion_is_active_starts_at_idx`(`is_active`, `starts_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promotion_redemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `promotionId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `promotion_redemption_orderId_key`(`orderId`),
    INDEX `promotion_redemption_promotionId_userId_idx`(`promotionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variantId` INTEGER NOT NULL,
    `locationId` INTEGER NOT NULL,
    `delta` INTEGER NOT NULL,
    `onHandAfter` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `adminId` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movement_variantId_created_at_idx`(`variantId`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adminId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(64) NULL,
    `payload` JSON NULL,
    `status` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_log_adminId_created_at_idx`(`adminId`, `created_at`),
    INDEX `admin_audit_log_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `admin_audit_log_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_redemption` ADD CONSTRAINT `promotion_redemption_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `promotion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promotion_redemption` ADD CONSTRAINT `promotion_redemption_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_audit_log` ADD CONSTRAINT `admin_audit_log_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing super admins keep full access; other admins start with order handling only.
UPDATE `admin` SET `permissions` = JSON_ARRAY("orders", "customers") WHERE `role` <> "admin" AND `permissions` IS NULL;
