-- CreateTable
CREATE TABLE `payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `gatewayRef` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `status` ENUM('INITIATED', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'INITIATED',
    `failureReason` VARCHAR(191) NULL,
    `redirectUrl` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `payment_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `payment_gatewayRef_key`(`gatewayRef`),
    INDEX `payment_orderId_status_idx`(`orderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment` ADD CONSTRAINT `payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
