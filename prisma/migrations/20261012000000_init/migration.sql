-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('HOQOOQI', 'HAGHIGHI', 'NORMAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrderReservationStatus" AS ENUM ('NONE', 'RESERVED', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "SlugRedirectType" AS ENUM ('PRODUCT', 'CATEGORY', 'BRAND');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "phone_number" TEXT NOT NULL,
    "auth_level" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT,
    "refresh_token" TEXT,
    "otp_code" TEXT,
    "otp_expiry" TIMESTAMP(3),
    "account_status" BOOLEAN,
    "blocked_at" TIMESTAMP(3),
    "type" "UserType" NOT NULL DEFAULT 'NORMAL',
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "father_name" TEXT,
    "national_id" TEXT,
    "birth_date" TEXT,
    "register_code" INTEGER,
    "business_role_id" INTEGER,
    "company_name" TEXT,
    "phone" TEXT,
    "role_id" INTEGER,
    "tax_id" INTEGER,
    "userId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "permissions" JSONB,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "first_name" TEXT,
    "last_name" TEXT,
    "nationalId" TEXT,
    "address" TEXT,
    "avatarUrl" TEXT,
    "reset_password_token" TEXT,
    "reset_token_expire" TIMESTAMP(3),
    "phone_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "province" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tel_prefix" TEXT NOT NULL,

    CONSTRAINT "province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "province_id" INTEGER NOT NULL,

    CONSTRAINT "city_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_address" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "province_id" INTEGER NOT NULL,
    "city_id" INTEGER NOT NULL,
    "hood" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "long" DOUBLE PRECISION,
    "postalCode" TEXT NOT NULL,
    "pelak" TEXT NOT NULL,
    "vahed" TEXT,
    "details" TEXT NOT NULL,
    "ownReceiver" BOOLEAN NOT NULL,
    "receiverFullName" TEXT,
    "receiverPhoneNumber" TEXT,

    CONSTRAINT "user_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "seo_title" VARCHAR(120),
    "seo_description" VARCHAR(320),
    "parentId" INTEGER,
    "path" VARCHAR(255) NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "seo_title" VARCHAR(120),
    "seo_description" VARCHAR(320),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "sub_title" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seo_title" VARCHAR(120),
    "seo_description" VARCHAR(320),
    "short_description" TEXT,
    "publish" BOOLEAN NOT NULL DEFAULT true,
    "weightGrams" INTEGER NOT NULL DEFAULT 500,
    "tax_exempt" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_value" (
    "id" SERIAL NOT NULL,
    "optionId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_option_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "option_signature" VARCHAR(255) NOT NULL,
    "price" INTEGER NOT NULL,
    "sale_price" INTEGER,
    "weightGrams" INTEGER,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "low_stock_threshold" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option_value" (
    "variantId" INTEGER NOT NULL,
    "optionValueId" INTEGER NOT NULL,

    CONSTRAINT "variant_option_value_pkey" PRIMARY KEY ("variantId","optionValueId")
);

-- CreateTable
CREATE TABLE "inventory_location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "inventory_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_level" (
    "variantId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_level_pkey" PRIMARY KEY ("variantId","locationId")
);

-- CreateTable
CREATE TABLE "basket" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "basket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "basket_item" (
    "basketId" INTEGER NOT NULL,
    "variantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "basket_item_pkey" PRIMARY KEY ("basketId","variantId")
);

-- CreateTable
CREATE TABLE "order" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "reservationStatus" "OrderReservationStatus" NOT NULL DEFAULT 'NONE',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "itemCount" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "addressSnapshot" JSONB NOT NULL,
    "note" TEXT,
    "stockAllocations" JSONB,
    "shippingMethodId" INTEGER,
    "shippingSnapshot" JSONB,
    "shippingFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER NOT NULL DEFAULT 0,
    "trackingCode" VARCHAR(100),
    "trackingUrl" TEXT,
    "taxRateBp" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "promotionId" INTEGER,
    "promotionSnapshot" JSONB,
    "refundedTotal" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "processingAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "failureReason" TEXT,
    "redirectUrl" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_ref" (
    "gatewayRef" TEXT NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_gateway_ref_pkey" PRIMARY KEY ("gatewayRef")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "rate" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "productId" INTEGER NOT NULL,
    "userId" INTEGER,
    "adminId" INTEGER,
    "parentId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_image" (
    "id" SERIAL NOT NULL,
    "commentId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "context" VARCHAR(40) NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "userId" INTEGER,
    "adminId" INTEGER,
    "readAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_method" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "base_fee" INTEGER NOT NULL,
    "per_kg_fee" INTEGER NOT NULL DEFAULT 0,
    "free_above" INTEGER,
    "min_days" INTEGER,
    "max_days" INTEGER,
    "province_ids" JSONB,
    "tracking_url_template" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_event" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "vat_rate_bp" INTEGER NOT NULL DEFAULT 1000,
    "return_window_days" INTEGER NOT NULL DEFAULT 7,
    "legal_name" TEXT,
    "economic_code" VARCHAR(20),
    "national_id" VARCHAR(20),
    "registration_no" VARCHAR(20),
    "address" TEXT,
    "postal_code" VARCHAR(10),
    "phone" VARCHAR(20),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "adminNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_item" (
    "id" SERIAL NOT NULL,
    "returnRequestId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "return_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "returnRequestId" INTEGER,
    "amount" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "reference" VARCHAR(100) NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "adminId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(40),
    "kind" "PromotionKind" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "max_discount" INTEGER,
    "min_subtotal" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "per_customer_limit" INTEGER,
    "category_ids" JSONB,
    "brand_ids" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemption" (
    "id" SERIAL NOT NULL,
    "promotionId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "onHandAfter" INTEGER NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "adminId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER,
    "action" VARCHAR(191) NOT NULL,
    "entity" VARCHAR(64) NOT NULL,
    "entityId" VARCHAR(64),
    "payload" JSONB,
    "status" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_redirect" (
    "id" SERIAL NOT NULL,
    "type" "SlugRedirectType" NOT NULL,
    "old_slug" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slug_redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_alert" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "variantId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "stock_alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenge" (
    "phone_number" VARCHAR(20) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_challenge_pkey" PRIMARY KEY ("phone_number")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_number_key" ON "user"("phone_number");

-- CreateIndex
CREATE INDEX "user_id_phone_number_idx" ON "user"("id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_userId_key" ON "user_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- CreateIndex
CREATE INDEX "user_address_userId_idx" ON "user_address"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_path_idx" ON "category"("path");

-- CreateIndex
CREATE INDEX "category_parentId_position_idx" ON "category"("parentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "brand_slug_key" ON "brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE INDEX "product_categoryId_publish_idx" ON "product"("categoryId", "publish");

-- CreateIndex
CREATE INDEX "product_brandId_publish_idx" ON "product"("brandId", "publish");

-- CreateIndex
CREATE INDEX "user_favorite_userId_created_at_idx" ON "user_favorite"("userId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_userId_productId_key" ON "user_favorite"("userId", "productId");

-- CreateIndex
CREATE INDEX "product_image_productId_position_idx" ON "product_image"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_productId_name_key" ON "product_option"("productId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_value_optionId_value_key" ON "product_option_value"("optionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_sku_key" ON "product_variant"("sku");

-- CreateIndex
CREATE INDEX "product_variant_productId_is_active_idx" ON "product_variant"("productId", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_productId_option_signature_key" ON "product_variant"("productId", "option_signature");

-- CreateIndex
CREATE INDEX "variant_option_value_optionValueId_idx" ON "variant_option_value"("optionValueId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_location_code_key" ON "inventory_location"("code");

-- CreateIndex
CREATE INDEX "inventory_level_locationId_idx" ON "inventory_level"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "basket_userId_key" ON "basket"("userId");

-- CreateIndex
CREATE INDEX "basket_item_variantId_idx" ON "basket_item"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "order_number_key" ON "order"("number");

-- CreateIndex
CREATE INDEX "order_userId_created_at_idx" ON "order"("userId", "created_at");

-- CreateIndex
CREATE INDEX "order_status_created_at_idx" ON "order"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_created_at_idx" ON "order"("created_at");

-- CreateIndex
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");

-- CreateIndex
CREATE INDEX "order_item_variantId_idx" ON "order_item"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gatewayRef_key" ON "payment"("gatewayRef");

-- CreateIndex
CREATE INDEX "payment_orderId_status_idx" ON "payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "payment_gateway_ref_paymentId_idx" ON "payment_gateway_ref"("paymentId");

-- CreateIndex
CREATE INDEX "comment_productId_published_created_at_idx" ON "comment"("productId", "published", "created_at");

-- CreateIndex
CREATE INDEX "comment_userId_created_at_idx" ON "comment"("userId", "created_at");

-- CreateIndex
CREATE INDEX "comment_parentId_idx" ON "comment"("parentId");

-- CreateIndex
CREATE INDEX "comment_published_created_at_idx" ON "comment"("published", "created_at");

-- CreateIndex
CREATE INDEX "comment_image_commentId_position_idx" ON "comment_image"("commentId", "position");

-- CreateIndex
CREATE INDEX "notification_audience_recipientId_created_at_idx" ON "notification"("audience", "recipientId", "created_at");

-- CreateIndex
CREATE INDEX "notification_audience_recipientId_readAt_idx" ON "notification"("audience", "recipientId", "readAt");

-- CreateIndex
CREATE INDEX "notification_context_type_idx" ON "notification"("context", "type");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_method_code_key" ON "shipping_method"("code");

-- CreateIndex
CREATE INDEX "shipping_method_is_active_position_idx" ON "shipping_method"("is_active", "position");

-- CreateIndex
CREATE INDEX "order_status_event_orderId_created_at_idx" ON "order_status_event"("orderId", "created_at");

-- CreateIndex
CREATE INDEX "return_request_status_created_at_idx" ON "return_request"("status", "created_at");

-- CreateIndex
CREATE INDEX "return_request_orderId_idx" ON "return_request"("orderId");

-- CreateIndex
CREATE INDEX "return_request_item_orderItemId_idx" ON "return_request_item"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "return_request_item_returnRequestId_orderItemId_key" ON "return_request_item"("returnRequestId", "orderItemId");

-- CreateIndex
CREATE INDEX "refund_orderId_idx" ON "refund"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_code_key" ON "promotion"("code");

-- CreateIndex
CREATE INDEX "promotion_is_active_starts_at_idx" ON "promotion"("is_active", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_redemption_orderId_key" ON "promotion_redemption"("orderId");

-- CreateIndex
CREATE INDEX "promotion_redemption_promotionId_userId_idx" ON "promotion_redemption"("promotionId", "userId");

-- CreateIndex
CREATE INDEX "stock_movement_variantId_created_at_idx" ON "stock_movement"("variantId", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_adminId_created_at_idx" ON "admin_audit_log"("adminId", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_entity_entityId_idx" ON "admin_audit_log"("entity", "entityId");

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "slug_redirect_type_targetId_idx" ON "slug_redirect"("type", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "slug_redirect_type_old_slug_key" ON "slug_redirect"("type", "old_slug");

-- CreateIndex
CREATE INDEX "stock_alert_variantId_notified_at_idx" ON "stock_alert"("variantId", "notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_alert_userId_variantId_key" ON "stock_alert"("userId", "variantId");

-- CreateIndex
CREATE INDEX "otp_challenge_expires_at_idx" ON "otp_challenge"("expires_at");

-- AddForeignKey
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city" ADD CONSTRAINT "city_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_address" ADD CONSTRAINT "user_address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_address" ADD CONSTRAINT "user_address_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "province"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_address" ADD CONSTRAINT "user_address_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite" ADD CONSTRAINT "user_favorite_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option" ADD CONSTRAINT "product_option_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_value" ADD CONSTRAINT "product_option_value_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "product_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "product_option_value"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket" ADD CONSTRAINT "basket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_item" ADD CONSTRAINT "basket_item_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "basket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_item" ADD CONSTRAINT "basket_item_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_method"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_ref" ADD CONSTRAINT "payment_gateway_ref_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_image" ADD CONSTRAINT "comment_image_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_event" ADD CONSTRAINT "order_status_event_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_item" ADD CONSTRAINT "return_request_item_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_item" ADD CONSTRAINT "return_request_item_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

