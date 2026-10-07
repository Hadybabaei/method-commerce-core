-- AlterTable
ALTER TABLE `order` ADD COLUMN `processingAt` DATETIME(3) NULL,
    ADD COLUMN `shippedAt` DATETIME(3) NULL,
    ADD COLUMN `shippingFee` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `shippingMethodId` INTEGER NULL,
    ADD COLUMN `shippingSnapshot` JSON NULL,
    ADD COLUMN `total` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `trackingCode` VARCHAR(100) NULL,
    ADD COLUMN `trackingUrl` TEXT NULL,
    ADD COLUMN `weightGrams` INTEGER NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE `shipping_method` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `base_fee` INTEGER NOT NULL,
    `per_kg_fee` INTEGER NOT NULL DEFAULT 0,
    `free_above` INTEGER NULL,
    `min_days` INTEGER NULL,
    `max_days` INTEGER NULL,
    `province_ids` JSON NULL,
    `tracking_url_template` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shipping_method_code_key`(`code`),
    INDEX `shipping_method_is_active_position_idx`(`is_active`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `fromStatus` ENUM('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'CANCELLED', 'COMPLETED') NULL,
    `toStatus` ENUM('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'CANCELLED', 'COMPLETED') NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_event_orderId_created_at_idx`(`orderId`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_shippingMethodId_fkey` FOREIGN KEY (`shippingMethodId`) REFERENCES `shipping_method`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_event` ADD CONSTRAINT `order_status_event_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: orders placed before shipping existed paid exactly their subtotal.
UPDATE `order` SET `total` = `subtotal` + `shippingFee`;

-- Backfill: one history row per existing order for the status it is in now.
INSERT INTO `order_status_event` (`orderId`, `fromStatus`, `toStatus`, `note`, `created_at`)
SELECT `id`, NULL, `status`, 'Imported before status history existed', `created_at` FROM `order`;
