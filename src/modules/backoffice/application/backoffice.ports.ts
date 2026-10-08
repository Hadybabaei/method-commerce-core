/** Read models and services behind the admin dashboard, reports, customers, stock and audit log. */

export interface DateRange {
  from: Date
  /** Exclusive. */
  to: Date
}

export interface DashboardView {
  today: { orders: number; sales: number }
  month: { orders: number; sales: number }
  /** This month's sales divided by its orders, Rial. */
  averageOrderValue: number
  /** Unpaid, not cancelled. */
  pendingOrders: number
  /** Paid or processing: waiting to ship. */
  toFulfil: number
  lowStockVariants: number
  openReturns: number
}

export interface SalesPoint {
  /** Tehran calendar day, YYYY-MM-DD. */
  day: string
  orders: number
  /** total - refunded, Rial. */
  sales: number
}

export interface ProductSalesRow {
  productId: number
  title: string
  units: number
  /** Line totals after discount, before VAT, Rial. */
  revenue: number
}

export interface CategorySalesRow {
  categoryId: number | null
  title: string | null
  units: number
  revenue: number
}

export interface PaymentConversionView {
  /** Online orders placed in the range. */
  placed: number
  paid: number
  cancelled: number
  /** paid / placed, 0..1. */
  rate: number
}

export interface ReportsReadModel {
  dashboard(now: Date): Promise<DashboardView>
  salesByDay(range: DateRange): Promise<SalesPoint[]>
  topProducts(range: DateRange, limit: number): Promise<ProductSalesRow[]>
  salesByCategory(range: DateRange): Promise<CategorySalesRow[]>
  paymentConversion(range: DateRange): Promise<PaymentConversionView>
  ordersCsv(range: DateRange): Promise<string>
  productsCsv(): Promise<string>
}

export const REPORTS_READ_MODEL = Symbol('ReportsReadModel')

export interface CustomerSummaryView {
  id: number
  phoneNumber: string
  name: string | null
  createdAt: Date
  blockedAt: Date | null
  orders: number
  /** Paid orders' totals minus refunds, Rial. */
  totalSpent: number
}

export interface CustomerDetailView extends CustomerSummaryView {
  email: string | null
  recentOrders: { id: number; number: string; status: string; total: number; createdAt: Date }[]
}

export interface CustomersService {
  list(query: { search?: string; limit: number; offset: number }): Promise<{
    items: CustomerSummaryView[]
    total: number
    limit: number
    offset: number
  }>
  get(id: number): Promise<CustomerDetailView>
  setBlocked(id: number, blocked: boolean, now: Date): Promise<CustomerDetailView>
}

export const CUSTOMERS_SERVICE = Symbol('CustomersService')

export interface StockLevelView {
  locationId: number
  locationName: string
  onHand: number
  reserved: number
}

export interface StockRowView {
  variantId: number
  sku: string
  productId: number
  productTitle: string
  options: { option: string; value: string }[]
  isActive: boolean
  lowStockThreshold: number | null
  onHand: number
  reserved: number
  /** onHand - reserved across warehouses. */
  available: number
  isLow: boolean
  levels: StockLevelView[]
}

export interface StockMovementView {
  id: number
  locationId: number
  delta: number
  onHandAfter: number
  reason: string
  adminId: number | null
  createdAt: Date
}

export interface StockService {
  list(query: { search?: string; lowOnly?: boolean; limit: number; offset: number }): Promise<{
    items: StockRowView[]
    total: number
    limit: number
    offset: number
  }>
  adjust(input: {
    variantId: number
    locationId?: number
    delta: number
    reason: string
    adminId: number
  }): Promise<StockRowView>
  setThreshold(variantId: number, threshold: number | null): Promise<StockRowView>
  movements(variantId: number, limit: number): Promise<StockMovementView[]>
}

export const STOCK_SERVICE = Symbol('StockService')

export interface AuditEntryView {
  id: number
  adminId: number | null
  adminEmail: string | null
  action: string
  entity: string
  entityId: string | null
  payload: unknown
  status: number
  createdAt: Date
}

export interface AuditLog {
  record(entry: {
    adminId: number | null
    action: string
    entity: string
    entityId: string | null
    payload: unknown
    status: number
  }): Promise<void>
  list(query: {
    adminId?: number
    entity?: string
    entityId?: string
    limit: number
    offset: number
  }): Promise<{ items: AuditEntryView[]; total: number; limit: number; offset: number }>
}

export const AUDIT_LOG = Symbol('AuditLog')
