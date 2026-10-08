/**
 * Demo catalogue on top of the base seed: about thirty products across
 * electronics, fashion, home and books, with variants, stock (a few sold out),
 * images, customers, reviews, two months of orders and two promotions, so the
 * storefront, search facets, recommendations and the dashboard have something
 * to show. Deterministic and safe to re-run.
 *
 *   npm run seed && npm run seed:demo
 */
import { OrderReservationStatus, OrderStatus, PaymentMethod, PrismaClient, PromotionKind } from '@prisma/client'

const prisma = new PrismaClient()

/** Small seeded PRNG so every run produces the same data. */
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}
const rand = random(20261010)
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)]

const image = (slug: string, n: number) => `https://picsum.photos/seed/${encodeURIComponent(`${slug}-${n}`)}/800/800`

type CategorySpec = { slug: string; title: string; description: string; children: { slug: string; title: string }[] }

const CATEGORIES: CategorySpec[] = [
  {
    slug: 'digital',
    title: 'کالای دیجیتال',
    description: 'موبایل، لپ‌تاپ و صوتی',
    children: [
      { slug: 'mobile', title: 'گوشی موبایل' },
      { slug: 'laptop', title: 'لپ‌تاپ' },
      { slug: 'headphones', title: 'هدفون و هندزفری' },
    ],
  },
  {
    slug: 'fashion',
    title: 'مد و پوشاک',
    description: 'کفش و لباس',
    children: [
      { slug: 'shoes', title: 'کفش' },
      { slug: 'tshirts', title: 'تی‌شرت' },
    ],
  },
  {
    slug: 'home-kitchen',
    title: 'خانه و آشپزخانه',
    description: 'لوازم آشپزخانه و دکوراسیون',
    children: [
      { slug: 'kitchen', title: 'لوازم آشپزخانه' },
      { slug: 'decor', title: 'دکوراسیون' },
    ],
  },
  { slug: 'books', title: 'کتاب', description: 'رمان و کتاب‌های عمومی', children: [] },
]

const BRANDS: Record<string, string> = {
  samsung: 'سامسونگ',
  apple: 'اپل',
  xiaomi: 'شیائومی',
  asus: 'ایسوس',
  lenovo: 'لنوو',
  sony: 'سونی',
  nike: 'نایکی',
  adidas: 'آدیداس',
  philips: 'فیلیپس',
  'pars-khazar': 'پارس خزر',
  cheshmeh: 'نشر چشمه',
}

type ProductSpec = {
  slug: string
  title: string
  sub?: string
  category: string
  brand: string
  /** Toman. */
  price: number
  options?: Record<string, string[]>
  /** Percent off on the first variant. */
  sale?: number
  /** Variant indexes with no stock. */
  soldOut?: number[]
  description: string
}

const PRODUCTS: ProductSpec[] = [
  { slug: 'galaxy-a55', title: 'گوشی سامسونگ گلکسی A55', sub: '۲۵۶ گیگابایت', category: 'mobile', brand: 'samsung', price: 21_900_000, options: { رنگ: ['مشکی', 'آبی', 'بنفش'], حافظه: ['128', '256'] }, sale: 8, soldOut: [3], description: 'صفحه‌نمایش ۶٫۶ اینچی سوپر امولد، دوربین ۵۰ مگاپیکسلی و باتری ۵۰۰۰ میلی‌آمپر.' },
  { slug: 'galaxy-s24', title: 'گوشی سامسونگ گلکسی S24', sub: 'پرچمدار', category: 'mobile', brand: 'samsung', price: 52_500_000, options: { رنگ: ['مشکی', 'کرم'], حافظه: ['256', '512'] }, description: 'پردازنده قدرتمند، دوربین سه‌گانه و بدنه آلومینیومی.' },
  { slug: 'iphone-15', title: 'گوشی اپل آیفون ۱۵', category: 'mobile', brand: 'apple', price: 68_000_000, options: { رنگ: ['مشکی', 'صورتی', 'آبی'], حافظه: ['128', '256'] }, soldOut: [1, 4], description: 'تراشه A16 بایونیک، داینامیک آیلند و دوربین ۴۸ مگاپیکسلی.' },
  { slug: 'redmi-note-13', title: 'گوشی شیائومی ردمی نوت ۱۳', category: 'mobile', brand: 'xiaomi', price: 12_400_000, options: { رنگ: ['مشکی', 'سبز', 'آبی'] }, sale: 12, description: 'نمایشگر ۱۲۰ هرتز و شارژ سریع ۳۳ واتی.' },
  { slug: 'poco-x6', title: 'گوشی شیائومی پوکو X6', category: 'mobile', brand: 'xiaomi', price: 16_800_000, options: { حافظه: ['256', '512'] }, description: 'عملکرد بالا برای بازی با قیمت مناسب.' },
  { slug: 'vivobook-15', title: 'لپ‌تاپ ایسوس ویووبوک ۱۵', sub: 'Core i5', category: 'laptop', brand: 'asus', price: 38_500_000, options: { رم: ['8', '16'] }, description: 'لپ‌تاپ سبک برای کار و دانشگاه با نمایشگر ۱۵٫۶ اینچی.' },
  { slug: 'zenbook-14', title: 'لپ‌تاپ ایسوس ذن‌بوک ۱۴', sub: 'OLED', category: 'laptop', brand: 'asus', price: 64_000_000, options: { رم: ['16', '32'] }, sale: 5, description: 'نمایشگر OLED و بدنه فلزی بسیار باریک.' },
  { slug: 'ideapad-slim-3', title: 'لپ‌تاپ لنوو آیدیاپد اسلیم ۳', category: 'laptop', brand: 'lenovo', price: 29_900_000, options: { رم: ['8', '16'] }, soldOut: [0], description: 'انتخابی اقتصادی برای کارهای روزمره.' },
  { slug: 'macbook-air-m3', title: 'لپ‌تاپ اپل مک‌بوک ایر M3', category: 'laptop', brand: 'apple', price: 89_000_000, options: { رنگ: ['نقره‌ای', 'خاکستری'] }, description: 'تراشه M3، باتری تمام‌روز و بدون فن.' },
  { slug: 'wh-1000xm5', title: 'هدفون سونی WH-1000XM5', sub: 'نویز کنسلینگ', category: 'headphones', brand: 'sony', price: 24_500_000, options: { رنگ: ['مشکی', 'نقره‌ای'] }, sale: 10, description: 'بهترین حذف نویز فعال در کلاس خود.' },
  { slug: 'airpods-pro-2', title: 'هندزفری اپل ایرپاد پرو ۲', category: 'headphones', brand: 'apple', price: 15_900_000, description: 'حذف نویز فعال و صدای فضایی.' },
  { slug: 'redmi-buds-5', title: 'هندزفری شیائومی ردمی بادز ۵', category: 'headphones', brand: 'xiaomi', price: 2_400_000, options: { رنگ: ['مشکی', 'سفید'] }, description: 'هندزفری بی‌سیم اقتصادی با باتری طولانی.' },
  { slug: 'galaxy-buds-fe', title: 'هندزفری سامسونگ گلکسی بادز FE', category: 'headphones', brand: 'samsung', price: 4_900_000, options: { رنگ: ['گرافیت', 'سفید'] }, soldOut: [1], description: 'طراحی راحت و صدای پرقدرت.' },
  { slug: 'air-max-90', title: 'کفش ورزشی نایکی ایر مکس ۹۰', category: 'shoes', brand: 'nike', price: 6_900_000, options: { سایز: ['40', '41', '42', '43', '44'], رنگ: ['سفید', 'مشکی'] }, sale: 15, soldOut: [2, 7], description: 'کلاسیک همیشگی با زیره ایر.' },
  { slug: 'pegasus-40', title: 'کفش دویدن نایکی پگاسوس ۴۰', category: 'shoes', brand: 'nike', price: 7_400_000, options: { سایز: ['41', '42', '43', '44'] }, description: 'کفش دویدن روزانه با بالشتک نرم.' },
  { slug: 'ultraboost-light', title: 'کفش آدیداس اولترابوست لایت', category: 'shoes', brand: 'adidas', price: 8_200_000, options: { سایز: ['40', '41', '42', '43'], رنگ: ['مشکی', 'آبی'] }, description: 'سبک‌ترین اولترابوست با فوم بوست.' },
  { slug: 'samba-og', title: 'کفش آدیداس سامبا OG', category: 'shoes', brand: 'adidas', price: 5_600_000, options: { سایز: ['39', '40', '41', '42', '43'] }, sale: 10, description: 'طراحی کلاسیک فوتبال سالنی.' },
  { slug: 'nike-dri-fit-tee', title: 'تی‌شرت ورزشی نایکی درای‌فیت', category: 'tshirts', brand: 'nike', price: 1_450_000, options: { سایز: ['S', 'M', 'L', 'XL'], رنگ: ['مشکی', 'سفید', 'سرمه‌ای'] }, description: 'پارچه خنک و سریع‌خشک.' },
  { slug: 'adidas-essentials-tee', title: 'تی‌شرت آدیداس اسنشیال', category: 'tshirts', brand: 'adidas', price: 1_250_000, options: { سایز: ['S', 'M', 'L', 'XL'], رنگ: ['طوسی', 'مشکی'] }, soldOut: [0], description: 'تی‌شرت نخی روزمره.' },
  { slug: 'philips-airfryer-xl', title: 'سرخ‌کن بدون روغن فیلیپس XL', category: 'kitchen', brand: 'philips', price: 14_900_000, sale: 7, description: 'ظرفیت ۶٫۲ لیتر برای کل خانواده.' },
  { slug: 'philips-blender-5000', title: 'مخلوط‌کن فیلیپس سری ۵۰۰۰', category: 'kitchen', brand: 'philips', price: 6_300_000, description: 'موتور ۱۲۰۰ واتی و تیغه‌های استیل.' },
  { slug: 'pars-khazar-rice-cooker', title: 'پلوپز پارس خزر ۱۰ نفره', category: 'kitchen', brand: 'pars-khazar', price: 3_900_000, options: { رنگ: ['مشکی', 'سفید'] }, description: 'ته‌دیگ طلایی با کنترل دیجیتال.' },
  { slug: 'pars-khazar-kettle', title: 'کتری برقی پارس خزر', category: 'kitchen', brand: 'pars-khazar', price: 1_650_000, description: 'بدنه استیل و قطع خودکار.' },
  { slug: 'xiaomi-smart-lamp', title: 'چراغ رومیزی هوشمند شیائومی', category: 'decor', brand: 'xiaomi', price: 2_200_000, description: 'نور قابل تنظیم با اپلیکیشن.' },
  { slug: 'philips-hue-bulb', title: 'لامپ هوشمند فیلیپس هیو', category: 'decor', brand: 'philips', price: 2_900_000, options: { نور: ['سفید', 'رنگی'] }, soldOut: [1], description: 'میلیون‌ها رنگ با کنترل صوتی.' },
  { slug: 'kelidar', title: 'کتاب کلیدر', sub: 'محمود دولت‌آبادی', category: 'books', brand: 'cheshmeh', price: 1_950_000, description: 'رمان ده‌جلدی ماندگار ادبیات فارسی.' },
  { slug: 'savushun', title: 'کتاب سووشون', sub: 'سیمین دانشور', category: 'books', brand: 'cheshmeh', price: 420_000, sale: 10, description: 'نخستین رمان یک زن ایرانی.' },
  { slug: 'boof-e-koor', title: 'کتاب بوف کور', sub: 'صادق هدایت', category: 'books', brand: 'cheshmeh', price: 280_000, description: 'شاهکار داستان مدرن فارسی.' },
  { slug: 'shazdeh-ehtejab', title: 'کتاب شازده احتجاب', sub: 'هوشنگ گلشیری', category: 'books', brand: 'cheshmeh', price: 350_000, description: 'رمانی کوتاه و درخشان.' },
]

const CUSTOMERS: { phone: string; first: string; last: string }[] = [
  { phone: '09120000001', first: 'مریم', last: 'احمدی' },
  { phone: '09120000002', first: 'علی', last: 'رضایی' },
  { phone: '09120000003', first: 'سارا', last: 'محمدی' },
  { phone: '09120000004', first: 'رضا', last: 'کریمی' },
  { phone: '09120000005', first: 'نگار', last: 'حسینی' },
  { phone: '09120000006', first: 'امیر', last: 'جعفری' },
]

const REVIEWS: [number, string][] = [
  [5, 'خیلی راضی هستم، دقیقاً مطابق توضیحات بود.'],
  [5, 'کیفیت عالی و ارسال سریع.'],
  [4, 'در کل خوب است ولی بسته‌بندی می‌توانست بهتر باشد.'],
  [4, 'به نسبت قیمت ارزش خرید دارد.'],
  [3, 'معمولی است، انتظار بیشتری داشتم.'],
  [5, 'دومین بار است که می‌خرم، پیشنهاد می‌کنم.'],
  [2, 'بعد از یک ماه کمی مشکل پیدا کرد.'],
]

/** Every combination of option values, in a stable order. */
function combinations(options: Record<string, string[]>): { option: string; value: string }[][] {
  return Object.entries(options).reduce<{ option: string; value: string }[][]>(
    (rows, [option, values]) => rows.flatMap((row) => values.map((value) => [...row, { option, value }])),
    [[]]
  )
}

const signature = (pairs: { option: string; value: string }[]) =>
  pairs
    .map(({ option, value }) => `${option.toLowerCase()}:${value.toLowerCase()}`)
    .sort()
    .join('|')

async function seedCategories(): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const [position, spec] of CATEGORIES.entries()) {
    const root = await prisma.category.upsert({
      where: { slug: spec.slug },
      create: { title: spec.title, slug: spec.slug, description: spec.description, path: '/', depth: 0, position: position + 10 },
      update: { title: spec.title },
    })
    ids.set(spec.slug, root.id)
    for (const [index, child] of spec.children.entries()) {
      const row = await prisma.category.upsert({
        where: { slug: child.slug },
        create: { title: child.title, slug: child.slug, parentId: root.id, path: `/${root.id}/`, depth: 1, position: index },
        update: { title: child.title, parentId: root.id, path: `/${root.id}/`, depth: 1 },
      })
      ids.set(child.slug, row.id)
    }
  }
  return ids
}

async function seedBrands(): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const [slug, title] of Object.entries(BRANDS)) {
    const brand = await prisma.brand.upsert({
      where: { slug },
      create: { slug, title, logo: image(`brand-${slug}`, 0) },
      update: { title },
    })
    ids.set(slug, brand.id)
  }
  return ids
}

type SeededVariant = { id: number; productId: number; title: string; slug: string; sku: string; price: number; options: { option: string; value: string }[]; image: string }

async function seedProducts(categories: Map<string, number>, brands: Map<string, number>, warehouseId: number) {
  const variants: SeededVariant[] = []
  for (const spec of PRODUCTS) {
    const images = [0, 1, 2].map((n) => image(spec.slug, n))
    const product = await prisma.product.upsert({
      where: { slug: spec.slug },
      create: {
        title: spec.title,
        sub_title: spec.sub ?? null,
        slug: spec.slug,
        description: spec.description,
        short_description: spec.sub ?? null,
        publish: true,
        weightGrams: spec.category === 'laptop' ? 2000 : spec.category === 'books' ? 400 : 700,
        categoryId: categories.get(spec.category)!,
        brandId: brands.get(spec.brand)!,
        images: { create: images.map((url, position) => ({ url, thumbnail: position === 0, position })) },
      },
      update: { publish: true },
      include: { variants: true },
    })

    const rows = combinations(spec.options ?? {})
    const valueIds = new Map<string, number>()
    for (const [position, [name, values]] of Object.entries(spec.options ?? {}).entries()) {
      const option = await prisma.product_option.upsert({
        where: { productId_name: { productId: product.id, name } },
        create: { productId: product.id, name, position },
        update: {},
      })
      for (const [index, value] of values.entries()) {
        const row = await prisma.product_option_value.upsert({
          where: { optionId_value: { optionId: option.id, value } },
          create: { optionId: option.id, value, position: index },
          update: {},
        })
        valueIds.set(`${name}:${value}`, row.id)
      }
    }

    for (const [index, pairs] of rows.entries()) {
      // Bigger memory / RAM costs more; other options do not change the price.
      const step = pairs.reduce((sum, { option, value }) => {
        const values = spec.options![option]
        return ['حافظه', 'رم'].includes(option) ? sum + values.indexOf(value) * 0.18 : sum
      }, 0)
      const price = Math.round((spec.price * (1 + step)) / 10_000) * 10_000 * 10
      const salePrice = spec.sale && index === 0 ? Math.round((price * (100 - spec.sale)) / 100 / 10_000) * 10_000 : null
      const sku = `${spec.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-${index + 1}`
      const variant = await prisma.product_variant.upsert({
        where: { sku },
        create: {
          productId: product.id,
          sku,
          option_signature: signature(pairs),
          price,
          sale_price: salePrice,
          image: images[index % images.length],
          is_active: true,
          low_stock_threshold: 3,
          optionValues: { create: pairs.map((pair) => ({ optionValueId: valueIds.get(`${pair.option}:${pair.value}`)! })) },
        },
        update: { is_active: true },
      })
      const onHand = spec.soldOut?.includes(index) ? 0 : 2 + Math.floor(rand() * 25)
      await prisma.inventory_level.upsert({
        where: { variantId_locationId: { variantId: variant.id, locationId: warehouseId } },
        create: { variantId: variant.id, locationId: warehouseId, on_hand: onHand, reserved: 0 },
        update: {},
      })
      variants.push({ id: variant.id, productId: product.id, title: spec.title, slug: spec.slug, sku, price: salePrice ?? price, options: pairs, image: images[0] })
    }
  }
  console.log(`Seeded ${PRODUCTS.length} demo products with ${variants.length} variants`)
  return variants
}

async function seedCustomers(): Promise<number[]> {
  const ids: number[] = []
  for (const customer of CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { phone_number: customer.phone },
      create: {
        phone_number: customer.phone,
        account_status: true,
        profile: { create: { first_name: customer.first, last_name: customer.last } },
      },
      update: {},
    })
    ids.push(user.id)
  }
  return ids
}

async function seedReviews(customerIds: number[], variants: SeededVariant[]) {
  const productIds = [...new Set(variants.map((variant) => variant.productId))]
  if ((await prisma.comment.count({ where: { productId: { in: productIds } } })) > 0) return
  for (const productId of productIds) {
    const count = Math.floor(rand() * 5)
    for (let i = 0; i < count; i++) {
      const [rate, content] = pick(REVIEWS)
      await prisma.comment.create({
        data: { productId, userId: customerIds[(productId + i) % customerIds.length], rate, content, published: true },
      })
    }
  }
  console.log('Seeded demo reviews')
}

/** Paid orders over the last 60 days, so reports, best sellers and "bought together" have data. */
async function seedOrders(customerIds: number[], variants: SeededVariant[]) {
  if ((await prisma.order.count({ where: { number: { startsWith: 'ORD-DEMO-' } } })) > 0) return
  const byProduct = new Map<number, SeededVariant[]>()
  for (const variant of variants) byProduct.set(variant.productId, [...(byProduct.get(variant.productId) ?? []), variant])
  const products = [...byProduct.keys()]
  // Pairs that sell together, for the recommendations.
  const companions: Record<string, string[]> = {
    'galaxy-a55': ['galaxy-buds-fe'],
    'iphone-15': ['airpods-pro-2'],
    'air-max-90': ['nike-dri-fit-tee'],
    'philips-airfryer-xl': ['philips-blender-5000'],
    kelidar: ['savushun', 'boof-e-koor'],
  }
  const address = { title: 'خانه', province: { name: 'تهران' }, city: { name: 'تهران' }, details: 'خیابان ولیعصر', postalCode: '1234567890' }
  const DAY = 24 * 60 * 60 * 1000
  const statuses = [OrderStatus.COMPLETED, OrderStatus.COMPLETED, OrderStatus.SHIPPED, OrderStatus.PROCESSING, OrderStatus.PAID]

  for (let n = 1; n <= 70; n++) {
    const first = pick(byProduct.get(pick(products))!)
    const lines = [first]
    for (const slug of companions[first.slug] ?? []) {
      if (rand() < 0.6) lines.push(pick(variants.filter((variant) => variant.slug === slug)))
    }
    if (rand() < 0.25) lines.push(pick(byProduct.get(pick(products))!))
    const items = [...new Map(lines.map((line) => [line.id, line])).values()].map((variant) => ({
      variant,
      quantity: rand() < 0.8 ? 1 : 2,
    }))
    const subtotal = items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0)
    const shippingFee = subtotal > 50_000_000 ? 0 : 500_000
    const taxTotal = Math.round(subtotal / 10)
    const placedAt = new Date(Date.now() - Math.floor(rand() * 60) * DAY - Math.floor(rand() * DAY))
    const status = pick(statuses)
    await prisma.order.create({
      data: {
        number: `ORD-DEMO-${String(n).padStart(4, '0')}`,
        userId: customerIds[n % customerIds.length],
        status,
        reservationStatus: OrderReservationStatus.CONSUMED,
        paymentMethod: rand() < 0.6 ? PaymentMethod.ONLINE : PaymentMethod.CASH_ON_DELIVERY,
        itemCount: items.length,
        subtotal,
        shippingFee,
        taxRateBp: 1000,
        taxTotal,
        total: subtotal + shippingFee + taxTotal,
        addressSnapshot: address,
        paidAt: placedAt,
        processingAt: status === OrderStatus.PAID ? null : placedAt,
        shippedAt: ([OrderStatus.SHIPPED, OrderStatus.COMPLETED] as OrderStatus[]).includes(status) ? placedAt : null,
        completedAt: status === OrderStatus.COMPLETED ? placedAt : null,
        created_at: placedAt,
        items: {
          create: items.map(({ variant, quantity }) => ({
            variantId: variant.id,
            quantity,
            unitPrice: variant.price,
            lineTotal: variant.price * quantity,
            taxAmount: Math.round((variant.price * quantity) / 10),
            productSnapshot: {
              productId: variant.productId,
              variantId: variant.id,
              title: variant.title,
              slug: variant.slug,
              sku: variant.sku,
              options: variant.options,
              image: variant.image,
              thumbnail: variant.image,
            },
          })),
        },
      },
    })
  }
  console.log('Seeded 70 demo orders')
}

async function seedPromotions(categories: Map<string, number>) {
  const now = new Date()
  const inMonths = (months: number) => new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000)
  await prisma.promotion.upsert({
    where: { code: 'WELCOME10' },
    create: {
      name: 'خوش‌آمد ۱۰٪',
      code: 'WELCOME10',
      kind: PromotionKind.PERCENT,
      value: 10,
      max_discount: 2_000_000,
      starts_at: now,
      ends_at: inMonths(6),
      per_customer_limit: 1,
    },
    update: {},
  })
  if (!(await prisma.promotion.findFirst({ where: { name: 'حراج پوشاک' } }))) {
    await prisma.promotion.create({
      data: {
        name: 'حراج پوشاک',
        kind: PromotionKind.PERCENT,
        value: 15,
        starts_at: now,
        ends_at: inMonths(1),
        category_ids: [categories.get('fashion')!],
      },
    })
  }
  console.log('Seeded demo promotions (coupon WELCOME10, fashion campaign)')
}

/** The base seed points at a CDN that does not exist; give its products real pictures. */
async function fixBaseImages() {
  const images = await prisma.product_image.findMany({ where: { url: { contains: 'cdn.method-commerce.ir' } } })
  for (const row of images) {
    await prisma.product_image.update({ where: { id: row.id }, data: { url: image(`base-${row.productId}`, row.position) } })
  }
  await prisma.product_variant.updateMany({
    where: { image: { contains: 'cdn.method-commerce.ir' } },
    data: { image: null },
  })
}

async function main() {
  const warehouse = await prisma.inventory_location.findFirst({ where: { is_active: true }, orderBy: { id: 'asc' } })
  if (!warehouse) throw new Error('Run the base seed first (npm run seed)')
  const categories = await seedCategories()
  const brands = await seedBrands()
  const variants = await seedProducts(categories, brands, warehouse.id)
  const customers = await seedCustomers()
  await seedReviews(customers, variants)
  await seedOrders(customers, variants)
  await seedPromotions(categories)
  await fixBaseImages()
  console.log('Demo data ready.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
