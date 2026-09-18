-- CreateTable
CREATE TABLE `notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `audience` ENUM('USER', 'ADMIN') NOT NULL,
    `recipientId` INTEGER NOT NULL,
    `context` VARCHAR(40) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `data` JSON NULL,
    `userId` INTEGER NULL,
    `adminId` INTEGER NULL,
    `readAt` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_audience_recipientId_created_at_idx`(`audience`, `recipientId`, `created_at`),
    INDEX `notification_audience_recipientId_readAt_idx`(`audience`, `recipientId`, `readAt`),
    INDEX `notification_context_type_idx`(`context`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
