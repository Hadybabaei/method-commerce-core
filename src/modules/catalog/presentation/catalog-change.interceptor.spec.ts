import { catalogChangeFor } from './catalog-change.interceptor'

describe('catalogChangeFor', () => {
  it('ignores reads and routes outside the catalog', () => {
    expect(catalogChangeFor('GET', '/api/admin/products/:id', { id: '3' }, null)).toBeNull()
    expect(catalogChangeFor('POST', '/api/admin/orders/:id/ship', { id: '3' }, null)).toBeNull()
  })

  it('names the product from the route, or from the created product', () => {
    expect(
      catalogChangeFor(
        'PATCH',
        '/api/admin/products/:id/variants/:variantId',
        { id: '7', variantId: '9' },
        {}
      )
    ).toEqual({
      productIds: [7],
      variantIds: [],
      everything: false,
    })
    expect(catalogChangeFor('POST', '/api/admin/products', {}, { id: 12 })).toEqual({
      productIds: [12],
      variantIds: [],
      everything: false,
    })
  })

  it('treats category and brand changes as changing everything', () => {
    expect(
      catalogChangeFor('DELETE', '/api/admin/brands/:id', { id: '2' }, undefined)?.everything
    ).toBe(true)
    expect(catalogChangeFor('PATCH', '/admin/categories/:id', { id: '2' }, {})?.everything).toBe(
      true
    )
  })

  it('reports stock changes by variant', () => {
    expect(
      catalogChangeFor('POST', '/api/admin/stock/:variantId/adjust', { variantId: '44' }, {})
    ).toEqual({
      productIds: [],
      variantIds: [44],
      everything: false,
    })
  })
})
