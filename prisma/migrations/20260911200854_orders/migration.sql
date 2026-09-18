-- CreateTable
CREATE TABLE `order` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `reservationStatus` ENUM('NONE', 'RESERVED', 'RELEASED', 'CONSUMED') NOT NULL DEFAULT 'NONE',
    `paymentMethod` ENUM('CASH_ON_DELIVERY', 'ONLINE') NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    `itemCount` INTEGER NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `addressSnapshot` JSON NOT NULL,
    `note` TEXT NULL,
    `stockAllocations` JSON NULL,
    `cancelledAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `order_number_key`(`number`),
    INDEX `order_userId_created_at_idx`(`userId`, `created_at`),
    INDEX `order_status_created_at_idx`(`status`, `created_at`),
    INDEX `order_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `variantId` INTEGER NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` INTEGER NOT NULL,
    `lineTotal` INTEGER NOT NULL,
    `productSnapshot` JSON NOT NULL,

    INDEX `order_item_orderId_idx`(`orderId`),
    INDEX `order_item_variantId_idx`(`variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
