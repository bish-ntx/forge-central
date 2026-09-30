const RULES = [
  {
    pattern: /ipam (range )?exhausted|no available ip/i,
    title: 'IPAM Range Exhausted',
    description: 'No free IP addresses remain in the configured IPAM range.',
    actionable_fix: 'Free unused VM leases in /ipam or run ./forge list ipam',
    severity: 'critical',
    cli_command: './forge list ipam',
  },
  {
    pattern: /ssh connection refused|permission denied \(publickey/i,
    title: 'SSH Node Connectivity Failed',
    description: 'Forge could not open an SSH session to the target node.',
    actionable_fix: 'Verify SSH keys in ~/.ssh/ or run ssh-copy-id to target node',
    severity: 'critical',
    cli_command: 'ssh-copy-id <user>@<node-ip>',
  },
  {
    pattern: /helm chart timeout|context deadline exceeded|kommander.*(download|timeout)/i,
    title: 'Addon Installation Timeout',
    description: 'A Helm chart or Kommander download did not complete in time.',
    actionable_fix: 'Check network connectivity to registry or rerun deployment step',
    severity: 'warning',
  },
  {
    pattern: /no space left on device|disk full/i,
    title: 'Storage Exhaustion',
    description: 'The target datastore or node disk has run out of space.',
    actionable_fix: 'Clean unreferenced images or allocate additional disk storage',
    severity: 'critical',
  },
]

const FALLBACK = {
  title: 'Unexpected Error',
  description: 'The operation failed with an unrecognized error.',
  actionable_fix: 'Review the operation logs in /diagnostics and retry.',
  severity: 'info',
}

export function getRemediation(errorMsgOrCode) {
  const text = String(errorMsgOrCode ?? '')
  const match = RULES.find((rule) => rule.pattern.test(text))
  const { pattern, ...remediation } = match ?? FALLBACK
  return remediation
}
