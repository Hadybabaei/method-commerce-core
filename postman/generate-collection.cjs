const fs = require('fs')
const path = require('path')

const COLLECTION_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

function url(pathTemplate, query = []) {
  const segments = ['{{apiPrefix}}', ...pathTemplate.split('/').filter(Boolean)]
  const queryItems = query.map((q) => {
    const item = {
      key: q.key,
      value: q.value,
      disabled: q.disabled ?? false,
    }
    if (q.description) item.description = q.description
    return item
  })
  const qs = queryItems
    .filter((q) => !q.disabled)
    .map((q) => `${q.key}=${q.value}`)
    .join('&')
  return {
    raw: `{{baseUrl}}/{{apiPrefix}}/${pathTemplate}${qs ? `?${qs}` : ''}`,
    host: ['{{baseUrl}}'],
    path: segments,
    query: queryItems,
  }
}

function jsonBody(obj) {
  const numericVars =
    'addressId|cityId|provinceId|productId|variantId|categoryId|brandId|commentId|customerUserId|orderId|notificationId'
  let raw = JSON.stringify(obj, null, 2)
  raw = raw.replace(new RegExp(`": "{{(${numericVars})}}"`, 'g'), '": {{$1}}')
  return {
    mode: 'raw',
    raw,
    options: { raw: { language: 'json' } },
  }
}

function formBody(fields) {
  return {
    mode: 'formdata',
    formdata: fields.map((f) => {
      const item = {
        key: f.key,
        type: f.type ?? 'text',
        disabled: f.disabled ?? false,
      }
      if (f.type === 'file') {
        item.src = f.src ?? []
      } else {
        item.value = f.value ?? ''
      }
      if (f.description) item.description = f.description
      return item
    }),
  }
}

function req(name, method, pathTemplate, opts = {}) {
  const headers = []
  if (opts.json) {
    headers.push({ key: 'Content-Type', value: 'application/json' })
  }
  if (opts.headers) {
    for (const h of opts.headers) headers.push(h)
  }
  const item = {
    name,
    request: {
      method,
      header: headers,
      url: url(pathTemplate, opts.query),
      description: opts.description ?? '',
    },
  }
  if (opts.json) item.request.body = jsonBody(opts.json)
  if (opts.form) item.request.body = formBody(opts.form)
  if (opts.auth === false) {
    item.request.auth = { type: 'noauth' }
  }
  if (opts.event) item.event = opts.event
  return item
}

function tests(lines) {
  return [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: lines,
      },
    },
  ]
}

const productListQuery = [
  { key: 'search', value: 'دریل', disabled: true },
  { key: 'title', value: 'دریل', disabled: true },
  { key: 'category_id', value: '{{categoryId}}', disabled: true },
  { key: 'category_slug', value: 'power-tools', disabled: true },
  { key: 'brand_id', value: '{{brandId}}', disabled: true },
  { key: 'brand_slug', value: 'bosch', disabled: true },
  { key: 'product_id', value: '{{productId}}', disabled: true },
  { key: 'price_min', value: '1000000', disabled: true },
  { key: 'price_max', value: '5000000', disabled: true },
  { key: 'quantity_min', value: '1', disabled: true },
  { key: 'sort', value: 'newest', disabled: true },
  { key: 'limit', value: '20' },
  { key: 'offset', value: '0' },
]

const orderListQuery = [
  { key: 'status', value: 'PENDING', disabled: true },
  { key: 'search', value: 'ORD-', disabled: true },
  { key: 'created_from', value: '2026-09-01T00:00:00.000Z', disabled: true },
  { key: 'created_to', value: '2026-09-30T23:59:59.000Z', disabled: true },
  { key: 'limit', value: '20' },
  { key: 'offset', value: '0' },
]

const notificationQuery = [
  { key: 'context', value: 'ordering', disabled: true },
  { key: 'unread_only', value: 'true', disabled: true },
  { key: 'limit', value: '20' },
  { key: 'offset', value: '0' },
]

const commentQuery = [
  { key: 'limit', value: '20' },
  { key: 'offset', value: '0' },
]

const collection = {
  info: {
    name: 'method-commerce API',
    description: [
      'Customer and back-office API for the method-commerce Nest service.',
      '',
      'Base URL is `{{baseUrl}}/{{apiPrefix}}` (default `http://localhost:4000/api`).',
      '',
      '**Customer flow:** Auth → OTP request (saves `otpCode` when exposed) → OTP verify (saves tokens) → catalog → address → basket → order → pay.',
      '',
      '**Admin flow:** Admin login (saves `adminAccessToken`, default seed `admin@method-commerce.local` / `admin1234`) → merchandize SKUs → confirm COD / complete orders.',
      '',
      'Customer and admin JWTs are not interchangeable. Enable extra query filters in each request as needed.',
    ].join('\n'),
    schema: COLLECTION_SCHEMA,
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'apiPrefix', value: 'api' },
    { key: 'phoneNumber', value: '09121234567' },
    { key: 'otpCode', value: '12345' },
    { key: 'customerAccessToken', value: '' },
    { key: 'customerRefreshToken', value: '' },
    { key: 'customerUserId', value: '1' },
    { key: 'adminEmail', value: 'admin@method-commerce.local' },
    { key: 'adminPassword', value: 'admin1234' },
    { key: 'adminAccessToken', value: '' },
    { key: 'adminResetToken', value: '' },
    { key: 'provinceId', value: '1' },
    { key: 'cityId', value: '1' },
    { key: 'addressId', value: '1' },
    { key: 'categoryId', value: '1' },
    { key: 'categorySlug', value: 'power-tools' },
    { key: 'brandId', value: '1' },
    { key: 'brandSlug', value: 'bosch' },
    { key: 'productId', value: '1' },
    { key: 'productSlug', value: 'drill-bosch' },
    { key: 'variantId', value: '1' },
    { key: 'orderId', value: '1' },
    { key: 'paymentIdempotencyKey', value: 'checkout-attempt-1' },
    { key: 'paymentTrackId', value: '' },
    { key: 'commentId', value: '1' },
    { key: 'notificationId', value: '1' },
  ],
  item: [
    {
      name: 'Health',
      item: [
        req('Liveness', 'GET', 'health', {
          description: 'Checks process + database connectivity.',
          auth: false,
        }),
      ],
    },
    {
      name: 'Auth (customer)',
      item: [
        req('Request OTP', 'POST', 'auth/otp/request', {
          auth: false,
          json: { phone_number: '{{phoneNumber}}' },
          description: 'Signs up unknown numbers. Limited to 3/min. Saves otpCode when OTP_EXPOSE_IN_RESPONSE is on.',
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.code) pm.collectionVariables.set("otpCode", String(body.code));',
          ]),
        }),
        req('Verify OTP', 'POST', 'auth/otp/verify', {
          auth: false,
          json: { phone_number: '{{phoneNumber}}', otp_code: '{{otpCode}}' },
          description: 'Returns customer access + refresh tokens.',
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.accessToken) pm.collectionVariables.set("customerAccessToken", body.accessToken);',
            'if (body.refreshToken) pm.collectionVariables.set("customerRefreshToken", body.refreshToken);',
            'if (body.user && body.user.id) pm.collectionVariables.set("customerUserId", String(body.user.id));',
          ]),
        }),
        req('Refresh access token', 'POST', 'auth/refresh', {
          auth: false,
          json: { refresh_token: '{{customerRefreshToken}}' },
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.accessToken) pm.collectionVariables.set("customerAccessToken", body.accessToken);',
          ]),
        }),
        req('Logout', 'POST', 'auth/logout', {
          description: 'Revokes the stored refresh token. Requires customer bearer.',
        }),
      ],
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
    },
    {
      name: 'Users',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('Get me', 'GET', 'users/me'),
        req('Update me', 'PATCH', 'users/me', {
          json: {
            first_name: 'هادی',
            last_name: 'رضایی',
            email: 'user@example.com',
            national_id: '0012345678',
            birth_date: '1990-05-21',
          },
        }),
      ],
    },
    {
      name: 'Locations',
      item: [
        req('List provinces', 'GET', 'locations/provinces', {
          auth: false,
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'const items = Array.isArray(body) ? body : body.items;',
            'if (items && items[0] && items[0].id) pm.collectionVariables.set("provinceId", String(items[0].id));',
          ]),
        }),
        req('List cities in a province', 'GET', 'locations/provinces/{{provinceId}}/cities', {
          auth: false,
          description: 'Saves the first city id when present.',
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'const items = Array.isArray(body) ? body : body.items;',
            'if (items && items[0] && items[0].id) pm.collectionVariables.set("cityId", String(items[0].id));',
          ]),
        }),
      ],
    },
    {
      name: 'Addresses',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('List my addresses', 'GET', 'users/me/addresses'),
        req('Get one address', 'GET', 'users/me/addresses/{{addressId}}'),
        req('Create address', 'POST', 'users/me/addresses', {
          json: {
            title: 'خانه',
            city_id: '{{cityId}}',
            hood: 'سعادت آباد',
            postalCode: '1998745632',
            pelak: '24',
            vahed: '3',
            details: 'خیابان نهم، پلاک ۲۴، واحد ۳',
            ownReceiver: true,
            lat: 35.759,
            long: 51.401,
          },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("addressId", String(body.id));',
          ]),
        }),
        req('Update address', 'PATCH', 'users/me/addresses/{{addressId}}', {
          json: { title: 'منزل', details: 'واحد ۳، زنگ دوم' },
        }),
        req('Delete address', 'DELETE', 'users/me/addresses/{{addressId}}'),
      ],
    },
    {
      name: 'Catalog (storefront)',
      item: [
        req('List categories', 'GET', 'categories', { auth: false }),
        req('Get category by slug', 'GET', 'categories/{{categorySlug}}', { auth: false }),
        req('List brands', 'GET', 'brands', { auth: false }),
        req('Get brand by slug', 'GET', 'brands/{{brandSlug}}', { auth: false }),
        req('List published products', 'GET', 'products', {
          auth: false,
          query: productListQuery,
        }),
        req('Get product by slug', 'GET', 'products/{{productSlug}}', {
          auth: false,
          description: 'Percent-encode Persian slugs. Saves first variant id when present.',
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("productId", String(body.id));',
            'if (body.slug) pm.collectionVariables.set("productSlug", body.slug);',
            'if (body.variants && body.variants.length) pm.collectionVariables.set("variantId", String(body.variants[body.variants.length - 1].id));',
          ]),
        }),
        req('List published product comments', 'GET', 'products/{{productSlug}}/comments', {
          auth: false,
          query: commentQuery,
        }),
      ],
    },
    {
      name: 'Favorites',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('List favorites', 'GET', 'users/me/favorites'),
        req('Add favorite', 'POST', 'users/me/favorites', {
          json: { product_id: '{{productId}}' },
        }),
        req('Remove favorite', 'DELETE', 'users/me/favorites/{{productId}}'),
      ],
    },
    {
      name: 'Basket',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('Get basket', 'GET', 'users/me/basket'),
        req('Add item', 'POST', 'users/me/basket/items', {
          json: { variant_id: '{{variantId}}', quantity: 1 },
        }),
        req('Set item quantity', 'PATCH', 'users/me/basket/items/{{variantId}}', {
          json: { quantity: 2 },
          description: 'Quantity 0 removes the line.',
        }),
        req('Increase item', 'POST', 'users/me/basket/items/{{variantId}}/increase', {
          json: { by: 1 },
        }),
        req('Decrease item', 'POST', 'users/me/basket/items/{{variantId}}/decrease', {
          json: { by: 1 },
        }),
        req('Remove item', 'DELETE', 'users/me/basket/items/{{variantId}}'),
        req('Clear basket', 'DELETE', 'users/me/basket'),
      ],
    },
    {
      name: 'Orders (customer)',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('Place order (COD)', 'POST', 'orders', {
          json: {
            address_id: '{{addressId}}',
            payment_method: 'CASH_ON_DELIVERY',
            note: 'لطفا عصر تحویل دهید',
          },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("orderId", String(body.id));',
          ]),
        }),
        req('Place order (ONLINE)', 'POST', 'orders', {
          json: {
            address_id: '{{addressId}}',
            payment_method: 'ONLINE',
          },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("orderId", String(body.id));',
          ]),
        }),
        req('List my orders', 'GET', 'orders', { query: orderListQuery }),
        req('Get one order', 'GET', 'orders/{{orderId}}'),
        req('Cancel pending order', 'POST', 'orders/{{orderId}}/cancel'),
        req('Start online payment', 'POST', 'orders/{{orderId}}/payments', {
          description: 'Requires header Idempotency-Key. Same key returns the same intent.',
          headers: [{ key: 'Idempotency-Key', value: '{{paymentIdempotencyKey}}' }],
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.gatewayRef) pm.collectionVariables.set("paymentTrackId", String(body.gatewayRef));',
            'if (body.redirectUrl) console.log("Zibal redirect", body.redirectUrl);',
          ]),
        }),
      ],
    },
    {
      name: 'Payments',
      item: [
        req('Zibal callback', 'GET', 'payments/callback', {
          auth: false,
          description: 'Zibal redirects the browser here. The API verifies then 302s to the frontend.',
          query: [
            { key: 'trackId', value: '{{paymentTrackId}}' },
            { key: 'success', value: '1' },
            { key: 'status', value: '2' },
            { key: 'orderId', value: '{{paymentIdempotencyKey}}', disabled: true },
          ],
        }),
      ],
    },
    {
      name: 'Comments (customer)',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('List my comments', 'GET', 'users/me/comments', { query: commentQuery }),
        req('Post product comment (multipart)', 'POST', 'products/{{productId}}/comments', {
          description: 'Stays unpublished until an admin approves it. Attach images as form field `images`.',
          form: [
            { key: 'content', value: 'ابزار خوبی است، پیشنهاد می‌کنم.' },
            { key: 'title', value: 'کیفیت عالی' },
            { key: 'rate', value: '5' },
            { key: 'parent_id', value: '', disabled: true, description: 'Set to reply to a published root comment' },
            { key: 'images', type: 'file', src: [], description: 'Up to 5 images (JPEG, PNG, WebP, GIF)' },
          ],
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("commentId", String(body.id));',
          ]),
        }),
        req('Delete my comment', 'DELETE', 'users/me/comments/{{commentId}}'),
      ],
    },
    {
      name: 'Notifications (customer)',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{customerAccessToken}}', type: 'string' }],
      },
      item: [
        req('List my notifications', 'GET', 'users/me/notifications', {
          query: notificationQuery,
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.items && body.items[0]) pm.collectionVariables.set("notificationId", String(body.items[0].id));',
          ]),
        }),
        req('Mark all read', 'POST', 'users/me/notifications/read-all'),
        req('Mark one read', 'POST', 'users/me/notifications/{{notificationId}}/read'),
      ],
    },
    {
      name: 'Auth (admin)',
      item: [
        req('Login', 'POST', 'admin/auth/login', {
          auth: false,
          json: { email: '{{adminEmail}}', password: '{{adminPassword}}' },
          description: 'Seed default is admin@method-commerce.local / admin1234 unless SEED_ADMIN_* was set.',
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.accessToken) pm.collectionVariables.set("adminAccessToken", body.accessToken);',
          ]),
        }),
        req('Get me', 'GET', 'admin/auth/me'),
        req('Forgot password', 'POST', 'admin/auth/forgot-password', {
          auth: false,
          json: { email: '{{adminEmail}}' },
          description: 'Always 202. Token is emailed; paste it into adminResetToken.',
        }),
        req('Reset password', 'POST', 'admin/auth/reset-password', {
          auth: false,
          json: {
            email: '{{adminEmail}}',
            token: '{{adminResetToken}}',
            new_password: 'admin1234x',
          },
        }),
        req('Change password', 'POST', 'admin/auth/change-password', {
          json: { current_password: '{{adminPassword}}', new_password: 'admin1234x' },
        }),
      ],
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
    },
    {
      name: 'Admin accounts',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('Create admin (super admin only)', 'POST', 'admin/accounts', {
          json: {
            email: 'operator@example.com',
            password: 'secret1234',
            role: 'operator',
            first_name: 'Ali',
            last_name: 'Karimi',
            phone_number: '09121234567',
          },
        }),
      ],
    },
    {
      name: 'Admin catalog — categories',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('List category tree', 'GET', 'admin/categories'),
        req('Create category', 'POST', 'admin/categories', {
          json: {
            title: 'ابزار برقی',
            slug: 'power-tools',
            description: 'دریل و فرز',
            position: 0,
          },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("categoryId", String(body.id));',
            'if (body.slug) pm.collectionVariables.set("categorySlug", body.slug);',
          ]),
        }),
        req('Update category', 'PATCH', 'admin/categories/{{categoryId}}', {
          json: { description: 'به‌روز شد', position: 1 },
        }),
        req('Delete category', 'DELETE', 'admin/categories/{{categoryId}}'),
      ],
    },
    {
      name: 'Admin catalog — brands',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('List brands', 'GET', 'admin/brands'),
        req('Create brand', 'POST', 'admin/brands', {
          json: { title: 'بوش', slug: 'bosch', description: 'Bosch' },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("brandId", String(body.id));',
            'if (body.slug) pm.collectionVariables.set("brandSlug", body.slug);',
          ]),
        }),
        req('Update brand', 'PATCH', 'admin/brands/{{brandId}}', {
          json: { description: 'Robert Bosch' },
        }),
        req('Delete brand', 'DELETE', 'admin/brands/{{brandId}}'),
      ],
    },
    {
      name: 'Admin catalog — products',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('List products (incl. drafts)', 'GET', 'admin/products', { query: productListQuery }),
        req('Get product by id', 'GET', 'admin/products/{{productId}}'),
        req('Create product', 'POST', 'admin/products', {
          json: {
            title: 'دریل شارژی بوش',
            slug: 'drill-bosch',
            published: false,
            weight_grams: 1500,
            category_id: '{{categoryId}}',
            brand_id: '{{brandId}}',
            images: [{ url: 'https://cdn.method-commerce.ir/products/drill-1.jpg', thumbnail: true }],
          },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.id) pm.collectionVariables.set("productId", String(body.id));',
            'if (body.slug) pm.collectionVariables.set("productSlug", body.slug);',
          ]),
        }),
        req('Update product', 'PATCH', 'admin/products/{{productId}}', {
          json: { published: true, short_description: '۱۸ ولت' },
        }),
        req('Replace options (before first variant)', 'PUT', 'admin/products/{{productId}}/options', {
          json: { options: [{ name: 'رنگ', values: ['قرمز', 'آبی'] }] },
          description: 'Locked after the first variant exists. Send [] for a simple product, then add a default SKU.',
        }),
        req('Add default variant (no options)', 'POST', 'admin/products/{{productId}}/variants', {
          json: {
            sku: 'DRL-MAIN',
            price: 2400000,
            sale_price: 2100000,
            is_active: true,
            on_hand: 12,
            options: [],
          },
          event: tests([
            'if (![200, 201].includes(pm.response.code)) return;',
            'const body = pm.response.json();',
            'if (body.variants && body.variants.length) pm.collectionVariables.set("variantId", String(body.variants[body.variants.length - 1].id));',
          ]),
        }),
        req('Add option variant', 'POST', 'admin/products/{{productId}}/variants', {
          json: {
            sku: 'DRL-RED',
            price: 2400000,
            is_active: true,
            on_hand: 8,
            options: [{ option: 'رنگ', value: 'قرمز' }],
          },
        }),
        req('Update variant', 'PATCH', 'admin/products/{{productId}}/variants/{{variantId}}', {
          json: { price: 2500000, on_hand: 20, is_active: true },
        }),
        req('Delete variant', 'DELETE', 'admin/products/{{productId}}/variants/{{variantId}}'),
        req('Delete product', 'DELETE', 'admin/products/{{productId}}'),
      ],
    },
    {
      name: 'Admin comments',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('List pending comments', 'GET', 'admin/comments/pending', { query: commentQuery }),
        req('List comments for a product', 'GET', 'admin/products/{{productId}}/comments', {
          query: commentQuery,
        }),
        req('Post admin comment / reply', 'POST', 'admin/products/{{productId}}/comments', {
          description: 'Published immediately. Set parent_id to reply.',
          form: [
            { key: 'content', value: 'با سپاس از بازخورد شما' },
            { key: 'parent_id', value: '{{commentId}}' },
            { key: 'images', type: 'file', src: [] },
          ],
        }),
        req('Approve or hide comment', 'PATCH', 'admin/comments/{{commentId}}/approval', {
          json: { published: true },
        }),
        req('Delete comment', 'DELETE', 'admin/comments/{{commentId}}'),
      ],
    },
    {
      name: 'Admin orders',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('List all orders', 'GET', 'admin/orders', {
          query: [...orderListQuery, { key: 'user_id', value: '{{customerUserId}}', disabled: true }],
        }),
        req('Get one order', 'GET', 'admin/orders/{{orderId}}'),
        req('Cancel pending order', 'POST', 'admin/orders/{{orderId}}/cancel'),
        req('Confirm COD payment', 'POST', 'admin/orders/{{orderId}}/confirm-payment', {
          description: 'Marks COD orders PAID and consumes reserved stock.',
        }),
        req('Mark delivered', 'POST', 'admin/orders/{{orderId}}/complete'),
      ],
    },
    {
      name: 'Notifications (admin)',
      auth: {
        type: 'bearer',
        bearer: [{ key: 'token', value: '{{adminAccessToken}}', type: 'string' }],
      },
      item: [
        req('List admin notifications', 'GET', 'admin/notifications', {
          query: notificationQuery,
          event: tests([
            'if (pm.response.code !== 200) return;',
            'const body = pm.response.json();',
            'if (body.items && body.items[0]) pm.collectionVariables.set("notificationId", String(body.items[0].id));',
          ]),
        }),
        req('Mark all read', 'POST', 'admin/notifications/read-all'),
        req('Mark one read', 'POST', 'admin/notifications/{{notificationId}}/read'),
      ],
    },
  ],
}

function countRequests(items) {
  let n = 0
  for (const item of items) {
    if (item.request) n += 1
    if (item.item) n += countRequests(item.item)
  }
  return n
}

const outDir = path.join(__dirname)
fs.mkdirSync(outDir, { recursive: true })
const collectionPath = path.join(outDir, 'method-commerce-API.postman_collection.json')
fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2) + '\n')

const environment = {
  id: 'method-commerce-api-local',
  name: 'method-commerce API — local',
  values: collection.variable.map((v) => ({
    key: v.key,
    value: v.value,
    enabled: true,
    type: 'default',
  })),
  _postman_variable_scope: 'environment',
}
fs.writeFileSync(
  path.join(outDir, 'method-commerce-API.local.postman_environment.json'),
  JSON.stringify(environment, null, 2) + '\n'
)

console.log(`Wrote ${countRequests(collection.item)} requests to ${collectionPath}`)
