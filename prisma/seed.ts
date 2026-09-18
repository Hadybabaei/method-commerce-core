import {
  NotificationAudience,
  OrderReservationStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  UserType,
} from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const CUSTOMER_PHONE = process.env.SEED_CUSTOMER_PHONE ?? '09121234567'
const OPERATOR_EMAIL = 'operator@method-commerce.local'

/**
 * Minimal province/city fixtures so the address endpoints are usable on a fresh
 * database. Production should import the full national dataset instead.
 */
const LOCATION_FIXTURES = [
  {
    name: 'تهران',
    slug: 'tehran',
    telPrefix: '021',
    cities: ['تهران', 'شهریار', 'ورامین'],
  },
  {
    name: 'اصفهان',
    slug: 'isfahan',
    telPrefix: '031',
    cities: ['اصفهان', 'کاشان'],
  },
  {
    name: 'فارس',
    slug: 'fars',
    telPrefix: '071',
    cities: ['شیراز', 'مرودشت'],
  },
]

function optionSignature(option: string, value: string): string {
  return `${option.toLowerCase()}:${value.toLowerCase()}`
}

function addressSnapshot(input: {
  id: number
  title: string
  province: { id: number; name: string; slug: string; tel_prefix: string }
  city: { id: number; name: string; slug: string; province_id: number }
  hood: string
  postalCode: string
  pelak: string
  vahed: string | null
  details: string
}) {
  return {
    id: input.id,
    title: input.title,
    province: {
      id: input.province.id,
      name: input.province.name,
      slug: input.province.slug,
      telPrefix: input.province.tel_prefix,
    },
    city: {
      id: input.city.id,
      name: input.city.name,
      slug: input.city.slug,
      provinceId: input.city.province_id,
    },
    hood: input.hood,
    postalCode: input.postalCode,
    pelak: input.pelak,
    vahed: input.vahed,
    details: input.details,
    receiver: { isAccountOwner: true, fullName: null, phoneNumber: null },
    location: { latitude: 35.759, longitude: 51.401 },
  }
}

function productSnapshot(input: {
  productId: number
  variantId: number
  title: string
  slug: string
  sku: string
  options: { option: string; value: string }[]
  image: string | null
}) {
  return {
    productId: input.productId,
    variantId: input.variantId,
    title: input.title,
    slug: input.slug,
    sku: input.sku,
    options: input.options,
    image: input.image,
    thumbnail: input.image,
  }
}

async function seedSuperAdmin(): Promise<{ id: number; email: string }> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@method-commerce.local').toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234'

  const existing = await prisma.admin.findUnique({ where: { email } })
  if (existing) {
    console.log(`Super admin ${email} already exists; skipping.`)
    return { id: existing.id, email }
  }

  const admin = await prisma.admin.create({
    data: {
      email,
      password: await hash(password, 10),
      role: 'admin',
      status: true,
      first_name: 'Super',
      last_name: 'Admin',
      phone_number: '09120000000',
    },
  })

  console.log(`Created super admin ${email}`)
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('SEED_ADMIN_PASSWORD was not set; the default password was used. Change it now.')
  }

  return { id: admin.id, email }
}

async function seedOperatorAdmin(): Promise<{ id: number }> {
  const existing = await prisma.admin.findUnique({ where: { email: OPERATOR_EMAIL } })
  if (existing) {
    console.log(`Operator ${OPERATOR_EMAIL} already exists; skipping.`)
    return { id: existing.id }
  }

  const admin = await prisma.admin.create({
    data: {
      email: OPERATOR_EMAIL,
      password: await hash('operator1234', 10),
      role: 'operator',
      status: true,
      first_name: 'Ali',
      last_name: 'Karimi',
      phone_number: '09121111111',
    },
  })
  console.log(`Created operator ${OPERATOR_EMAIL} (password operator1234)`)
  return { id: admin.id }
}

async function seedLocations(): Promise<void> {
  if ((await prisma.province.count()) > 0) {
    console.log('Provinces already present; skipping location fixtures.')
    return
  }

  for (const fixture of LOCATION_FIXTURES) {
    await prisma.province.create({
      data: {
        name: fixture.name,
        slug: fixture.slug,
        tel_prefix: fixture.telPrefix,
        cities: {
          create: fixture.cities.map((name, index) => ({
            name,
            slug: `${fixture.slug}-${index + 1}`,
          })),
        },
      },
    })
  }

  console.log(`Created ${LOCATION_FIXTURES.length} provinces with their cities`)
}

async function seedInventoryLocation(): Promise<{ id: number }> {
  const existing = await prisma.inventory_location.findUnique({ where: { code: 'MAIN' } })
  if (existing) {
    console.log('Default warehouse MAIN already exists; skipping.')
    return { id: existing.id }
  }

  const location = await prisma.inventory_location.create({
    data: { name: 'انبار اصلی', code: 'MAIN', is_active: true },
  })
  console.log('Created default warehouse MAIN')
  return { id: location.id }
}

async function seedCustomer(): Promise<{ id: number }> {
  const existing = await prisma.user.findUnique({ where: { phone_number: CUSTOMER_PHONE } })
  if (existing) {
    console.log(`Customer ${CUSTOMER_PHONE} already exists; skipping.`)
    return { id: existing.id }
  }

  const user = await prisma.user.create({
    data: {
      phone_number: CUSTOMER_PHONE,
      auth_level: 1,
      account_status: true,
      email: 'customer@method-commerce.local',
      type: UserType.NORMAL,
      role: 'user',
      profile: {
        create: {
          first_name: 'هادی',
          last_name: 'رضایی',
          father_name: 'محمد',
          national_id: '0012345678',
          birth_date: '1990-05-21',
          phone: '02112345678',
        },
      },
    },
  })
  console.log(`Created customer ${CUSTOMER_PHONE} (OTP login)`)
  return { id: user.id }
}

async function seedCategories(): Promise<{ toolsId: number; drillsId: number; handId: number }> {
  const tools = await prisma.category.upsert({
    where: { slug: 'power-tools' },
    create: {
      title: 'ابزار برقی',
      slug: 'power-tools',
      description: 'دریل، فرز و ابزار شارژی',
      path: '/',
      depth: 0,
      position: 0,
    },
    update: {},
  })

  const drills = await prisma.category.upsert({
    where: { slug: 'drills' },
    create: {
      title: 'دریل',
      slug: 'drills',
      parentId: tools.id,
      path: `/${tools.id}/`,
      depth: 1,
      position: 0,
    },
    update: { parentId: tools.id, path: `/${tools.id}/`, depth: 1 },
  })

  const hand = await prisma.category.upsert({
    where: { slug: 'hand-tools' },
    create: {
      title: 'ابزار دستی',
      slug: 'hand-tools',
      description: 'متر، آچار و پیچ‌گوشتی',
      path: '/',
      depth: 0,
      position: 1,
    },
    update: {},
  })

  console.log('Seeded categories')
  return { toolsId: tools.id, drillsId: drills.id, handId: hand.id }
}

async function seedBrands(): Promise<{ boschId: number; stanleyId: number }> {
  const bosch = await prisma.brand.upsert({
    where: { slug: 'bosch' },
    create: {
      title: 'بوش',
      slug: 'bosch',
      description: 'Robert Bosch',
      logo: 'https://cdn.method-commerce.ir/brands/bosch.png',
    },
    update: {},
  })
  const stanley = await prisma.brand.upsert({
    where: { slug: 'stanley' },
    create: {
      title: 'استنلی',
      slug: 'stanley',
      logo: 'https://cdn.method-commerce.ir/brands/stanley.png',
    },
    update: {},
  })
  console.log('Seeded brands')
  return { boschId: bosch.id, stanleyId: stanley.id }
}

async function seedProducts(input: {
  drillsId: number
  handId: number
  boschId: number
  stanleyId: number
  warehouseId: number
}): Promise<{
  drillId: number
  tapeId: number
  redVariantId: number
  blueVariantId: number
  tapeVariantId: number
}> {
  const drillImage = 'https://cdn.method-commerce.ir/products/drill-1.jpg'
  const tapeImage = 'https://cdn.method-commerce.ir/products/tape-1.jpg'

  const drill = await prisma.product.upsert({
    where: { slug: 'drill-bosch' },
    create: {
      title: 'دریل شارژی بوش',
      sub_title: '۱۸ ولت',
      slug: 'drill-bosch',
      description: 'دریل شارژی ۱۸ ولت مناسب کارگاه و منزل.',
      short_description: '۱۸ ولت، دو سرعته',
      publish: true,
      weightGrams: 1500,
      categoryId: input.drillsId,
      brandId: input.boschId,
      images: {
        create: [
          { url: drillImage, thumbnail: true, position: 0 },
          { url: 'https://cdn.method-commerce.ir/products/drill-2.jpg', thumbnail: false, position: 1 },
        ],
      },
    },
    update: { publish: true, categoryId: input.drillsId, brandId: input.boschId },
  })

  const colorOption = await prisma.product_option.upsert({
    where: { productId_name: { productId: drill.id, name: 'رنگ' } },
    create: { productId: drill.id, name: 'رنگ', position: 0 },
    update: {},
  })
  const redValue = await prisma.product_option_value.upsert({
    where: { optionId_value: { optionId: colorOption.id, value: 'قرمز' } },
    create: { optionId: colorOption.id, value: 'قرمز', position: 0 },
    update: {},
  })
  const blueValue = await prisma.product_option_value.upsert({
    where: { optionId_value: { optionId: colorOption.id, value: 'آبی' } },
    create: { optionId: colorOption.id, value: 'آبی', position: 1 },
    update: {},
  })

  const red = await prisma.product_variant.upsert({
    where: { sku: 'DRL-RED' },
    create: {
      productId: drill.id,
      sku: 'DRL-RED',
      option_signature: optionSignature('رنگ', 'قرمز'),
      price: 2_400_000,
      sale_price: 2_100_000,
      weightGrams: 1500,
      image: drillImage,
      is_active: true,
      optionValues: { create: { optionValueId: redValue.id } },
    },
    update: { is_active: true, price: 2_400_000, sale_price: 2_100_000 },
  })
  const blue = await prisma.product_variant.upsert({
    where: { sku: 'DRL-BLUE' },
    create: {
      productId: drill.id,
      sku: 'DRL-BLUE',
      option_signature: optionSignature('رنگ', 'آبی'),
      price: 2_400_000,
      weightGrams: 1500,
      image: drillImage,
      is_active: true,
      optionValues: { create: { optionValueId: blueValue.id } },
    },
    update: { is_active: true, price: 2_400_000 },
  })

  const tape = await prisma.product.upsert({
    where: { slug: 'tape-measure' },
    create: {
      title: 'متر ۵ متری استنلی',
      slug: 'tape-measure',
      description: 'متر فلزی ۵ متری.',
      short_description: '۵ متر',
      publish: true,
      weightGrams: 250,
      categoryId: input.handId,
      brandId: input.stanleyId,
      images: { create: [{ url: tapeImage, thumbnail: true, position: 0 }] },
    },
    update: { publish: true, categoryId: input.handId, brandId: input.stanleyId },
  })

  const tapeVariant = await prisma.product_variant.upsert({
    where: { sku: 'TAPE-5M' },
    create: {
      productId: tape.id,
      sku: 'TAPE-5M',
      option_signature: '',
      price: 180_000,
      is_active: true,
    },
    update: { is_active: true, price: 180_000 },
  })

  await prisma.product.upsert({
    where: { slug: 'draft-wrench' },
    create: {
      title: 'آچار فرانسه (پیش‌نویس)',
      slug: 'draft-wrench',
      publish: false,
      weightGrams: 400,
      categoryId: input.handId,
      variants: {
        create: {
          sku: 'WRN-DRAFT',
          option_signature: '',
          price: 320_000,
          is_active: false,
        },
      },
    },
    update: { publish: false },
  })

  await prisma.inventory_level.upsert({
    where: { variantId_locationId: { variantId: red.id, locationId: input.warehouseId } },
    create: { variantId: red.id, locationId: input.warehouseId, on_hand: 25, reserved: 0 },
    update: {},
  })
  await prisma.inventory_level.upsert({
    where: { variantId_locationId: { variantId: blue.id, locationId: input.warehouseId } },
    create: { variantId: blue.id, locationId: input.warehouseId, on_hand: 18, reserved: 0 },
    update: {},
  })
  await prisma.inventory_level.upsert({
    where: { variantId_locationId: { variantId: tapeVariant.id, locationId: input.warehouseId } },
    create: { variantId: tapeVariant.id, locationId: input.warehouseId, on_hand: 40, reserved: 0 },
    update: {},
  })

  console.log('Seeded products, variants and stock')
  return {
    drillId: drill.id,
    tapeId: tape.id,
    redVariantId: red.id,
    blueVariantId: blue.id,
    tapeVariantId: tapeVariant.id,
  }
}

async function seedAddress(userId: number): Promise<{
  id: number
  title: string
  hood: string
  postalCode: string
  pelak: string
  vahed: string | null
  details: string
  province: { id: number; name: string; slug: string; tel_prefix: string }
  city: { id: number; name: string; slug: string; province_id: number }
}> {
  const province = await prisma.province.findFirst({ where: { slug: 'tehran' } })
  const city = await prisma.city.findFirst({ where: { slug: 'tehran-1' } })
  if (!province || !city) {
    throw new Error('Location fixtures missing; seed locations first.')
  }

  const existing = await prisma.user_address.findFirst({ where: { userId, title: 'خانه' } })
  const address =
    existing ??
    (await prisma.user_address.create({
      data: {
        title: 'خانه',
        userId,
        province_id: province.id,
        city_id: city.id,
        hood: 'سعادت آباد',
        postalCode: '1998745632',
        pelak: '24',
        vahed: '3',
        details: 'خیابان نهم، پلاک ۲۴، واحد ۳',
        ownReceiver: true,
        lat: 35.759,
        long: 51.401,
      },
    }))

  console.log('Seeded customer address')
  return {
    id: address.id,
    title: address.title,
    hood: address.hood,
    postalCode: address.postalCode,
    pelak: address.pelak,
    vahed: address.vahed,
    details: address.details,
    province,
    city,
  }
}

async function seedFavorites(userId: number, productIds: number[]): Promise<void> {
  await prisma.user_favorite.createMany({
    data: productIds.map((productId) => ({ userId, productId })),
    skipDuplicates: true,
  })
  console.log('Seeded favorites')
}

async function seedBasket(userId: number, variantId: number): Promise<void> {
  const basket = await prisma.basket.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
  await prisma.basket_item.upsert({
    where: { basketId_variantId: { basketId: basket.id, variantId } },
    create: { basketId: basket.id, variantId, quantity: 1 },
    update: {},
  })
  console.log('Seeded open basket')
}

async function seedOrders(input: {
  userId: number
  warehouseId: number
  address: Awaited<ReturnType<typeof seedAddress>>
  drillId: number
  tapeId: number
  redVariantId: number
  blueVariantId: number
  tapeVariantId: number
}): Promise<void> {
  if ((await prisma.order.count({ where: { number: { startsWith: 'ORD-SEED-' } } })) > 0) {
    console.log('Demo orders already present; skipping.')
    return
  }

  const snapshot = addressSnapshot(input.address)
  const redSnap = productSnapshot({
    productId: input.drillId,
    variantId: input.redVariantId,
    title: 'دریل شارژی بوش',
    slug: 'drill-bosch',
    sku: 'DRL-RED',
    options: [{ option: 'رنگ', value: 'قرمز' }],
    image: 'https://cdn.method-commerce.ir/products/drill-1.jpg',
  })
  const tapeSnap = productSnapshot({
    productId: input.tapeId,
    variantId: input.tapeVariantId,
    title: 'متر ۵ متری استنلی',
    slug: 'tape-measure',
    sku: 'TAPE-5M',
    options: [],
    image: 'https://cdn.method-commerce.ir/products/tape-1.jpg',
  })
  const blueSnap = productSnapshot({
    productId: input.drillId,
    variantId: input.blueVariantId,
    title: 'دریل شارژی بوش',
    slug: 'drill-bosch',
    sku: 'DRL-BLUE',
    options: [{ option: 'رنگ', value: 'آبی' }],
    image: 'https://cdn.method-commerce.ir/products/drill-1.jpg',
  })

  await prisma.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        number: 'ORD-SEED-COD',
        userId: input.userId,
        status: OrderStatus.PENDING,
        reservationStatus: OrderReservationStatus.RESERVED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        itemCount: 1,
        subtotal: 2_100_000,
        addressSnapshot: snapshot,
        note: 'لطفا عصر تحویل دهید',
        stockAllocations: [
          { variantId: input.redVariantId, locationId: input.warehouseId, quantity: 1 },
        ],
        items: {
          create: {
            variantId: input.redVariantId,
            quantity: 1,
            unitPrice: 2_100_000,
            lineTotal: 2_100_000,
            productSnapshot: redSnap,
          },
        },
      },
    })
    await tx.inventory_level.update({
      where: {
        variantId_locationId: { variantId: input.redVariantId, locationId: input.warehouseId },
      },
      data: { reserved: { increment: 1 } },
    })

    await tx.order.create({
      data: {
        number: 'ORD-SEED-PAID',
        userId: input.userId,
        status: OrderStatus.PAID,
        reservationStatus: OrderReservationStatus.CONSUMED,
        paymentMethod: PaymentMethod.ONLINE,
        itemCount: 2,
        subtotal: 360_000,
        addressSnapshot: snapshot,
        paidAt: new Date(),
        stockAllocations: [
          { variantId: input.tapeVariantId, locationId: input.warehouseId, quantity: 2 },
        ],
        items: {
          create: {
            variantId: input.tapeVariantId,
            quantity: 2,
            unitPrice: 180_000,
            lineTotal: 360_000,
            productSnapshot: tapeSnap,
          },
        },
        payments: {
          create: [
            {
              idempotencyKey: 'seed-pay-failed',
              gatewayRef: 'seed-zibal-fail',
              amount: 360_000,
              status: PaymentStatus.FAILED,
              failureReason: 'customer_cancelled',
            },
            {
              idempotencyKey: 'seed-pay-ok',
              gatewayRef: 'seed-zibal-ok',
              amount: 360_000,
              status: PaymentStatus.SUCCEEDED,
              redirectUrl: 'https://gateway.zibal.ir/start/seed',
            },
          ],
        },
      },
    })
    await tx.inventory_level.update({
      where: {
        variantId_locationId: { variantId: input.tapeVariantId, locationId: input.warehouseId },
      },
      data: { on_hand: { decrement: 2 } },
    })

    await tx.order.create({
      data: {
        number: 'ORD-SEED-ONLINE',
        userId: input.userId,
        status: OrderStatus.PENDING,
        reservationStatus: OrderReservationStatus.RESERVED,
        paymentMethod: PaymentMethod.ONLINE,
        itemCount: 1,
        subtotal: 2_400_000,
        addressSnapshot: snapshot,
        stockAllocations: [
          { variantId: input.blueVariantId, locationId: input.warehouseId, quantity: 1 },
        ],
        items: {
          create: {
            variantId: input.blueVariantId,
            quantity: 1,
            unitPrice: 2_400_000,
            lineTotal: 2_400_000,
            productSnapshot: blueSnap,
          },
        },
        payments: {
          create: {
            idempotencyKey: 'seed-pay-pending',
            gatewayRef: 'seed-zibal-pending',
            amount: 2_400_000,
            status: PaymentStatus.INITIATED,
            redirectUrl: 'https://gateway.zibal.ir/start/seed-pending',
          },
        },
      },
    })
    await tx.inventory_level.update({
      where: {
        variantId_locationId: { variantId: input.blueVariantId, locationId: input.warehouseId },
      },
      data: { reserved: { increment: 1 } },
    })

    await tx.order.create({
      data: {
        number: 'ORD-SEED-CANCELLED',
        userId: input.userId,
        status: OrderStatus.CANCELLED,
        reservationStatus: OrderReservationStatus.RELEASED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        itemCount: 1,
        subtotal: 180_000,
        addressSnapshot: snapshot,
        cancelledAt: new Date(),
        stockAllocations: [
          { variantId: input.tapeVariantId, locationId: input.warehouseId, quantity: 1 },
        ],
        items: {
          create: {
            variantId: input.tapeVariantId,
            quantity: 1,
            unitPrice: 180_000,
            lineTotal: 180_000,
            productSnapshot: tapeSnap,
          },
        },
      },
    })

    await tx.order.create({
      data: {
        number: 'ORD-SEED-DONE',
        userId: input.userId,
        status: OrderStatus.COMPLETED,
        reservationStatus: OrderReservationStatus.CONSUMED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        itemCount: 1,
        subtotal: 2_100_000,
        addressSnapshot: snapshot,
        paidAt: new Date(Date.now() - 86_400_000),
        completedAt: new Date(),
        stockAllocations: [
          { variantId: input.redVariantId, locationId: input.warehouseId, quantity: 1 },
        ],
        items: {
          create: {
            variantId: input.redVariantId,
            quantity: 1,
            unitPrice: 2_100_000,
            lineTotal: 2_100_000,
            productSnapshot: redSnap,
          },
        },
      },
    })
    await tx.inventory_level.update({
      where: {
        variantId_locationId: { variantId: input.redVariantId, locationId: input.warehouseId },
      },
      data: { on_hand: { decrement: 1 } },
    })
  })

  console.log('Seeded demo orders and payments')
}

async function seedComments(input: {
  userId: number
  adminId: number
  productId: number
}): Promise<void> {
  if ((await prisma.comment.count({ where: { productId: input.productId } })) > 0) {
    console.log('Demo comments already present; skipping.')
    return
  }

  const published = await prisma.comment.create({
    data: {
      title: 'کیفیت عالی',
      content: 'ابزار خوبی است، پیشنهاد می‌کنم.',
      rate: 5,
      published: true,
      productId: input.productId,
      userId: input.userId,
      images: {
        create: {
          url: 'https://cdn.method-commerce.ir/comments/sample.jpg',
          position: 0,
        },
      },
    },
  })

  await prisma.comment.create({
    data: {
      content: 'با سپاس از بازخورد شما',
      published: true,
      productId: input.productId,
      adminId: input.adminId,
      parentId: published.id,
    },
  })

  await prisma.comment.create({
    data: {
      title: 'در انتظار تایید',
      content: 'بسته‌بندی می‌توانست بهتر باشد.',
      rate: 3,
      published: false,
      productId: input.productId,
      userId: input.userId,
    },
  })

  console.log('Seeded comments')
}

async function seedNotifications(input: { userId: number; adminId: number }): Promise<void> {
  if ((await prisma.notification.count()) > 0) {
    console.log('Notifications already present; skipping.')
    return
  }

  await prisma.notification.createMany({
    data: [
      {
        audience: NotificationAudience.USER,
        recipientId: input.userId,
        userId: input.userId,
        context: 'ordering',
        type: 'order.created',
        title: 'سفارش ثبت شد',
        body: 'سفارش ORD-SEED-COD با موفقیت ثبت شد.',
        data: { orderNumber: 'ORD-SEED-COD' },
      },
      {
        audience: NotificationAudience.USER,
        recipientId: input.userId,
        userId: input.userId,
        context: 'ordering',
        type: 'order.paid',
        title: 'پرداخت موفق',
        body: 'سفارش ORD-SEED-PAID پرداخت شد.',
        data: { orderNumber: 'ORD-SEED-PAID' },
        readAt: new Date(),
      },
      {
        audience: NotificationAudience.ADMIN,
        recipientId: input.adminId,
        adminId: input.adminId,
        context: 'ordering',
        type: 'order.created',
        title: 'سفارش جدید',
        body: 'مشتری سفارش ORD-SEED-COD را ثبت کرد.',
        data: { orderNumber: 'ORD-SEED-COD' },
      },
      {
        audience: NotificationAudience.ADMIN,
        recipientId: input.adminId,
        adminId: input.adminId,
        context: 'system',
        type: 'seed.ready',
        title: 'دیتای نمونه آماده است',
        body: 'seeder دمو برای کاتالوگ، سبد و سفارش‌ها اجرا شد.',
      },
    ],
  })

  console.log('Seeded notifications')
}

async function main(): Promise<void> {
  const superAdmin = await seedSuperAdmin()
  await seedOperatorAdmin()
  await seedLocations()
  const warehouse = await seedInventoryLocation()
  const customer = await seedCustomer()
  const categories = await seedCategories()
  const brands = await seedBrands()
  const catalog = await seedProducts({
    drillsId: categories.drillsId,
    handId: categories.handId,
    boschId: brands.boschId,
    stanleyId: brands.stanleyId,
    warehouseId: warehouse.id,
  })
  const address = await seedAddress(customer.id)
  await seedFavorites(customer.id, [catalog.drillId, catalog.tapeId])
  await seedBasket(customer.id, catalog.tapeVariantId)
  await seedOrders({
    userId: customer.id,
    warehouseId: warehouse.id,
    address,
    drillId: catalog.drillId,
    tapeId: catalog.tapeId,
    redVariantId: catalog.redVariantId,
    blueVariantId: catalog.blueVariantId,
    tapeVariantId: catalog.tapeVariantId,
  })
  await seedComments({
    userId: customer.id,
    adminId: superAdmin.id,
    productId: catalog.drillId,
  })
  await seedNotifications({ userId: customer.id, adminId: superAdmin.id })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
