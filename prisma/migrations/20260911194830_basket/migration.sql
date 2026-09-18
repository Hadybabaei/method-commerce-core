-- CreateTable
CREATE TABLE `basket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `basket_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `basket_item` (
    `basketId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `basket_item_variantId_idx`(`variantId`),
    PRIMARY KEY (`basketId`, `variantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `basket` ADD CONSTRAINT `basket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `basket_item` ADD CONSTRAINT `basket_item_basketId_fkey` FOREIGN KEY (`basketId`) REFERENCES `basket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `basket_item` ADD CONSTRAINT `basket_item_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
