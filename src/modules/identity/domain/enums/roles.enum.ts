/** Roles a customer account can hold. Mirrors the legacy `user.role` column. */
export enum CustomerRole {
  User = 'user',
  PartnerLegal = 'partner_legal',
  PartnerReal = 'partner_real',
}

/** Roles a back-office account can hold. Mirrors the legacy `admin.role` column. */
export enum AdminRole {
  SuperAdmin = 'admin',
  Operator = 'operator',
  Delivery = 'delivery',
}

export enum UserType {
  Normal = 'NORMAL',
  Haghighi = 'HAGHIGHI',
  Hoqooqi = 'HOQOOQI',
}

export const CUSTOMER_ROLE_TO_USER_TYPE: Record<CustomerRole, UserType> = {
  [CustomerRole.User]: UserType.Normal,
  [CustomerRole.PartnerReal]: UserType.Haghighi,
  [CustomerRole.PartnerLegal]: UserType.Hoqooqi,
}
