-- AlterTable
ALTER TABLE `user_favorite` ADD COLUMN `variantId` INTEGER NULL;

-- CreateTable
CREATE TABLE `stock_alert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notified_at` DATETIME(3) NULL,

    INDEX `stock_alert_variantId_notified_at_idx`(`variantId`, `notified_at`),
    UNIQUE INDEX `stock_alert_userId_variantId_key`(`userId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_favorite` ADD CONSTRAINT `user_favorite_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_alert` ADD CONSTRAINT `stock_alert_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_alert` ADD CONSTRAINT `stock_alert_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

