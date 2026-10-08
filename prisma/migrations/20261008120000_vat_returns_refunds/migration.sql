-- AlterTable
ALTER TABLE `product` ADD COLUMN `tax_exempt` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `refundedTotal` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `taxRateBp` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `taxTotal` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `order_item` ADD COLUMN `taxAmount` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `store_setting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `vat_rate_bp` INTEGER NOT NULL DEFAULT 1000,
    `return_window_days` INTEGER NOT NULL DEFAULT 7,
    `legal_name` VARCHAR(191) NULL,
    `economic_code` VARCHAR(20) NULL,
    `national_id` VARCHAR(20) NULL,
    `registration_no` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `postal_code` VARCHAR(10) NULL,
    `phone` VARCHAR(20) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_request` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED') NOT NULL DEFAULT 'REQUESTED',
    `reason` TEXT NOT NULL,
    `adminNote` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `return_request_status_created_at_idx`(`status`, `created_at`),
    INDEX `return_request_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_request_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `returnRequestId` INTEGER NOT NULL,
    `orderItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `return_request_item_orderItemId_idx`(`orderItemId`),
    UNIQUE INDEX `return_request_item_returnRequestId_orderItemId_key`(`returnRequestId`, `orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refund` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `returnRequestId` INTEGER NULL,
    `amount` INTEGER NOT NULL,
    `restocked` BOOLEAN NOT NULL DEFAULT false,
    `reference` VARCHAR(100) NOT NULL,
    `note` TEXT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `adminId` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refund_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `return_request` ADD CONSTRAINT `return_request_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_request_item` ADD CONSTRAINT `return_request_item_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `return_request`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_request_item` ADD CONSTRAINT `return_request_item_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `order_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund` ADD CONSTRAINT `refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund` ADD CONSTRAINT `refund_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `return_request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Default settings row: 10% VAT, 7-day returns.
INSERT INTO `store_setting` (`id`, `vat_rate_bp`, `return_window_days`, `updated_at`) VALUES (1, 1000, 7, CURRENT_TIMESTAMP(3));
