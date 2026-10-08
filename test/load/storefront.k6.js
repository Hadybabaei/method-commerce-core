/**
 * Storefront load test: browsing and checkout at 5× the expected peak.
 *
 *   k6 run -e API=https://staging.example.com/api -e PEAK_RPS=20 test/load/storefront.k6.js
 *
 * Run it against staging, never production: checkout places real (cash on
 * delivery) orders for the customers in CUSTOMER_PHONES, and needs the API
 * with OTP_EXPOSE_IN_RESPONSE=true so the script can sign in.
 *
 * Pass/fail thresholds follow the roadmap: p95 under 1.5 s for pages,
 * search under 200 ms, and fewer than 1% failed requests.
 */
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const API = (__ENV.API || 'http://localhost:4000/api').replace(/\/$/, '')
const PEAK_RPS = Number(__ENV.PEAK_RPS || 10)
const PHONES = (__ENV.CUSTOMER_PHONES || '09121234567').split(',')
const searchLatency = new Trend('search_latency', true)

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate',
      exec: 'browse',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: PEAK_RPS },
        { duration: '3m', target: PEAK_RPS * 5 },
        { duration: '1m', target: 0 },
      ],
    },
    checkout: {
      executor: 'constant-arrival-rate',
      exec: 'checkout',
      // Roughly one purchase for every fifty page views.
      rate: Math.max(1, Math.round((PEAK_RPS * 5) / 50)),
      timeUnit: '1s',
      duration: '4m',
      startTime: '1m',
      preAllocatedVUs: 10,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:page}': ['p(95)<1500'],
    search_latency: ['p(95)<200'],
  },
}

const WORDS = ['دریل', 'گوشی', 'کفش', 'لپ تاپ', 'هدفون', 'کتاب']
const pick = (list) => list[Math.floor(Math.random() * list.length)]

export function setup() {
  const products = http.get(`${API}/products?limit=50`).json('items') || []
  if (products.length === 0) throw new Error('No products to browse; seed the catalog first')
  return { slugs: products.map((product) => product.slug) }
}

export function browse({ slugs }) {
  group('browse', () => {
    const home = http.get(`${API}/products?limit=24`, { tags: { kind: 'page' } })
    check(home, { 'list 200': (r) => r.status === 200 })

    const search = http.get(`${API}/search?q=${encodeURIComponent(pick(WORDS))}&limit=24`, {
      tags: { kind: 'page' },
    })
    searchLatency.add(search.timings.duration)
    check(search, { 'search 200': (r) => r.status === 200 })

    const slug = encodeURIComponent(pick(slugs))
    const product = http.get(`${API}/products/${slug}`, { tags: { kind: 'page' } })
    check(product, { 'product 200': (r) => r.status === 200 })
    http.get(`${API}/products/${slug}/related`, { tags: { kind: 'page' } })
  })
  sleep(1)
}

function signIn(phone) {
  const otp = http.post(`${API}/auth/otp/request`, JSON.stringify({ phone_number: phone }), {
    headers: { 'content-type': 'application/json' },
  })
  const code = otp.json('code')
  if (!code) return null
  const verified = http.post(
    `${API}/auth/otp/verify`,
    JSON.stringify({ phone_number: phone, otp_code: code }),
    { headers: { 'content-type': 'application/json' } }
  )
  return verified.json('accessToken')
}

export function checkout({ slugs }) {
  const token = signIn(pick(PHONES))
  if (!check(token, { 'signed in': (t) => Boolean(t) })) return
  const auth = { headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } }

  group('checkout', () => {
    const product = http.get(`${API}/products/${encodeURIComponent(pick(slugs))}`).json()
    const variant = (product.variants || []).find((v) => v.isActive && v.availableQuantity > 0)
    if (!variant) return

    http.del(`${API}/users/me/basket`, null, auth)
    const added = http.post(
      `${API}/users/me/basket/items`,
      JSON.stringify({ variant_id: variant.id, quantity: 1 }),
      auth
    )
    if (!check(added, { 'added to basket': (r) => r.status < 300 })) return

    const addresses = http.get(`${API}/users/me/addresses`, auth).json()
    const list = Array.isArray(addresses) ? addresses : addresses.items || []
    if (list.length === 0) return
    const body = JSON.stringify({ address_id: list[0].id, payment_method: 'CASH_ON_DELIVERY' })

    check(http.post(`${API}/orders/preview`, body, { ...auth, tags: { kind: 'page' } }), {
      'preview 2xx': (r) => r.status < 300,
    })
    const order = http.post(`${API}/orders`, body, auth)
    check(order, { 'order placed': (r) => r.status === 201 })
    // Give the stock back so the test can run again.
    if (order.status === 201) http.post(`${API}/orders/${order.json('id')}/cancel`, null, auth)
  })
}
