import React, { useEffect, useState } from 'react'
import CliSnippetCard from '../common/CliSnippetCard.jsx'
import { roleHeaders, useRole } from '../../context/RoleContext.jsx'

const LAB_CONFIG_API = '/api/v1/lab/config'
const LAB_INIT_API = '/api/v1/lab/init'

const EMPTY_FORM = {
  lab_name: 'lab1',
  pve_host: '',
  pve_node: '',
  pve_user: 'root',
  pve_password: '',
  storage_pool: '',
  resource_pool: '',
  network_bridge: 'vmbr0',
  nameserver: '',
  search_domain: '',
  lab_ip_pool: '',
  golden_vmid: 100,
  golden_name: 'ubuntu-2404-golden',
  registry_type: 'dockerhub',
  storage_mode: 'local',
  prism_endpoint: '',
  prism_port: 9440,
  prism_user: '',
  prism_password: '',
  storage_container: '',
}

const PRISM_FIELDS = [
  ['prism_endpoint', 'Prism Endpoint (PE/PC IP or FQDN)'],
  ['prism_port', 'Prism Port', 'number'],
  ['prism_user', 'Prism User'],
  ['prism_password', 'Prism Password (blank keeps existing)', 'password'],
  ['storage_container', 'Storage Container'],
]

const FIELDS = [
  ['lab_name', 'Lab Name'],
  ['pve_host', 'Proxmox Host / IP'],
  ['pve_node', 'Target Node'],
  ['pve_user', 'Proxmox User'],
  ['pve_password', 'Proxmox Password (blank keeps existing)', 'password'],
  ['storage_pool', 'Storage Pool'],
  ['resource_pool', 'Resource Pool (optional)'],
  ['network_bridge', 'Bridge'],
  ['nameserver', 'DNS Nameservers'],
  ['search_domain', 'Search Domain'],
  ['lab_ip_pool', 'Lab IP Pool (10.0.0.10-10.0.0.40)'],
  ['golden_vmid', 'Golden VMID', 'number'],
  ['golden_name', 'Golden Template Name'],
]

const CLI_FLAGS = {
  lab_name: '--lab-name', pve_host: '--pve-host', pve_node: '--pve-node', pve_user: '--pve-user',
  storage_pool: '--storage-pool', resource_pool: '--resource-pool', network_bridge: '--network-bridge',
  nameserver: '--nameserver', search_domain: '--search-domain', lab_ip_pool: '--lab-ip-pool',
  golden_vmid: '--golden-vmid', golden_name: '--golden-name', registry_type: '--registry-type',
  storage_mode: '--storage-mode',
}

const INI_KEYS = [
  ['PLATFORM', () => 'proxmox'], ['LAB_NAME', 'lab_name'], ['PVE_CLUSTER_HOST', 'pve_host'],
  ['PVE_TARGET_NODE', 'pve_node'], ['PVE_USER', 'pve_user'], ['PVE_PASSWORD', () => '********'],
  ['GOLDEN_TEMPLATE_VMID', 'golden_vmid'], ['GOLDEN_TEMPLATE_NAME', 'golden_name'],
  ['RESOURCE_POOL', 'resource_pool'], ['STORAGE_POOL', 'storage_pool'], ['NETWORK_BRIDGE', 'network_bridge'],
  ['NAMESERVER', 'nameserver'], ['SEARCH_DOMAIN', 'search_domain'], ['LAB_IP_POOL', 'lab_ip_pool'],
  ['REGISTRY_TYPE', 'registry_type'], ['STORAGE_MODE', 'storage_mode'],
  ['PRISM_ENDPOINT', 'prism_endpoint'], ['PRISM_PORT', 'prism_port'], ['PRISM_USER', 'prism_user'],
  ['PRISM_PASSWORD', () => '********'], ['STORAGE_CONTAINER', 'storage_container'],
]

export function buildIniPreview(form) {
  return INI_KEYS.map(([key, source]) => `${key}="${typeof source === 'function' ? source() : form[source] ?? ''}"`).join('\n')
}

export function buildCliCommand(form) {
  const flags = Object.entries(CLI_FLAGS)
    .filter(([field]) => String(form[field] ?? '') !== '')
    .map(([field, flag]) => `${flag} ${JSON.stringify(String(form[field]))}`)
  return ['./forge init lab --non-interactive', ...flags].join(' \\\n  ')
}

function LabInfraTab() {
  const { adminProps } = useRole()
  const [form, setForm] = useState(EMPTY_FORM)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasPrismPassword, setHasPrismPassword] = useState(false)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => fetch(LAB_CONFIG_API))
      .then((response) => response.json())
      .then((config) => {
        if (!active || !config?.configured) return
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(EMPTY_FORM)
              .filter((k) => k !== 'pve_password' && k !== 'prism_password')
              .map((k) => [k, config[k] ?? current[k]]),
          ),
        }))
        setHasPrismPassword(Boolean(config.prism_password))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const body = {
        ...form,
        golden_vmid: Number(form.golden_vmid),
        pve_password: form.pve_password || null,
        resource_pool: form.resource_pool || null,
        search_domain: form.search_domain || null,
        prism_port: Number(form.prism_port) || 9440,
        prism_endpoint: form.prism_endpoint || null,
        prism_user: form.prism_user || null,
        prism_password: form.prism_password || null,
        storage_container: form.storage_container || null,
      }
      const response = await fetch(LAB_INIT_API, {
        method: 'POST',
        headers: roleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      let payload = {}
      let rawResponse = ''
      if (typeof response.text === 'function') {
        rawResponse = await response.text()
        try {
          payload = rawResponse ? JSON.parse(rawResponse) : {}
        } catch (_parseError) {
          if (!response.ok) {
            throw new Error(`Lab initialization failed (${response.status}): ${rawResponse || 'empty server response'}`)
          }
          throw new Error('Lab initialization returned an invalid server response')
        }
      } else if (typeof response.json === 'function') {
        payload = await response.json()
      }
      if (!response.ok) {
        const detail = Array.isArray(payload.detail) ? payload.detail.map((d) => d.msg).join('; ') : payload.detail
        throw new Error(detail ?? `Lab initialization failed (${response.status})`)
      }
      setNotice(`Lab initialized: ${payload.config_path}`)
      setHasPrismPassword((current) => current || Boolean(form.prism_password))
      setForm((current) => ({ ...current, pve_password: '', prism_password: '' }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Lab initialization failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="tab-lab-infra">
      <div className="grid gap-3 md:grid-cols-2">
        {FIELDS.map(([field, label, type = 'text']) => (
          <label key={field} className="text-xs text-slate-300">
            {label}
            <input
              type={type}
              value={form[field]}
              onChange={update(field)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              data-testid={`input-lab-${field}`}
            />
          </label>
        ))}
        <label className="text-xs text-slate-300">
          Registry Type
          <select
            value={form.registry_type}
            onChange={update('registry_type')}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            data-testid="select-lab-registry_type"
          >
            <option value="dockerhub">Docker Hub</option>
            <option value="harbor">Harbor</option>
            <option value="mirror">Mirror</option>
          </select>
        </label>
        <label className="text-xs text-slate-300">
          Storage Mode
          <select
            value={form.storage_mode}
            onChange={update('storage_mode')}
            className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            data-testid="select-lab-storage_mode"
          >
            {[...new Set([form.storage_mode, 'local', 'nutanix-csi-pe', 'nutanix-csi-pc'])].map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </label>
      </div>

      {form.storage_mode.startsWith('nutanix-csi') && (
        <div className="rounded border border-slate-700 bg-slate-900/80 p-3" data-testid="section-lab-prism">
          <h4 className="mb-2 text-xs font-semibold text-slate-200">
            Nutanix Prism ({form.storage_mode === 'nutanix-csi-pc' ? 'Prism Central' : 'Prism Element'}) storage credentials
            {hasPrismPassword && (
              <span className="ml-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300" data-testid="badge-prism-password-set">
                password stored
              </span>
            )}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {PRISM_FIELDS.map(([field, label, type = 'text']) => (
              <label key={field} className="text-xs text-slate-300">
                {label}
                <input
                  type={type}
                  value={form[field]}
                  onChange={update(field)}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  data-testid={`input-lab-${field}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          {...adminProps(saving)}
          className="rounded bg-accent-teal px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
          data-testid="btn-save-lab"
        >
          {saving ? 'Saving…' : 'Save & Initialize Lab'}
        </button>
        {notice && <span className="text-xs text-emerald-300" data-testid="text-lab-notice">{notice}</span>}
        {error && <span className="text-xs text-rose-300" data-testid="text-lab-error">{error}</span>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-slate-700 bg-slate-900/80 p-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-200">{form.lab_name || 'lab'}-infra.ini preview</h4>
          <pre className="overflow-x-auto rounded bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200" data-testid="preview-lab-ini">
            {buildIniPreview(form)}
          </pre>
        </div>
        <CliSnippetCard command={buildCliCommand(form)} title="Copy as CLI" />
      </div>
    </div>
  )
}

export default LabInfraTab
