#!/usr/bin/env bash
# =============================================================================
# Forge Central — Proxmox VM Bootstrap Script
# Provision a dedicated Forge Central / Bastion VM on Proxmox VE
# Supports:
#   Option A: Clone from existing Golden Template (VMID 100 or user-specified)
#   Option B: Scratch bring-up from Ubuntu 24.04 LTS cloud image
#   Auto: Probe for golden template, use clone if present, else fallback to scratch
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# Default Configuration
# -----------------------------------------------------------------------------
PVE_HOST="${PVE_CLUSTER_HOST:-10.123.238.110}"
PVE_USER="${PVE_USER:-root}"
PVE_SSH_PORT="${PVE_SSH_PORT:-22}"
MODE="auto"
TEMPLATE_VMID="${GOLDEN_TEMPLATE_VMID:-100}"
VMID="${FORGE_CENTRAL_VMID:-150}"
VM_NAME="${VM_NAME:-forge-central}"
CORES="${VM_CORES:-${CORES:-4}}"
MEMORY="${VM_MEMORY:-${MEMORY:-8192}}"
DISK="${VM_DISK:-${DISK_SIZE:-210G}}"
STORAGE="${STORAGE_POOL:-local-lvm}"
BRIDGE="${NETWORK_BRIDGE:-vmbr0}"
IP_CONFIG="${VM_IP:-dhcp}"
DRY_RUN=false
PRINT_MANUAL_STEPS=false
GUEST_AGENT_TIMEOUT="${GUEST_AGENT_TIMEOUT:-900}"

# DNS (optional). Applied via 'qm set --nameserver/--searchdomain' only when provided.
NAMESERVER="${VM_NAMESERVER:-}"
SEARCHDOMAIN="${VM_SEARCHDOMAIN:-}"
DNS_OPTS=""

# Interactive wizard: auto (TTY + no arguments) | true (--interactive) | false (--non-interactive)
INTERACTIVE="auto"
WIZARD_RAN=false
ORIG_ARGC=$#
# The built-in PVE_HOST default is only used by non-interactive runs; the wizard never auto-proceeds on it.
PVE_HOST_EXPLICIT=false
if [[ -n "${PVE_CLUSTER_HOST:-}" ]]; then PVE_HOST_EXPLICIT=true; fi
PVE_PASSWORD=""
PVE_USE_SSHPASS=false

# SSH key inputs (all optional). Inline content wins over file path; CLI wins over env.
# Key A (operator access)  : SSH_PUBKEY_FILE / SSH_PUBLIC_KEY  -> nkpadmin authorized_keys
# Key B (shared inter-VM)  : SSH_KEY_FILE / SSH_PRIVATE_KEY (+ SSH_PAIR_PUBKEY_FILE) -> ~/ssh-key/ staging
SSH_KEY_FILE="${FORGE_SSH_KEY_FILE:-}"
SSH_PAIR_PUBKEY_FILE="${FORGE_SSH_CLUSTER_PUBKEY_FILE:-}"
SSH_PUBKEY_FILE="${FORGE_SSH_PUBKEY_FILE:-}"
SSH_PRIVATE_KEY="${FORGE_SSH_PRIVATE_KEY:-}"
SSH_PUBLIC_KEY="${FORGE_SSH_PUBLIC_KEY:-}"
SSH_PRIVATE_KEY_B64=""   # base64 of operator private key (empty => generate in guest)
SSH_PAIR_PUB_B64=""      # base64 of explicit public key paired with the private key
SSH_AUTH_PUB_B64=""      # base64 of operator public key appended to authorized_keys
SSH_PUBKEY_SOURCE="none"

UBUNTU_IMG_NAME="ubuntu-24.04-server-cloudimg-amd64.img"
UBUNTU_IMG_DIR="/var/lib/vz/template/iso"
UBUNTU_IMG_PATH="${UBUNTU_IMG_DIR}/${UBUNTU_IMG_NAME}"
UBUNTU_IMG_URL="https://cloud-images.ubuntu.com/releases/24.04/release/${UBUNTU_IMG_NAME}"

SNIPPET_DIR="/var/lib/vz/snippets"
OVERLAY_SNIPPET_NAME="nkp-bastion-overlay.sh"
OVERLAY_SNIPPET_PATH="${SNIPPET_DIR}/${OVERLAY_SNIPPET_NAME}"
UNIFIED_SNIPPET_NAME="forge-central-unified-init.sh"
UNIFIED_SNIPPET_PATH="${SNIPPET_DIR}/${UNIFIED_SNIPPET_NAME}"
META_SNIPPET_NAME="${VM_NAME}-meta.yaml"
META_SNIPPET_PATH="${SNIPPET_DIR}/${META_SNIPPET_NAME}"

# -----------------------------------------------------------------------------
# Usage / Help
# -----------------------------------------------------------------------------
usage() {
  printf '%s\n' \
"Forge Central — Automated Proxmox VM Bootstrap Tool" \
"" \
"USAGE:" \
"  ./scripts/bootstrap-forge-central-vm.sh [OPTIONS]" \
"" \
"OPTIONS:" \
"  -i, --interactive         Run the interactive wizard (also starts automatically when run with no arguments on a TTY)" \
"  --non-interactive         Never prompt; use flags/env/defaults only (default whenever any flag is given)" \
"  --pve-host <ip|hostname>  Target Proxmox host IP/hostname (default: 10.123.238.110 or PVE_CLUSTER_HOST;" \
"                            the wizard has NO default host and aborts if none is entered)" \
"  --nameserver <list>       DNS nameserver(s), space/comma separated, e.g. '10.40.64.15 8.8.8.8' (env: VM_NAMESERVER)" \
"  --searchdomain <domain>   DNS search domain, e.g. 'nutanix.com' (env: VM_SEARCHDOMAIN)" \
"  --pve-user <user>         SSH user for Proxmox (default: root or PVE_USER)" \
"  --mode <clone|scratch|auto>" \
"                            Provisioning mode:" \
"                              clone   - Clone from existing golden template (Option A)" \
"                              scratch - Scratch bring-up from Ubuntu 24.04 cloud image (Option B)" \
"                              auto    - Auto-detect golden template; fallback to scratch (default)" \
"  --template-vmid <id>      Golden template VMID to clone from (default: 100 or GOLDEN_TEMPLATE_VMID)" \
"  --vmid <id>               Target VMID for Forge Central VM (default: 150 or FORGE_CENTRAL_VMID)" \
"  --vm-name <name>          VM name in Proxmox (default: forge-central or VM_NAME)" \
"  --cores <n>               vCPU cores allocated to VM (default: 4 or VM_CORES)" \
"  --memory <mb>             RAM allocated to VM in MB (default: 8192 or VM_MEMORY)" \
"  --disk <size>             Disk size for VM (default: 210G or VM_DISK)" \
"  --storage <pool>          Proxmox storage pool (default: local-lvm or STORAGE_POOL)" \
"  --bridge <bridge>         Proxmox virtual network bridge (default: vmbr0 or NETWORK_BRIDGE)" \
"  --ip <cidr_or_dhcp>       IP configuration, e.g. 'dhcp' or '10.123.238.150/24,gw=10.123.238.1' (default: dhcp)" \
"  --ssh-key-file <path>     Key B: shared cluster private key to stage in the VM as ~/.ssh/id_nkpadmin_ecdsa and ~/ssh-key/ (env: FORGE_SSH_KEY_FILE)" \
"  --ssh-cluster-pubkey-file <path>" \
"                            Key B public half, when it differs from --ssh-pubkey-file (env: FORGE_SSH_CLUSTER_PUBKEY_FILE)" \
"  --ssh-pubkey-file <path>  Key A: operator workstation public key to authorize in the VM (env: FORGE_SSH_PUBKEY_FILE)" \
"  --ssh-private-key <text>  Inline SSH private key content (env: FORGE_SSH_PRIVATE_KEY)" \
"  --ssh-public-key <text>   Inline SSH public key content (env: FORGE_SSH_PUBLIC_KEY)" \
"                            Without a public key, ~/.ssh/id_ed25519.pub, id_ecdsa.pub, id_rsa.pub is auto-detected." \
"                            Without a private key, an ECDSA keypair is generated inside the VM on first boot." \
"                            Password login (nkpadmin / Nutanix.123) and ssh-copy-id always remain enabled." \
"  --dry-run                 Simulate and print all remote SSH and qm commands without executing" \
"  --print-manual-steps      Print verbatim manual Proxmox CLI runbook with interpolated variables and exit" \
"  -h, --help                Show this help message and exit" \
"" \
"EXAMPLES:" \
"  # Auto bring-up (Option A if template 100 exists, else Option B)" \
"  ./scripts/bootstrap-forge-central-vm.sh --pve-host 10.123.238.110" \
"" \
"  # Enforce golden template clone" \
"  ./scripts/bootstrap-forge-central-vm.sh --mode clone --template-vmid 100 --vmid 150" \
"" \
"  # Enforce scratch bring-up with static IP" \
"  ./scripts/bootstrap-forge-central-vm.sh --mode scratch --vmid 150 --ip 10.123.238.150/24,gw=10.123.238.1" \
"" \
"  # Supply your own SSH keypair (files)" \
"  ./scripts/bootstrap-forge-central-vm.sh --ssh-key-file ~/.ssh/id_nkpadmin_ecdsa --ssh-pubkey-file ~/.ssh/id_nkpadmin_ecdsa.pub" \
"" \
"  # Authorize only your workstation public key (VM generates its own cluster keypair)" \
"  FORGE_SSH_PUBKEY_FILE=~/.ssh/id_ed25519.pub ./scripts/bootstrap-forge-central-vm.sh" \
"" \
"  # Dry-run inspection" \
"  ./scripts/bootstrap-forge-central-vm.sh --dry-run --mode scratch" \
"" \
"  # Interactive wizard (no default host; final yes/no confirmation defaults to no)" \
"  ./scripts/bootstrap-forge-central-vm.sh --interactive" \
"" \
"  # Static IP with DNS, non-interactive" \
"  ./scripts/bootstrap-forge-central-vm.sh --pve-host 10.123.238.110 --ip 10.123.238.150/24,gw=10.123.238.1 \\" \
"      --nameserver '10.40.64.15 8.8.8.8' --searchdomain nutanix.com --non-interactive" \
"" \
"  # Print copy-pasteable manual SOP commands" \
"  ./scripts/bootstrap-forge-central-vm.sh --print-manual-steps --mode clone"
}

# -----------------------------------------------------------------------------
# Parse CLI Arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--interactive)
      INTERACTIVE="true"
      shift
      ;;
    --non-interactive)
      INTERACTIVE="false"
      shift
      ;;
    --pve-host)
      PVE_HOST="${2:?--pve-host requires a value}"; PVE_HOST_EXPLICIT=true
      shift 2
      ;;
    --pve-host=*)
      PVE_HOST="${1#--pve-host=}"; PVE_HOST_EXPLICIT=true
      shift
      ;;
    --nameserver)
      NAMESERVER="${2:?--nameserver requires a value}"
      shift 2
      ;;
    --nameserver=*)
      NAMESERVER="${1#--nameserver=}"
      shift
      ;;
    --searchdomain)
      SEARCHDOMAIN="${2:?--searchdomain requires a value}"
      shift 2
      ;;
    --searchdomain=*)
      SEARCHDOMAIN="${1#--searchdomain=}"
      shift
      ;;
    --ssh-cluster-pubkey-file)
      SSH_PAIR_PUBKEY_FILE="${2:?--ssh-cluster-pubkey-file requires a value}"
      shift 2
      ;;
    --ssh-cluster-pubkey-file=*)
      SSH_PAIR_PUBKEY_FILE="${1#--ssh-cluster-pubkey-file=}"
      shift
      ;;
    --pve-user)
      PVE_USER="${2:?--pve-user requires a value}"
      shift 2
      ;;
    --pve-user=*)
      PVE_USER="${1#--pve-user=}"
      shift
      ;;
    --mode)
      MODE="${2:?--mode requires a value (clone|scratch|auto)}"
      shift 2
      ;;
    --mode=*)
      MODE="${1#--mode=}"
      shift
      ;;
    --template-vmid)
      TEMPLATE_VMID="${2:?--template-vmid requires a value}"
      shift 2
      ;;
    --template-vmid=*)
      TEMPLATE_VMID="${1#--template-vmid=}"
      shift
      ;;
    --vmid)
      VMID="${2:?--vmid requires a value}"
      shift 2
      ;;
    --vmid=*)
      VMID="${1#--vmid=}"
      shift
      ;;
    --vm-name)
      VM_NAME="${2:?--vm-name requires a value}"
      META_SNIPPET_NAME="${VM_NAME}-meta.yaml"
      META_SNIPPET_PATH="${SNIPPET_DIR}/${META_SNIPPET_NAME}"
      shift 2
      ;;
    --vm-name=*)
      VM_NAME="${1#--vm-name=}"
      META_SNIPPET_NAME="${VM_NAME}-meta.yaml"
      META_SNIPPET_PATH="${SNIPPET_DIR}/${META_SNIPPET_NAME}"
      shift
      ;;
    --cores)
      CORES="${2:?--cores requires a value}"
      shift 2
      ;;
    --cores=*)
      CORES="${1#--cores=}"
      shift
      ;;
    --memory)
      MEMORY="${2:?--memory requires a value}"
      shift 2
      ;;
    --memory=*)
      MEMORY="${1#--memory=}"
      shift
      ;;
    --disk)
      DISK="${2:?--disk requires a value}"
      shift 2
      ;;
    --disk=*)
      DISK="${1#--disk=}"
      shift
      ;;
    --storage)
      STORAGE="${2:?--storage requires a value}"
      shift 2
      ;;
    --storage=*)
      STORAGE="${1#--storage=}"
      shift
      ;;
    --bridge)
      BRIDGE="${2:?--bridge requires a value}"
      shift 2
      ;;
    --bridge=*)
      BRIDGE="${1#--bridge=}"
      shift
      ;;
    --ip)
      IP_CONFIG="${2:?--ip requires a value}"
      shift 2
      ;;
    --ip=*)
      IP_CONFIG="${1#--ip=}"
      shift
      ;;
    --ssh-key-file)
      SSH_KEY_FILE="${2:?--ssh-key-file requires a value}"; SSH_PRIVATE_KEY=""
      shift 2
      ;;
    --ssh-key-file=*)
      SSH_KEY_FILE="${1#--ssh-key-file=}"; SSH_PRIVATE_KEY=""
      shift
      ;;
    --ssh-pubkey-file)
      SSH_PUBKEY_FILE="${2:?--ssh-pubkey-file requires a value}"; SSH_PUBLIC_KEY=""
      shift 2
      ;;
    --ssh-pubkey-file=*)
      SSH_PUBKEY_FILE="${1#--ssh-pubkey-file=}"; SSH_PUBLIC_KEY=""
      shift
      ;;
    --ssh-private-key)
      SSH_PRIVATE_KEY="${2:?--ssh-private-key requires a value}"; SSH_KEY_FILE=""
      shift 2
      ;;
    --ssh-private-key=*)
      SSH_PRIVATE_KEY="${1#--ssh-private-key=}"; SSH_KEY_FILE=""
      shift
      ;;
    --ssh-public-key)
      SSH_PUBLIC_KEY="${2:?--ssh-public-key requires a value}"; SSH_PUBKEY_FILE=""
      shift 2
      ;;
    --ssh-public-key=*)
      SSH_PUBLIC_KEY="${1#--ssh-public-key=}"; SSH_PUBKEY_FILE=""
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --print-manual-steps)
      PRINT_MANUAL_STEPS=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# Strip leading and trailing whitespace and surrounding single/double quotes
trim_whitespace_and_quotes() {
  local val="$1"
  # Trim leading whitespace
  val="${val#"${val%%[![:space:]]*}"}"
  # Trim trailing whitespace
  val="${val%"${val##*[![:space:]]}"}"
  # Strip matching outer double quotes
  if [[ "${val}" =~ ^\"(.*)\"$ ]]; then
    val="${BASH_REMATCH[1]}"
  elif [[ "${val}" =~ ^\'(.*)\'$ ]]; then
    val="${BASH_REMATCH[1]}"
  fi
  # Re-trim after removing quotes
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  printf '%s' "${val}"
}

expand_tilde() {
  local p
  p="$(trim_whitespace_and_quotes "$1")"
  printf '%s' "${p/#\~/${HOME}}"
}

# -----------------------------------------------------------------------------
# Proxmox SSH helper (key-based by default; sshpass only after the operator opts in)
# -----------------------------------------------------------------------------
pve_ssh() {
  local -a opts=(-p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o "ConnectTimeout=${PVE_SSH_TIMEOUT:-10}")
  if [[ "${PVE_USE_SSHPASS}" == "true" ]]; then
    SSHPASS="${PVE_PASSWORD}" sshpass -e ssh "${opts[@]}" "${PVE_USER}@${PVE_HOST}" "$@"
  else
    ssh "${opts[@]}" "${PVE_USER}@${PVE_HOST}" "$@"
  fi
}

# -----------------------------------------------------------------------------
# Interactive Wizard
# -----------------------------------------------------------------------------
wizard_abort() {
  echo "" >&2
  echo "ABORTED: ${1:-Wizard cancelled}. Nothing was changed." >&2
  exit 1
}

# ask <label> [default] -> sets REPLY_VALUE (default used on blank input). Prompts go to stderr.
ask() {
  local label="$1" def="${2:-}" ans=""
  if [[ -n "${def}" ]]; then
    printf '%s [%s]: ' "${label}" "${def}" >&2
  else
    printf '%s: ' "${label}" >&2
  fi
  IFS= read -r ans || wizard_abort "Input closed"
  ans="$(trim_whitespace_and_quotes "${ans}")"
  REPLY_VALUE="${ans:-${def}}"
}

# ask_file <label> [default] -> sets REPLY_VALUE; re-asks until readable, blank, or 'none'.
ask_file() {
  local label="$1" def="${2:-}" f
  while true; do
    ask "${label}" "${def}"
    REPLY_VALUE="$(trim_whitespace_and_quotes "${REPLY_VALUE}")"
    if [[ -z "${REPLY_VALUE}" || "${REPLY_VALUE}" == "none" ]]; then REPLY_VALUE=""; return 0; fi
    f="$(expand_tilde "${REPLY_VALUE}")"
    if [[ -r "${f}" ]]; then
      REPLY_VALUE="${f}"
      return 0
    fi
    echo "  File '${REPLY_VALUE}' not found or not readable. Enter another path, or leave blank to skip." >&2
    def=""
  done
}

should_run_wizard() {
  if [[ "${PRINT_MANUAL_STEPS}" == "true" ]]; then return 1; fi
  case "${INTERACTIVE}" in
    true)  return 0 ;;
    false) return 1 ;;
  esac
  # auto: only when launched with no arguments at all on a real terminal
  [[ "${ORIG_ARGC}" -eq 0 && -t 0 && -t 1 ]]
}

run_wizard() {
  local static_ip static_gw

  echo "================================================================================" >&2
  echo " Forge Central — Interactive Bootstrap Wizard" >&2
  echo " Press Enter to accept a [default]. Nothing is changed until you confirm at the end." >&2
  echo "================================================================================" >&2

  # --- Safety stop: Proxmox host must be entered/confirmed explicitly; blank aborts ---
  if [[ "${PVE_HOST_EXPLICIT}" == "true" ]]; then
    ask "Proxmox host IP/hostname (confirm or enter)" "${PVE_HOST}"
  else
    ask "Proxmox host IP/hostname (required, no default)" ""
  fi
  if [[ -z "${REPLY_VALUE}" ]]; then
    wizard_abort "No Proxmox host provided"
  fi
  if ! [[ "${REPLY_VALUE}" =~ ^[A-Za-z0-9._:-]+$ ]]; then
    wizard_abort "Invalid Proxmox host '${REPLY_VALUE}'"
  fi
  PVE_HOST="${REPLY_VALUE}"
  PVE_HOST_EXPLICIT=true

  # Probe early connectivity right after host entry so operator doesn't fill out the whole form if unreachable
  preflight_pve_connectivity

  ask "Proxmox SSH user" "${PVE_USER}"; PVE_USER="${REPLY_VALUE}"
  ask "Provisioning mode (clone|scratch|auto)" "${MODE}"; MODE="${REPLY_VALUE}"
  case "${MODE}" in clone|scratch|auto) ;; *) wizard_abort "Invalid mode '${MODE}'" ;; esac
  if [[ "${MODE}" != "scratch" ]]; then
    ask "Golden template VMID" "${TEMPLATE_VMID}"; TEMPLATE_VMID="${REPLY_VALUE}"
  fi
  ask "Target VMID" "${VMID}"; VMID="${REPLY_VALUE}"
  ask "VM name" "${VM_NAME}"; VM_NAME="${REPLY_VALUE}"
  META_SNIPPET_NAME="${VM_NAME}-meta.yaml"
  META_SNIPPET_PATH="${SNIPPET_DIR}/${META_SNIPPET_NAME}"
  ask "vCPU cores" "${CORES}"; CORES="${REPLY_VALUE}"
  ask "Memory (MB)" "${MEMORY}"; MEMORY="${REPLY_VALUE}"
  ask "Disk size" "${DISK}"; DISK="${REPLY_VALUE}"
  ask "Storage pool" "${STORAGE}"; STORAGE="${REPLY_VALUE}"
  ask "Network bridge" "${BRIDGE}"; BRIDGE="${REPLY_VALUE}"

  # --- Networking: DHCP or static IPv4 ---
  local net_default="dhcp"
  if [[ "${IP_CONFIG}" != "dhcp" ]]; then net_default="static"; fi
  ask "IP addressing (dhcp|static)" "${net_default}"
  case "${REPLY_VALUE}" in
    dhcp)
      IP_CONFIG="dhcp"
      ;;
    static)
      ask "VM IPv4 address (CIDR, e.g. 10.123.238.150/24)" ""
      static_ip="${REPLY_VALUE}"
      if ! [[ "${static_ip}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}(/[0-9]{1,2})?$ ]]; then
        wizard_abort "Invalid IPv4 address '${static_ip}'"
      fi
      if [[ "${static_ip}" != */* ]]; then static_ip="${static_ip}/24"; echo "  No prefix given; assuming /24." >&2; fi
      ask "Gateway IPv4" ""
      static_gw="${REPLY_VALUE}"
      if [[ -n "${static_gw}" ]] && ! [[ "${static_gw}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
        wizard_abort "Invalid gateway '${static_gw}'"
      fi
      IP_CONFIG="${static_ip}${static_gw:+,gw=${static_gw}}"
      ;;
    *)
      wizard_abort "IP addressing must be 'dhcp' or 'static'"
      ;;
  esac
  ask "DNS nameserver(s), space separated, e.g. 10.40.64.15 8.8.8.8 (blank = none)" "${NAMESERVER}"; NAMESERVER="${REPLY_VALUE}"
  ask "DNS search domain, e.g. nutanix.com (blank = none)" "${SEARCHDOMAIN}"; SEARCHDOMAIN="${REPLY_VALUE}"

  # --- Key A: operator workstation public key (-> /home/nkpadmin/.ssh/authorized_keys) ---
  local keyA_def="${SSH_PUBKEY_FILE:-~/.ssh/id_ed25519.pub}"
  if [[ -n "${SSH_PUBLIC_KEY}" ]]; then
    echo "  Key A: using inline public key supplied via flag/env." >&2
  else
    if [[ ! -r "$(expand_tilde "${keyA_def}")" ]]; then
      echo "  Note: ${keyA_def} not found; enter another public key path or leave blank to auto-detect/skip." >&2
      keyA_def=""
    fi
    ask_file "Operator workstation public key for passwordless login" "${keyA_def}"
    SSH_PUBKEY_FILE="${REPLY_VALUE}"
  fi

  # --- Key B: optional shared inter-VM cluster keypair ---
  if [[ -n "${SSH_PRIVATE_KEY}" ]]; then
    echo "  Key B: using inline cluster private key supplied via flag/env (content not printed)." >&2
  else
    ask_file "Shared cluster private key file for inter-VM orchestration (leave blank to auto-generate inside VM)" "${SSH_KEY_FILE}"
    SSH_KEY_FILE="${REPLY_VALUE}"
    SSH_PAIR_PUBKEY_FILE=""
    if [[ -n "${SSH_KEY_FILE}" ]]; then
      local pair_def=""
      if [[ -r "$(expand_tilde "${SSH_KEY_FILE}").pub" ]]; then pair_def="${SSH_KEY_FILE}.pub"; fi
      ask_file "Public key file for the shared cluster private key (blank = derive inside VM)" "${pair_def}"
      SSH_PAIR_PUBKEY_FILE="${REPLY_VALUE}"
    fi
  fi

  # --- Final confirmation guard ---
  print_wizard_summary >&2
  ask "Are you sure you want to proceed with deployment on ${PVE_USER}@${PVE_HOST}? (yes/no)" "no"
  case "$(printf '%s' "${REPLY_VALUE}" | tr '[:upper:]' '[:lower:]')" in
    yes|y) ;;
    *) wizard_abort "Deployment not confirmed" ;;
  esac
  WIZARD_RAN=true
}

print_wizard_summary() {
  local keyA keyB
  if [[ -n "${SSH_PUBLIC_KEY}" ]]; then keyA="inline"
  elif [[ -n "${SSH_PUBKEY_FILE}" ]]; then keyA="${SSH_PUBKEY_FILE}"
  else keyA="auto-detect from ~/.ssh (or none)"; fi
  if [[ -n "${SSH_PRIVATE_KEY}" ]]; then keyB="inline (content not printed)"
  elif [[ -n "${SSH_KEY_FILE}" ]]; then keyB="${SSH_KEY_FILE} (pub: ${SSH_PAIR_PUBKEY_FILE:-derived in VM})"
  else keyB="auto-generate ECDSA inside VM -> ~/ssh-key/"; fi
  printf '\n'
  printf '%s\n' "================================== DEPLOYMENT SUMMARY =================================="
  printf '  %-22s %s\n' \
    "Proxmox host" "${PVE_USER}@${PVE_HOST}:${PVE_SSH_PORT}" \
    "Mode" "${MODE}$([[ "${MODE}" != "scratch" ]] && echo " (template VMID ${TEMPLATE_VMID})")" \
    "VMID / Name" "${VMID} / ${VM_NAME}" \
    "Resources" "${CORES} vCPU, ${MEMORY} MB RAM, ${DISK} disk" \
    "Storage / Bridge" "${STORAGE} / ${BRIDGE}" \
    "IP configuration" "${IP_CONFIG}" \
    "DNS nameserver(s)" "${NAMESERVER:-(none)}" \
    "DNS search domain" "${SEARCHDOMAIN:-(none)}" \
    "Key A (operator)" "${keyA}" \
    "Key B (inter-VM)" "${keyB}" \
    "Dry run" "${DRY_RUN}"
  printf '%s\n\n' "========================================================================================"
}

# Pre-flight: probe key-based SSH to Proxmox; fall back to password / ssh-copy-id / sshpass.
preflight_pve_connectivity() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    return 0
  fi
  local probe_opts=(-p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes)
  local target="${PVE_USER}@${PVE_HOST}" copy_ans keyA_file="" has_sshpass=false
  echo "Probing SSH connectivity to ${target} ..." >&2
  if ssh "${probe_opts[@]}" "${target}" true >/dev/null 2>&1; then
    echo "  OK: key-based SSH to ${target} works." >&2
    return 0
  fi
  echo "  Key-based SSH to ${target} failed (no accepted key, or host unreachable)." >&2
  if command -v sshpass >/dev/null 2>&1; then has_sshpass=true; fi

  printf 'Proxmox password for %s (input hidden; blank to skip): ' "${target}" >&2
  IFS= read -r -s PVE_PASSWORD || wizard_abort "Input closed"
  echo "" >&2

  if [[ -z "${keyA_file}" ]]; then
    for cand in ~/.ssh/id_ed25519.pub ~/.ssh/id_ecdsa.pub ~/.ssh/id_rsa.pub; do
      if [[ -r "${cand}" ]]; then keyA_file="${cand}"; break; fi
    done
  fi
  if command -v ssh-copy-id >/dev/null 2>&1; then
    ask "Install your public key on ${target} with ssh-copy-id now? (yes/no)" "yes"
    copy_ans="$(printf '%s' "${REPLY_VALUE}" | tr '[:upper:]' '[:lower:]')"
    if [[ "${copy_ans}" == "yes" || "${copy_ans}" == "y" ]]; then
      local -a copy_cmd=(ssh-copy-id -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no)
      if [[ -n "${keyA_file}" ]]; then copy_cmd+=(-i "${keyA_file}"); fi
      if [[ "${has_sshpass}" == "true" && -n "${PVE_PASSWORD}" ]]; then
        SSHPASS="${PVE_PASSWORD}" sshpass -e "${copy_cmd[@]}" "${target}" >/dev/null 2>&1 || true
      else
        echo "  ssh-copy-id will prompt for the password itself." >&2
        "${copy_cmd[@]}" "${target}" || true
      fi
      if ssh "${probe_opts[@]}" "${target}" true >/dev/null 2>&1; then
        echo "  OK: key installed; key-based SSH now works." >&2
        PVE_PASSWORD=""
        return 0
      fi
      echo "  Key-based SSH still failing after ssh-copy-id." >&2
    fi
  else
    echo "  ssh-copy-id not found on this workstation." >&2
  fi

  if [[ "${has_sshpass}" == "true" && -n "${PVE_PASSWORD}" ]]; then
    PVE_USE_SSHPASS=true
    if PVE_SSH_TIMEOUT=10 pve_ssh true >/dev/null 2>&1; then
      echo "  OK: using password authentication via sshpass for this run only." >&2
      return 0
    fi
    PVE_USE_SSHPASS=false
    PVE_PASSWORD=""
    wizard_abort "Password authentication to ${target} failed"
  fi
  PVE_PASSWORD=""
  if [[ "${has_sshpass}" != "true" ]]; then
    echo "  Tip: install sshpass (e.g. 'brew install sshpass') to use password auth for this run." >&2
  fi
  wizard_abort "Cannot reach ${target} with SSH"
}

if should_run_wizard; then
  run_wizard
fi

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------
case "${MODE}" in
  clone|scratch|auto) ;;
  *)
    echo "ERROR: Invalid --mode '${MODE}'. Must be one of: clone, scratch, auto." >&2
    exit 1
    ;;
esac

if ! [[ "${VMID}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --vmid must be an integer, got '${VMID}'." >&2
  exit 1
fi

if ! [[ "${TEMPLATE_VMID}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --template-vmid must be an integer, got '${TEMPLATE_VMID}'." >&2
  exit 1
fi

if ! [[ "${CORES}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --cores must be an integer, got '${CORES}'." >&2
  exit 1
fi

if ! [[ "${MEMORY}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --memory must be an integer in MB, got '${MEMORY}'." >&2
  exit 1
fi

# DNS: normalise commas to spaces, validate (values are interpolated into remote shell commands).
NAMESERVER="$(printf '%s' "${NAMESERVER}" | tr ',' ' ' | awk '{$1=$1;print}')"
if [[ -n "${NAMESERVER}" ]] && ! [[ "${NAMESERVER}" =~ ^[0-9A-Fa-f:.]+( [0-9A-Fa-f:.]+)*$ ]]; then
  echo "ERROR: --nameserver must be one or more IP addresses, got '${NAMESERVER}'." >&2
  exit 1
fi
if [[ -n "${SEARCHDOMAIN}" ]] && ! [[ "${SEARCHDOMAIN}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "ERROR: --searchdomain must be a DNS domain name, got '${SEARCHDOMAIN}'." >&2
  exit 1
fi
if [[ -n "${NAMESERVER}" ]]; then DNS_OPTS+=" --nameserver \"${NAMESERVER}\""; fi
if [[ -n "${SEARCHDOMAIN}" ]]; then DNS_OPTS+=" --searchdomain \"${SEARCHDOMAIN}\""; fi

# -----------------------------------------------------------------------------
# SSH Key Resolution (no secrets are ever embedded in this script)
# -----------------------------------------------------------------------------
b64_stdin() {
  base64 | tr -d '\n'
}

resolve_ssh_keys() {
  local f cand

  # Private key: inline content wins, else file.
  if [[ -n "${SSH_PRIVATE_KEY}" ]]; then
    SSH_PRIVATE_KEY_B64="$(printf '%s\n' "${SSH_PRIVATE_KEY}" | b64_stdin)"
  elif [[ -n "${SSH_KEY_FILE}" ]]; then
    f="$(expand_tilde "${SSH_KEY_FILE}")"
    if [[ ! -r "${f}" ]]; then
      echo "ERROR: --ssh-key-file '${SSH_KEY_FILE}' not found or not readable." >&2
      exit 1
    fi
    SSH_PRIVATE_KEY_B64="$(b64_stdin < "${f}")"
  fi

  # Public key: inline content wins, else file, else local auto-detection.
  local pub=""
  if [[ -n "${SSH_PUBLIC_KEY}" ]]; then
    pub="${SSH_PUBLIC_KEY}"
    SSH_PUBKEY_SOURCE="inline"
  elif [[ -n "${SSH_PUBKEY_FILE}" ]]; then
    f="$(expand_tilde "${SSH_PUBKEY_FILE}")"
    if [[ ! -r "${f}" ]]; then
      echo "ERROR: --ssh-pubkey-file '${SSH_PUBKEY_FILE}' not found or not readable." >&2
      exit 1
    fi
    pub="$(head -n1 "${f}")"
    SSH_PUBKEY_SOURCE="file:${SSH_PUBKEY_FILE}"
  fi

  if [[ -n "${pub}" ]]; then
    if ! [[ "${pub}" =~ ^(ssh-|ecdsa-|sk-) ]]; then
      echo "ERROR: Supplied SSH public key does not look like an OpenSSH public key." >&2
      exit 1
    fi
    SSH_AUTH_PUB_B64="$(printf '%s\n' "${pub}" | b64_stdin)"
    # An explicit public key paired with an explicit private key is staged as its .pub.
    if [[ -n "${SSH_PRIVATE_KEY_B64}" ]]; then
      SSH_PAIR_PUB_B64="${SSH_AUTH_PUB_B64}"
    fi
  else
    for cand in id_ed25519.pub id_ecdsa.pub id_rsa.pub; do
      f="${HOME}/.ssh/${cand}"
      if [[ -r "${f}" ]]; then
        SSH_AUTH_PUB_B64="$(head -n1 "${f}" | b64_stdin)"
        SSH_PUBKEY_SOURCE="auto-detected:~/.ssh/${cand}"
        break
      fi
    done
  fi

  # Key B public half (shared inter-VM keypair) may differ from the operator's Key A.
  if [[ -n "${SSH_PAIR_PUBKEY_FILE}" && -n "${SSH_PRIVATE_KEY_B64}" ]]; then
    f="$(expand_tilde "${SSH_PAIR_PUBKEY_FILE}")"
    if [[ ! -r "${f}" ]]; then
      echo "ERROR: --ssh-cluster-pubkey-file '${SSH_PAIR_PUBKEY_FILE}' not found or not readable." >&2
      exit 1
    fi
    pub="$(head -n1 "${f}")"
    if ! [[ "${pub}" =~ ^(ssh-|ecdsa-|sk-) ]]; then
      echo "ERROR: --ssh-cluster-pubkey-file does not look like an OpenSSH public key." >&2
      exit 1
    fi
    SSH_PAIR_PUB_B64="$(printf '%s\n' "${pub}" | b64_stdin)"
  elif [[ -n "${SSH_PAIR_PUBKEY_FILE}" ]]; then
    echo "ERROR: --ssh-cluster-pubkey-file requires a private key (--ssh-key-file or --ssh-private-key)." >&2
    exit 1
  fi
}

resolve_ssh_keys

# -----------------------------------------------------------------------------
# Remote Command Execution Helpers
# -----------------------------------------------------------------------------
run_ssh() {
  local cmd="$1"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} '${cmd}'"
    return 0
  fi
  pve_ssh "${cmd}"
}

upload_snippet() {
  local remote_path="$1"
  local content="$2"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} 'cat > ${remote_path}'"
    return 0
  fi
  printf '%s' "${content}" | pve_ssh \
    "mkdir -p \$(dirname '${remote_path}') && cat > '${remote_path}' && chmod +x '${remote_path}'"
}

# -----------------------------------------------------------------------------
# Snippet Contents Generation
# -----------------------------------------------------------------------------
get_bastion_overlay_snippet() {
  printf '%s\n' \
'#!/usr/bin/env bash' \
'set -euo pipefail' \
'export DEBIAN_FRONTEND=noninteractive' \
'' \
"TARGET_HOSTNAME='${VM_NAME}'" \
'if [ -n "${TARGET_HOSTNAME}" ]; then' \
'  echo "=== [0/5] Setting guest hostname to ${TARGET_HOSTNAME} ==="' \
'  hostnamectl set-hostname "${TARGET_HOSTNAME}" || hostname "${TARGET_HOSTNAME}"' \
'  sed -i "s/127\.0\.1\.1.*/127.0.1.1 ${TARGET_HOSTNAME}/" /etc/hosts || true' \
'  if ! grep -q "127.0.1.1" /etc/hosts; then' \
'    echo "127.0.1.1 ${TARGET_HOSTNAME}" >> /etc/hosts' \
'  fi' \
'fi' \
'' \
'NKP_USER="nkpadmin"' \
'NKP_HOME="/home/${NKP_USER}"' \
'' \
'echo "=== [1/5] Installing prerequisite packages ==="' \
'apt-get update -y' \
'apt-get install -y --no-install-recommends \' \
'  nfs-common \' \
'  curl \' \
'  wget \' \
'  jq \' \
'  git \' \
'  python3-pip \' \
'  python3-venv \' \
'  htop \' \
'  tree \' \
'  ca-certificates \' \
'  gnupg \' \
'  lsb-release' \
'' \
'echo "=== [2/5] Installing Docker CE and compose plugin ==="' \
'if ! command -v docker >/dev/null 2>&1; then' \
'  install -m 0755 -d /etc/apt/keyrings' \
'  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc' \
'  chmod a+r /etc/apt/keyrings/docker.asc' \
'  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list' \
'  apt-get update -y' \
'  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin' \
'fi' \
'systemctl enable --now docker' \
'usermod -aG docker "${NKP_USER}"' \
'' \
'echo "=== [3/5] Installing kubectl ==="' \
'if ! command -v kubectl >/dev/null 2>&1; then' \
'  K8S_STABLE=$(curl -L -s https://dl.k8s.io/release/stable.txt)' \
'  curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/${K8S_STABLE}/bin/linux/amd64/kubectl"' \
'  chmod +x /usr/local/bin/kubectl' \
'fi' \
'' \
'echo "=== [4/5] Installing Helm ==="' \
'if ! command -v helm >/dev/null 2>&1; then' \
'  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash' \
'fi' \
'' \
'echo "=== [5/5] Creating Forge Central directories ==="' \
'mkdir -p "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/forge-data" "${NKP_HOME}/cacrt"' \
'chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/forge-central"' \
'chown -R 1000:"${NKP_USER}" "${NKP_HOME}/forge-state" "${NKP_HOME}/forge-data" "${NKP_HOME}/cacrt"' \
'chmod -R 2775 "${NKP_HOME}/forge-state" "${NKP_HOME}/forge-data" "${NKP_HOME}/cacrt"' \
'' \
'mkdir -p /var/cloud-init' \
'touch /var/cloud-init/SUCCESS' \
'echo "=== Bastion cloud-init overlay complete ==="'
}

get_unified_init_snippet() {
  # $1 = "mask" redacts the private key payload (used for human-readable output).
  local priv_b64="${SSH_PRIVATE_KEY_B64}"
  if [[ "${1:-}" == "mask" && -n "${priv_b64}" ]]; then
    priv_b64="<BASE64_OF_YOUR_PRIVATE_KEY>"
  fi
  printf '%s\n' \
'#!/usr/bin/env bash' \
'set -euo pipefail' \
'export DEBIAN_FRONTEND=noninteractive' \
'' \
"TARGET_HOSTNAME='${VM_NAME}'" \
'if [ -n "${TARGET_HOSTNAME}" ]; then' \
'  echo "=== [0/8] Setting guest hostname to ${TARGET_HOSTNAME} ==="' \
'  hostnamectl set-hostname "${TARGET_HOSTNAME}" || hostname "${TARGET_HOSTNAME}"' \
'  sed -i "s/127\.0\.1\.1.*/127.0.1.1 ${TARGET_HOSTNAME}/" /etc/hosts || true' \
'  if ! grep -q "127.0.1.1" /etc/hosts; then' \
'    echo "127.0.1.1 ${TARGET_HOSTNAME}" >> /etc/hosts' \
'  fi' \
'fi' \
'' \
'NKP_USER="nkpadmin"' \
'NKP_PASS="Nutanix.123"' \
'NKP_HOME="/home/${NKP_USER}"' \
'NKP_SSH_DIR="${NKP_HOME}/.ssh"' \
'' \
'echo "=== [1/8] Configuring user ${NKP_USER} and sudo ==="' \
'if ! id "${NKP_USER}" >/dev/null 2>&1; then' \
'  useradd --create-home --shell /bin/bash "${NKP_USER}"' \
'fi' \
'echo "${NKP_USER}:${NKP_PASS}" | chpasswd' \
'' \
'echo "${NKP_USER} ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/${NKP_USER}"' \
'chmod 0440 "/etc/sudoers.d/${NKP_USER}"' \
'' \
'echo "=== [2/8] Hardening SSH and staging credentials ==="' \
'rm -f /etc/ssh/sshd_config.d/60-cloudimg-settings.conf' \
'sed -i "s/^#PasswordAuthentication.*/PasswordAuthentication yes/" /etc/ssh/sshd_config' \
'sed -i "s/^PasswordAuthentication no/PasswordAuthentication yes/" /etc/ssh/sshd_config' \
'if ! grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config; then' \
'  echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config' \
'fi' \
'systemctl restart ssh || systemctl restart sshd' \
'' \
'mkdir -p "${NKP_SSH_DIR}"' \
'chmod 755 "${NKP_SSH_DIR}"' \
'' \
"NKP_PRIV_KEY_B64='${priv_b64}'" \
"NKP_PAIR_PUB_B64='${SSH_PAIR_PUB_B64}'" \
"NKP_AUTH_PUB_B64='${SSH_AUTH_PUB_B64}'" \
'' \
'add_authorized_key() {' \
'  grep -qxF "$1" "${NKP_SSH_DIR}/authorized_keys" 2>/dev/null || echo "$1" >> "${NKP_SSH_DIR}/authorized_keys"' \
'}' \
'touch "${NKP_SSH_DIR}/authorized_keys"' \
'' \
'if [ -n "${NKP_PRIV_KEY_B64}" ]; then' \
'  echo "Staging operator-supplied SSH private key as ${NKP_SSH_DIR}/id_nkpadmin_ecdsa"' \
'  echo "${NKP_PRIV_KEY_B64}" | base64 -d > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa"' \
'  chmod 600 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa"' \
'  if [ -n "${NKP_PAIR_PUB_B64}" ]; then' \
'    echo "${NKP_PAIR_PUB_B64}" | base64 -d > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub"' \
'  else' \
'    ssh-keygen -y -P "" -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" </dev/null' \
'  fi' \
'elif [ ! -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" ]; then' \
'  echo "No SSH private key supplied; generating a fresh ECDSA keypair in the guest"' \
'  rm -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub"' \
'  ssh-keygen -t ecdsa -b 256 -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" -N "" -C "nkpadmin@forge-central"' \
'fi' \
'' \
'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa"' \
'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"' \
'add_authorized_key "$(cat "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub")"' \
'if [ -n "${NKP_AUTH_PUB_B64}" ]; then' \
'  add_authorized_key "$(echo "${NKP_AUTH_PUB_B64}" | base64 -d)"' \
'fi' \
'unset NKP_PRIV_KEY_B64' \
'' \
'printf "%s\n" "Host *" "    StrictHostKeyChecking no" "    UserKnownHostsFile /dev/null" "    LogLevel ERROR" > "${NKP_SSH_DIR}/config"' \
'' \
'chmod 600 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa" "${NKP_SSH_DIR}/config"' \
'chmod 644 "${NKP_SSH_DIR}/authorized_keys" "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"' \
'chown -R "${NKP_USER}:${NKP_USER}" "${NKP_SSH_DIR}"' \
'' \
'mkdir -p "${NKP_HOME}/ssh-key"' \
'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_HOME}/ssh-key/"' \
'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_HOME}/ssh-key/"' \
'chmod 700 "${NKP_HOME}/ssh-key"' \
'chmod 600 "${NKP_HOME}/ssh-key/id_nkpadmin_ecdsa"' \
'chmod 644 "${NKP_HOME}/ssh-key/id_nkpadmin_ecdsa.pub"' \
'chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/ssh-key"' \
'' \
'echo "=== [3/8] Disabling UFW, swap, and IPv6 ==="' \
'ufw disable 2>/dev/null || true' \
'systemctl disable --now ufw 2>/dev/null || true' \
'' \
'swapoff -a || true' \
'sed -i "/swap/d" /etc/fstab || true' \
'' \
'printf "%s\n" "net.ipv6.conf.all.disable_ipv6 = 1" "net.ipv6.conf.default.disable_ipv6 = 1" "net.ipv6.conf.lo.disable_ipv6 = 1" > /etc/sysctl.d/99-disable-ipv6.conf' \
'sysctl -p /etc/sysctl.d/99-disable-ipv6.conf || true' \
'' \
'echo "=== [4/8] Installing base packages and guest agent ==="' \
'apt-get update -y' \
'apt-get install -y --no-install-recommends \' \
'  qemu-guest-agent \' \
'  open-iscsi \' \
'  nfs-common \' \
'  curl \' \
'  wget \' \
'  jq \' \
'  git \' \
'  python3-pip \' \
'  python3-venv \' \
'  htop \' \
'  tree \' \
'  ca-certificates \' \
'  gnupg \' \
'  lsb-release' \
'' \
'systemctl enable --now qemu-guest-agent' \
'' \
'echo "=== [5/8] Installing Docker CE and compose plugin ==="' \
'if ! command -v docker >/dev/null 2>&1; then' \
'  install -m 0755 -d /etc/apt/keyrings' \
'  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc' \
'  chmod a+r /etc/apt/keyrings/docker.asc' \
'  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list' \
'  apt-get update -y' \
'  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin' \
'fi' \
'systemctl enable --now docker' \
'usermod -aG docker "${NKP_USER}"' \
'' \
'echo "=== [6/8] Installing kubectl ==="' \
'if ! command -v kubectl >/dev/null 2>&1; then' \
'  K8S_STABLE=$(curl -L -s https://dl.k8s.io/release/stable.txt)' \
'  curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/${K8S_STABLE}/bin/linux/amd64/kubectl"' \
'  chmod +x /usr/local/bin/kubectl' \
'fi' \
'' \
'echo "=== [7/8] Installing Helm ==="' \
'if ! command -v helm >/dev/null 2>&1; then' \
'  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash' \
'fi' \
'' \
'echo "=== [8/8] Setting up Forge Central directories ==="' \
'mkdir -p "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/forge-data" "${NKP_HOME}/cacrt"' \
'chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/forge-central"' \
'chown -R 1000:"${NKP_USER}" "${NKP_HOME}/forge-state" "${NKP_HOME}/forge-data" "${NKP_HOME}/cacrt"' \
'chmod -R 2775 "${NKP_HOME}/forge-state" "${NKP_HOME}/forge-data" "${NKP_HOME}/cacrt"' \
'' \
'mkdir -p /var/cloud-init' \
'touch /var/cloud-init/SUCCESS' \
'echo "=== Unified cloud-init initialization complete ==="'
}

get_cloudinit_meta_snippet() {
  printf '%s\n' \
"instance-id: ${VM_NAME}" \
"local-hostname: ${VM_NAME}"
}

# -----------------------------------------------------------------------------
# Print Manual Steps
# -----------------------------------------------------------------------------
print_manual_runbook() {
  printf '%s\n' \
"================================================================================" \
" FORGE CENTRAL MANUAL PROXMOX PROVISIONING RUNBOOK" \
" Target Proxmox Host: ${PVE_USER}@${PVE_HOST}" \
" Target VMID:         ${VMID} (${VM_NAME})" \
" Resources:           ${CORES} vCPU, ${MEMORY} MB RAM, ${DISK} Disk, ${STORAGE} Storage" \
" Network:             Bridge ${BRIDGE}, IP: ${IP_CONFIG}" \
" DNS:                 nameserver=${NAMESERVER:-(none)} searchdomain=${SEARCHDOMAIN:-(none)}" \
"================================================================================" \
"" \
"SSH KEY OPTIONS (no keys are hardcoded in this script; pick one):" \
"  a) Key files:      --ssh-key-file ~/.ssh/id_nkpadmin_ecdsa --ssh-pubkey-file ~/.ssh/id_nkpadmin_ecdsa.pub" \
"                     (env: FORGE_SSH_KEY_FILE, FORGE_SSH_PUBKEY_FILE)" \
"  b) Inline content: --ssh-private-key \"\$(cat <private-key>)\" --ssh-public-key \"\$(cat <public-key>)\"" \
"                     (env: FORGE_SSH_PRIVATE_KEY, FORGE_SSH_PUBLIC_KEY)" \
"  c) Auto-detect:    with no public key given, ~/.ssh/id_ed25519.pub, id_ecdsa.pub or id_rsa.pub is authorized" \
"  d) Generate:       with no private key given, the VM generates an ECDSA keypair on first boot:" \
"                     ssh-keygen -t ecdsa -b 256 -f ~/.ssh/id_nkpadmin_ecdsa -N \"\" -C \"nkpadmin@forge-central\"" \
"  Password login (nkpadmin / Nutanix.123) stays enabled, so 'ssh-copy-id nkpadmin@<ASSIGNED_IP>' always works." \
"  Public key resolved for this run: ${SSH_PUBKEY_SOURCE}; private key: $([[ -n "${SSH_PRIVATE_KEY_B64}" ]] && echo 'operator-supplied (masked below)' || echo 'generated in guest')" \
"  In the unified snippet below, NKP_PRIV_KEY_B64 is the base64 of your private key:" \
"  replace <BASE64_OF_YOUR_PRIVATE_KEY> with: base64 < ~/.ssh/id_nkpadmin_ecdsa | tr -d '\\n'  (or leave '' to generate in guest)." \
""

  if [[ "${MODE}" == "clone" || "${MODE}" == "auto" ]]; then
    printf '%s\n' \
"--------------------------------------------------------------------------------" \
"OPTION A: CLONE FROM GOLDEN TEMPLATE (VMID ${TEMPLATE_VMID})" \
"--------------------------------------------------------------------------------" \
"Run these commands on Proxmox VE (${PVE_HOST}):" \
"" \
"1. Verify golden template exists:" \
"   qm status ${TEMPLATE_VMID}" \
"" \
"2. Full clone template into VM ${VMID}:" \
"   qm clone ${TEMPLATE_VMID} ${VMID} --name ${VM_NAME} --full 1 --storage ${STORAGE}" \
"" \
"3. Configure hardware, network, and QEMU guest agent:" \
"   qm set ${VMID} --cores ${CORES} --memory ${MEMORY} --net0 virtio,bridge=${BRIDGE} --agent enabled=1${DNS_OPTS} --ipconfig0 ip=${IP_CONFIG}" \
"" \
"4. Create the bastion overlay snippet at ${OVERLAY_SNIPPET_PATH} and meta snippet at ${META_SNIPPET_PATH}:" \
"   mkdir -p ${SNIPPET_DIR}" \
"   cat << 'EOF_OVERLAY' > ${OVERLAY_SNIPPET_PATH}" \
"$(get_bastion_overlay_snippet)" \
"EOF_OVERLAY" \
"   chmod +x ${OVERLAY_SNIPPET_PATH}" \
"   cat << 'EOF_META' > ${META_SNIPPET_PATH}" \
"$(get_cloudinit_meta_snippet)" \
"EOF_META" \
"" \
"5. Attach snippets to VM ${VMID} cloud-init:" \
"   qm set ${VMID} --cicustom user=local:snippets/${OVERLAY_SNIPPET_NAME},meta=local:snippets/${META_SNIPPET_NAME}" \
"" \
"6. Power on the VM:" \
"   qm start ${VMID}" \
"" \
"7. Verify guest agent and fetch IP:" \
"   qm guest cmd ${VMID} ping" \
"   qm guest cmd ${VMID} network-get-interfaces" \
""
  fi

  if [[ "${MODE}" == "scratch" || "${MODE}" == "auto" ]]; then
    printf '%s\n' \
"--------------------------------------------------------------------------------" \
"OPTION B: SCRATCH BRING-UP (NO GOLDEN TEMPLATE - UBUNTU 24.04 CLOUD IMAGE)" \
"--------------------------------------------------------------------------------" \
"Run these commands on Proxmox VE (${PVE_HOST}):" \
"" \
"1. Download Ubuntu 24.04 LTS cloud image (idempotent):" \
"   mkdir -p ${UBUNTU_IMG_DIR}" \
"   wget -N -P ${UBUNTU_IMG_DIR} ${UBUNTU_IMG_URL}" \
"" \
"2. Create base VM shell:" \
"   qm create ${VMID} --name ${VM_NAME} --memory ${MEMORY} --cores ${CORES} --cpu host --machine q35 --net0 virtio,bridge=${BRIDGE} --ostype l26 --agent enabled=1 --serial0 socket --vga serial0 --boot order=scsi0" \
"" \
"3. Import cloud disk image into ${STORAGE}:" \
"   qm importdisk ${VMID} ${UBUNTU_IMG_PATH} ${STORAGE}" \
"" \
"4. Attach disk and cloud-init drive:" \
"   qm set ${VMID} --scsihw virtio-scsi-single --scsi0 ${STORAGE}:vm-${VMID}-disk-0,discard=on,ssd=1" \
"   qm resize ${VMID} scsi0 ${DISK}" \
"   qm set ${VMID} --ide2 ${STORAGE}:cloudinit${DNS_OPTS} --ipconfig0 ip=${IP_CONFIG}" \
"" \
"5. Create unified cloud-init initialization snippet at ${UNIFIED_SNIPPET_PATH} and meta snippet at ${META_SNIPPET_PATH}:" \
"   mkdir -p ${SNIPPET_DIR}" \
"   cat << 'EOF_UNIFIED' > ${UNIFIED_SNIPPET_PATH}" \
"$(get_unified_init_snippet mask)" \
"EOF_UNIFIED" \
"   chmod +x ${UNIFIED_SNIPPET_PATH}" \
"   cat << 'EOF_META' > ${META_SNIPPET_PATH}" \
"$(get_cloudinit_meta_snippet)" \
"EOF_META" \
"" \
"6. Attach snippets to VM ${VMID} cloud-init:" \
"   qm set ${VMID} --cicustom user=local:snippets/${UNIFIED_SNIPPET_NAME},meta=local:snippets/${META_SNIPPET_NAME}" \
"" \
"7. Power on the VM:" \
"   qm start ${VMID}" \
"" \
"8. Verify guest agent and fetch IP:" \
"   qm guest cmd ${VMID} ping" \
"   qm guest cmd ${VMID} network-get-interfaces" \
""
  fi

  printf '%s\n' \
"--------------------------------------------------------------------------------" \
"DAY-1 POST-BOOTSTRAP VERIFICATION" \
"--------------------------------------------------------------------------------" \
"1. SSH login:" \
"   ssh nkpadmin@<ASSIGNED_IP>                      # uses your authorized public key" \
"   ssh -i ~/.ssh/id_nkpadmin_ecdsa nkpadmin@<ASSIGNED_IP>   # if you supplied this keypair" \
"   # or with password Nutanix.123 (and push your key: ssh-copy-id nkpadmin@<ASSIGNED_IP>):" \
"   ssh nkpadmin@<ASSIGNED_IP>" \
"" \
"2. Verify runtime packages in guest:" \
"   docker --version" \
"   docker compose version" \
"   docker ps" \
"   kubectl version --client" \
"   helm version" \
"   ls -la /home/nkpadmin/forge-central" \
"" \
"3. Code Sync & Service Bring-Up:" \
"   rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' ./ nkpadmin@<ASSIGNED_IP>:/home/nkpadmin/forge-central/" \
"   ssh nkpadmin@<ASSIGNED_IP> \"cd /home/nkpadmin/forge-central && docker compose up -d\"" \
"================================================================================"
}

if [[ "${PRINT_MANUAL_STEPS}" == "true" ]]; then
  print_manual_runbook
  exit 0
fi

# -----------------------------------------------------------------------------
# Execution Workflow
# -----------------------------------------------------------------------------
echo "================================================================================"
echo " Starting Forge Central VM Bootstrap"
echo " Target Host:   ${PVE_USER}@${PVE_HOST}"
echo " Mode:          ${MODE}"
echo " Target VMID:   ${VMID} (${VM_NAME})"
echo " Resources:     ${CORES} cores, ${MEMORY} MB RAM, ${DISK} disk"
echo " Network:       ${BRIDGE} bridge, IP: ${IP_CONFIG}"
echo " SSH Pubkey:    ${SSH_PUBKEY_SOURCE}"
if [[ -n "${SSH_PRIVATE_KEY_B64}" ]]; then
  echo " SSH Privkey:   operator-supplied (content not printed)"
else
  echo " SSH Privkey:   none supplied; will generate ECDSA keypair in guest"
fi
echo " DNS:           nameserver=${NAMESERVER:-(none)} searchdomain=${SEARCHDOMAIN:-(none)}"
echo " Dry Run:       ${DRY_RUN}"
echo "================================================================================"

# Wizard pre-flight: probe SSH to Proxmox (password / ssh-copy-id / sshpass fallback) if not already done.
if [[ "${DRY_RUN}" != "true" && -z "${PVE_PASSWORD}" && "${PVE_USE_SSHPASS}" != "true" ]]; then
  preflight_pve_connectivity
fi

# Resolve Mode if Auto
SELECTED_MODE="${MODE}"
if [[ "${MODE}" == "auto" ]]; then
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] Checking golden template VMID ${TEMPLATE_VMID} via: ssh ${PVE_USER}@${PVE_HOST} 'qm status ${TEMPLATE_VMID}'"
    echo "[dry-run] Simulating auto-detection: golden template VMID ${TEMPLATE_VMID} found -> selecting 'clone' mode."
    SELECTED_MODE="clone"
  else
    echo "Auto-detecting golden template VMID ${TEMPLATE_VMID} on ${PVE_HOST}..."
    if pve_ssh "qm status ${TEMPLATE_VMID}" >/dev/null 2>&1; then
      echo "Golden template VMID ${TEMPLATE_VMID} found. Using Option A (clone)."
      SELECTED_MODE="clone"
    else
      echo "Golden template VMID ${TEMPLATE_VMID} not found. Falling back to Option B (scratch bring-up)."
      SELECTED_MODE="scratch"
    fi
  fi
fi

# Validate target VMID does not already exist
if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[dry-run] Checking target VMID ${VMID} availability via: ssh ${PVE_USER}@${PVE_HOST} 'qm status ${VMID}'"
else
  if pve_ssh "qm status ${VMID}" >/dev/null 2>&1; then
    echo "ERROR: Target VMID ${VMID} already exists on ${PVE_HOST}. Refusing to overwrite existing VM." >&2
    echo "Fix: Pass a different --vmid or destroy VM ${VMID} manually on Proxmox first." >&2
    exit 1
  fi
fi

# -----------------------------------------------------------------------------
# Execute Option A: Clone
# -----------------------------------------------------------------------------
if [[ "${SELECTED_MODE}" == "clone" ]]; then
  echo "--- Step 1: Validating golden template VMID ${TEMPLATE_VMID} ---"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} 'qm status ${TEMPLATE_VMID}'"
  else
    if ! pve_ssh "qm status ${TEMPLATE_VMID}" >/dev/null 2>&1; then
      echo "ERROR: Golden template VMID ${TEMPLATE_VMID} does not exist on ${PVE_HOST}." >&2
      exit 1
    fi
  fi

  echo "--- Step 2: Cloning template ${TEMPLATE_VMID} -> ${VMID} (${VM_NAME}) ---"
  run_ssh "qm clone ${TEMPLATE_VMID} ${VMID} --name ${VM_NAME} --full 1 --storage ${STORAGE}"

  echo "--- Step 3: Configuring VM hardware and network ---"
  run_ssh "qm set ${VMID} --cores ${CORES} --memory ${MEMORY} --net0 virtio,bridge=${BRIDGE} --agent enabled=1${DNS_OPTS} --ipconfig0 ip=${IP_CONFIG}"

  echo "--- Step 4: Generating and uploading bastion overlay and meta snippets ---"
  OVERLAY_CONTENT="$(get_bastion_overlay_snippet)"
  upload_snippet "${OVERLAY_SNIPPET_PATH}" "${OVERLAY_CONTENT}"
  META_CONTENT="$(get_cloudinit_meta_snippet)"
  upload_snippet "${META_SNIPPET_PATH}" "${META_CONTENT}"
  run_ssh "qm set ${VMID} --cicustom user=local:snippets/${OVERLAY_SNIPPET_NAME},meta=local:snippets/${META_SNIPPET_NAME}"

  echo "--- Step 5: Powering on VM ${VMID} ---"
  run_ssh "qm start ${VMID}"
fi

# -----------------------------------------------------------------------------
# Execute Option B: Scratch Bring-Up
# -----------------------------------------------------------------------------
if [[ "${SELECTED_MODE}" == "scratch" ]]; then
  echo "--- Step 1: Downloading Ubuntu 24.04 LTS cloud image on Proxmox VE ---"
  run_ssh "mkdir -p ${UBUNTU_IMG_DIR}"
  run_ssh "wget -N -P ${UBUNTU_IMG_DIR} ${UBUNTU_IMG_URL}"

  echo "--- Step 2: Creating base VM shell ---"
  run_ssh "qm create ${VMID} --name ${VM_NAME} --memory ${MEMORY} --cores ${CORES} --cpu host --machine q35 --net0 virtio,bridge=${BRIDGE} --ostype l26 --agent enabled=1 --serial0 socket --vga serial0 --boot order=scsi0"

  echo "--- Step 3: Importing cloud disk image ---"
  run_ssh "qm importdisk ${VMID} ${UBUNTU_IMG_PATH} ${STORAGE}"

  echo "--- Step 4: Attaching disk and cloud-init drive ---"
  run_ssh "qm set ${VMID} --scsihw virtio-scsi-single --scsi0 ${STORAGE}:vm-${VMID}-disk-0,discard=on,ssd=1"
  run_ssh "qm resize ${VMID} scsi0 ${DISK}"
  run_ssh "qm set ${VMID} --ide2 ${STORAGE}:cloudinit${DNS_OPTS} --ipconfig0 ip=${IP_CONFIG}"

  echo "--- Step 5: Generating and uploading unified cloud-init and meta snippets ---"
  UNIFIED_CONTENT="$(get_unified_init_snippet)"
  upload_snippet "${UNIFIED_SNIPPET_PATH}" "${UNIFIED_CONTENT}"
  META_CONTENT="$(get_cloudinit_meta_snippet)"
  upload_snippet "${META_SNIPPET_PATH}" "${META_CONTENT}"
  run_ssh "qm set ${VMID} --cicustom user=local:snippets/${UNIFIED_SNIPPET_NAME},meta=local:snippets/${META_SNIPPET_NAME}"

  echo "--- Step 6: Powering on VM ${VMID} ---"
  run_ssh "qm start ${VMID}"
fi

# -----------------------------------------------------------------------------
# Step 6: Wait for Guest Agent and Retrieve IP
# -----------------------------------------------------------------------------
echo "--- Waiting for QEMU guest agent & IP address ---"
ASSIGNED_IP=""

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} 'qm guest cmd ${VMID} ping'"
  echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} 'qm guest cmd ${VMID} network-get-interfaces'"
  ASSIGNED_IP="10.123.238.150"
  echo "[dry-run] Discovered IP: ${ASSIGNED_IP} (simulated)"
else
  START_TS=$(date +%s)
  echo "Polling guest agent on VM ${VMID} (timeout: ${GUEST_AGENT_TIMEOUT}s)..."

  while true; do
    if PVE_SSH_TIMEOUT=5 pve_ssh "qm guest cmd ${VMID} ping" >/dev/null 2>&1; then
      ASSIGNED_IP=$(PVE_SSH_TIMEOUT=5 pve_ssh "qm guest cmd ${VMID} network-get-interfaces" 2>/dev/null \
        | grep -Eo '\"ip-address\" *: *\"[0-9.]+\"' \
        | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' \
        | grep -v '^127\.' \
        | head -n1 || true)

      if [[ -n "${ASSIGNED_IP}" ]]; then
        break
      fi
    fi

    ELAPSED=$(( $(date +%s) - START_TS ))
    if [[ "${ELAPSED}" -ge "${GUEST_AGENT_TIMEOUT}" ]]; then
      echo "WARNING: Timed out after ${ELAPSED}s waiting for guest agent network interfaces." >&2
      break
    fi
    sleep 5
  done
fi

echo ""
echo "================================================================================"
echo " Forge Central VM Provisioning Complete!"
echo "================================================================================"
echo "  VMID:         ${VMID}"
echo "  VM Name:      ${VM_NAME}"
echo "  Proxmox Host: ${PVE_HOST}"
if [[ -n "${ASSIGNED_IP}" ]]; then
  echo "  Assigned IP:  ${ASSIGNED_IP}"
  echo "  SSH Command:  ssh nkpadmin@${ASSIGNED_IP}"
else
  echo "  Assigned IP:  (Pending DHCP lease; run: ssh ${PVE_USER}@${PVE_HOST} 'qm guest cmd ${VMID} network-get-interfaces')"
  echo "  SSH Command:  ssh nkpadmin@<assigned-ip>"
fi
echo "  Default Pass: Nutanix.123"
if [[ -n "${SSH_PRIVATE_KEY_B64}" ]]; then
  echo "  SSH Key:      operator-supplied key staged as ~/.ssh/id_nkpadmin_ecdsa"
else
  echo "  SSH Key:      generated in guest; fetch with: scp nkpadmin@<ip>:.ssh/id_nkpadmin_ecdsa ~/.ssh/"
fi
echo "  Authorized:   ${SSH_PUBKEY_SOURCE} (+ VM keypair); password login enabled (ssh-copy-id works)"
echo "================================================================================"
echo ""
echo "Next steps:"
if [[ -n "${ASSIGNED_IP}" ]]; then
  echo "  1. Sync Forge Central code:"
  echo "     rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' ./ nkpadmin@${ASSIGNED_IP}:/home/nkpadmin/forge-central/"
  echo "  2. Start services:"
  echo "     ssh nkpadmin@${ASSIGNED_IP} 'cd /home/nkpadmin/forge-central && docker compose up -d'"
else
  echo "  1. Sync Forge Central code once IP is known:"
  echo "     rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' ./ nkpadmin@<ip>:/home/nkpadmin/forge-central/"
fi
echo "================================================================================"
