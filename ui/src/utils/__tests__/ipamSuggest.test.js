import { suggestIpPlan } from '../ipamSuggest.js'

const slots = (...octets) => octets.map((octet) => ({ ip: `10.0.0.${octet}`, status: 'free' }))

describe('suggestIpPlan', () => {
  test('uses the first free IP as VIP and the free run right after it as MetalLB range', () => {
    expect(suggestIpPlan(slots(15, 16, 17, 18, 19, 20, 21, 22, 30))).toEqual({
      vip: '10.0.0.15',
      metallbRange: '10.0.0.16-10.0.0.20',
    })
  })

  test('falls back to the next contiguous run when nothing follows the VIP', () => {
    expect(suggestIpPlan(slots(15, 20, 21, 22))).toEqual({ vip: '10.0.0.15', metallbRange: '10.0.0.20-10.0.0.22' })
  })

  test('handles a single free IP and an empty ledger', () => {
    expect(suggestIpPlan(slots(15))).toEqual({ vip: '10.0.0.15', metallbRange: null })
    expect(suggestIpPlan([])).toEqual({ vip: null, metallbRange: null })
    expect(suggestIpPlan(undefined)).toEqual({ vip: null, metallbRange: null })
  })

  test('carries correctly across octet boundaries', () => {
    const plan = suggestIpPlan([
      { ip: '10.0.0.253' },
      { ip: '10.0.0.254' },
      { ip: '10.0.0.255' },
      { ip: '10.0.1.0' },
    ])
    expect(plan).toEqual({ vip: '10.0.0.253', metallbRange: '10.0.0.254-10.0.1.0' })
  })
})
