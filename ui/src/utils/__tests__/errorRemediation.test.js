import { getRemediation } from '../errorRemediation.js'

describe('getRemediation', () => {
  test.each([
    ['IPAM exhausted for subnet', 'IPAM Range Exhausted', 'critical'],
    ['no available IP in range', 'IPAM Range Exhausted', 'critical'],
    ['SSH connection refused', 'SSH Node Connectivity Failed', 'critical'],
    ['Permission denied (publickey)', 'SSH Node Connectivity Failed', 'critical'],
    ['helm chart timeout', 'Addon Installation Timeout', 'warning'],
    ['context deadline exceeded', 'Addon Installation Timeout', 'warning'],
    ['write: no space left on device', 'Storage Exhaustion', 'critical'],
  ])('%s -> %s', (input, title, severity) => {
    const result = getRemediation(input)
    expect(result.title).toBe(title)
    expect(result.severity).toBe(severity)
    expect(result.actionable_fix).toBeTruthy()
  })

  test('includes CLI command for IPAM and SSH', () => {
    expect(getRemediation('IPAM exhausted').cli_command).toBe('./forge list ipam')
    expect(getRemediation('SSH connection refused').cli_command).toContain('ssh-copy-id')
  })

  test('falls back for unknown errors', () => {
    const result = getRemediation('something odd')
    expect(result.severity).toBe('info')
    expect(result.cli_command).toBeUndefined()
  })
})
