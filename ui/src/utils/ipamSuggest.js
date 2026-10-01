const DEFAULT_BLOCK_SIZE = 5

function ipToInt(ip) {
  const parts = String(ip).split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    value = value * 256 + octet
  }
  return value
}

function intToIp(value) {
  return [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.')
}

/**
 * Suggest a control-plane VIP and MetalLB range from free IPAM slots (`GET /api/v1/ipam/free`).
 * Mirrors the backend selection in `api/app/services/cluster_config.py`: the first free address is
 * the VIP, the MetalLB range is the contiguous free run (up to `blockSize`) right after it, else
 * the next run of two or more free addresses.
 */
export function suggestIpPlan(slots, blockSize = DEFAULT_BLOCK_SIZE) {
  const free = (Array.isArray(slots) ? slots : []).filter((slot) => slot && slot.ip)
  if (free.length === 0) return { vip: null, metallbRange: null }

  const vip = free[0].ip
  const vipInt = ipToInt(vip)
  const others = [...new Set(free.slice(1).map((slot) => ipToInt(slot.ip)))]
    .filter((value) => value !== null && value !== vipInt)
    .sort((a, b) => a - b)
  if (others.length === 0) return { vip, metallbRange: null }

  const runs = []
  for (const value of others) {
    const last = runs[runs.length - 1]
    if (last && value === last[last.length - 1] + 1) last.push(value)
    else runs.push([value])
  }
  const chosen =
    runs.find((run) => vipInt !== null && run[0] === vipInt + 1) ||
    runs.find((run) => run.length >= 2) ||
    runs[0]
  const block = chosen.slice(0, blockSize)
  return { vip, metallbRange: `${intToIp(block[0])}-${intToIp(block[block.length - 1])}` }
}
