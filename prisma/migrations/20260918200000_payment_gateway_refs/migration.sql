-- CreateTable
CREATE TABLE `payment_gateway_ref` (
    `gatewayRef` VARCHAR(191) NOT NULL,
    `paymentId` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_gateway_ref_paymentId_idx`(`paymentId`),
    PRIMARY KEY (`gatewayRef`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_gateway_ref` ADD CONSTRAINT `payment_gateway_ref_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill current trackIds so existing in-flight sessions still resolve.
INSERT INTO `payment_gateway_ref` (`gatewayRef`, `paymentId`, `created_at`)
SELECT `gatewayRef`, `id`, COALESCE(`created_at`, CURRENT_TIMESTAMP(3))
FROM `payment`
WHERE `gatewayRef` IS NOT NULL;
