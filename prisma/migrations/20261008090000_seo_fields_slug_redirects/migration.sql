-- AlterTable
ALTER TABLE `category` ADD COLUMN `seo_description` VARCHAR(320) NULL,
    ADD COLUMN `seo_title` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `brand` ADD COLUMN `seo_description` VARCHAR(320) NULL,
    ADD COLUMN `seo_title` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `seo_description` VARCHAR(320) NULL,
    ADD COLUMN `seo_title` VARCHAR(120) NULL;

-- CreateTable
CREATE TABLE `slug_redirect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('PRODUCT', 'CATEGORY', 'BRAND') NOT NULL,
    `old_slug` VARCHAR(191) NOT NULL,
    `targetId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `slug_redirect_type_targetId_idx`(`type`, `targetId`),
    UNIQUE INDEX `slug_redirect_type_old_slug_key`(`type`, `old_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

