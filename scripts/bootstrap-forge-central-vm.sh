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
DISK="${VM_DISK:-${DISK_SIZE:-60G}}"
STORAGE="${STORAGE_POOL:-local-lvm}"
BRIDGE="${NETWORK_BRIDGE:-vmbr0}"
IP_CONFIG="${VM_IP:-dhcp}"
DRY_RUN=false
PRINT_MANUAL_STEPS=false
GUEST_AGENT_TIMEOUT="${GUEST_AGENT_TIMEOUT:-900}"

UBUNTU_IMG_NAME="ubuntu-24.04-server-cloudimg-amd64.img"
UBUNTU_IMG_DIR="/var/lib/vz/template/iso"
UBUNTU_IMG_PATH="${UBUNTU_IMG_DIR}/${UBUNTU_IMG_NAME}"
UBUNTU_IMG_URL="https://cloud-images.ubuntu.com/releases/24.04/release/${UBUNTU_IMG_NAME}"

SNIPPET_DIR="/var/lib/vz/snippets"
OVERLAY_SNIPPET_NAME="nkp-bastion-overlay.sh"
OVERLAY_SNIPPET_PATH="${SNIPPET_DIR}/${OVERLAY_SNIPPET_NAME}"
UNIFIED_SNIPPET_NAME="forge-central-unified-init.sh"
UNIFIED_SNIPPET_PATH="${SNIPPET_DIR}/${UNIFIED_SNIPPET_NAME}"

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
"  --pve-host <ip|hostname>  Target Proxmox host IP/hostname (default: 10.123.238.110 or PVE_CLUSTER_HOST)" \
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
"  --disk <size>             Disk size for VM (default: 60G or VM_DISK)" \
"  --storage <pool>          Proxmox storage pool (default: local-lvm or STORAGE_POOL)" \
"  --bridge <bridge>         Proxmox virtual network bridge (default: vmbr0 or NETWORK_BRIDGE)" \
"  --ip <cidr_or_dhcp>       IP configuration, e.g. 'dhcp' or '10.123.238.150/24,gw=10.123.238.1' (default: dhcp)" \
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
"  # Dry-run inspection" \
"  ./scripts/bootstrap-forge-central-vm.sh --dry-run --mode scratch" \
"" \
"  # Print copy-pasteable manual SOP commands" \
"  ./scripts/bootstrap-forge-central-vm.sh --print-manual-steps --mode clone"
}

# -----------------------------------------------------------------------------
# Parse CLI Arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pve-host)
      PVE_HOST="${2:?--pve-host requires a value}"
      shift 2
      ;;
    --pve-host=*)
      PVE_HOST="${1#--pve-host=}"
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
      shift 2
      ;;
    --vm-name=*)
      VM_NAME="${1#--vm-name=}"
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

# -----------------------------------------------------------------------------
# Remote Command Execution Helpers
# -----------------------------------------------------------------------------
run_ssh() {
  local cmd="$1"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} '${cmd}'"
    return 0
  fi
  ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${PVE_USER}@${PVE_HOST}" "${cmd}"
}

upload_snippet() {
  local remote_path="$1"
  local content="$2"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] ssh ${PVE_USER}@${PVE_HOST} 'cat > ${remote_path}'"
    return 0
  fi
  printf '%s' "${content}" | ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${PVE_USER}@${PVE_HOST}" \
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
'mkdir -p "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"' \
'chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"' \
'' \
'mkdir -p /var/cloud-init' \
'touch /var/cloud-init/SUCCESS' \
'echo "=== Bastion cloud-init overlay complete ==="'
}

get_unified_init_snippet() {
  printf '%s\n' \
'#!/usr/bin/env bash' \
'set -euo pipefail' \
'export DEBIAN_FRONTEND=noninteractive' \
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
'chmod 700 "${NKP_SSH_DIR}"' \
'' \
'cat > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" <<\PRIV_KEY_EOF' \
'-----BEGIN OPENSSH PRIVATE KEY-----' \
'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAaAAAABNlY2RzYS' \
'1zaGEyLW5pc3RwMjU2AAAACG5pc3RwMjU2AAAAQQQqWmeNGmS+KNY6NNDwRVGZn+cs+ZuV' \
'+Bq1SlrvSyEKpRxGqU3sV8J3Hetjz1kOxGK+NvlK+bJwMEIRDI2pH3t5AAAAsBhjcl4YY3' \
'JeAAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBCpaZ40aZL4o1jo0' \
'0PBFUZmf5yz5m5X4GrVKWu9LIQqlHEapTexXwncd62PPWQ7EYr42+Ur5snAwQhEMjakfe3' \
'kAAAAhAMsXpe9exqAeexKC29wavVk6EBg6IjV2KTRn1od/rn9IAAAAFG5rcGFkbWluQG51' \
'dGFuaXguY29tAQID' \
'-----END OPENSSH PRIVATE KEY-----' \
'PRIV_KEY_EOF' \
'' \
'echo "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBCpaZ40aZL4o1jo00PBFUZmf5yz5m5X4GrVKWu9LIQqlHEapTexXwncd62PPWQ7EYr42+Ur5snAwQhEMjakfe3k= nkpadmin@nutanix.com" > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub"' \
'' \
'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa"' \
'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"' \
'cat "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" >> "${NKP_SSH_DIR}/authorized_keys"' \
'' \
'printf "%s\n" "Host *" "    StrictHostKeyChecking no" "    UserKnownHostsFile /dev/null" "    LogLevel ERROR" > "${NKP_SSH_DIR}/config"' \
'' \
'chmod 600 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa" "${NKP_SSH_DIR}/authorized_keys" "${NKP_SSH_DIR}/config"' \
'chmod 644 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"' \
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
'mkdir -p "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"' \
'chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"' \
'' \
'mkdir -p /var/cloud-init' \
'touch /var/cloud-init/SUCCESS' \
'echo "=== Unified cloud-init initialization complete ==="'
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
"================================================================================" \
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
"   qm set ${VMID} --cores ${CORES} --memory ${MEMORY} --net0 virtio,bridge=${BRIDGE} --agent enabled=1 --ipconfig0 ip=${IP_CONFIG}" \
"" \
"4. Create the bastion overlay snippet at ${OVERLAY_SNIPPET_PATH}:" \
"   mkdir -p ${SNIPPET_DIR}" \
"   cat << 'EOF_OVERLAY' > ${OVERLAY_SNIPPET_PATH}" \
"$(get_bastion_overlay_snippet)" \
"EOF_OVERLAY" \
"   chmod +x ${OVERLAY_SNIPPET_PATH}" \
"" \
"5. Attach snippet to VM ${VMID} cloud-init:" \
"   qm set ${VMID} --cicustom user=local:snippets/${OVERLAY_SNIPPET_NAME}" \
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
"   qm set ${VMID} --ide2 ${STORAGE}:cloudinit --ipconfig0 ip=${IP_CONFIG}" \
"" \
"5. Create unified cloud-init initialization snippet at ${UNIFIED_SNIPPET_PATH}:" \
"   mkdir -p ${SNIPPET_DIR}" \
"   cat << 'EOF_UNIFIED' > ${UNIFIED_SNIPPET_PATH}" \
"$(get_unified_init_snippet)" \
"EOF_UNIFIED" \
"   chmod +x ${UNIFIED_SNIPPET_PATH}" \
"" \
"6. Attach unified snippet to VM ${VMID} cloud-init:" \
"   qm set ${VMID} --cicustom user=local:snippets/${UNIFIED_SNIPPET_NAME}" \
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
"   ssh -i ~/.ssh/id_nkpadmin_ecdsa nkpadmin@<ASSIGNED_IP>" \
"   # or with password Nutanix.123:" \
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
echo " Dry Run:       ${DRY_RUN}"
echo "================================================================================"

# Resolve Mode if Auto
SELECTED_MODE="${MODE}"
if [[ "${MODE}" == "auto" ]]; then
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[dry-run] Checking golden template VMID ${TEMPLATE_VMID} via: ssh ${PVE_USER}@${PVE_HOST} 'qm status ${TEMPLATE_VMID}'"
    echo "[dry-run] Simulating auto-detection: golden template VMID ${TEMPLATE_VMID} found -> selecting 'clone' mode."
    SELECTED_MODE="clone"
  else
    echo "Auto-detecting golden template VMID ${TEMPLATE_VMID} on ${PVE_HOST}..."
    if ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${PVE_USER}@${PVE_HOST}" "qm status ${TEMPLATE_VMID}" >/dev/null 2>&1; then
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
  if ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${PVE_USER}@${PVE_HOST}" "qm status ${VMID}" >/dev/null 2>&1; then
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
    if ! ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${PVE_USER}@${PVE_HOST}" "qm status ${TEMPLATE_VMID}" >/dev/null 2>&1; then
      echo "ERROR: Golden template VMID ${TEMPLATE_VMID} does not exist on ${PVE_HOST}." >&2
      exit 1
    fi
  fi

  echo "--- Step 2: Cloning template ${TEMPLATE_VMID} -> ${VMID} (${VM_NAME}) ---"
  run_ssh "qm clone ${TEMPLATE_VMID} ${VMID} --name ${VM_NAME} --full 1 --storage ${STORAGE}"

  echo "--- Step 3: Configuring VM hardware and network ---"
  run_ssh "qm set ${VMID} --cores ${CORES} --memory ${MEMORY} --net0 virtio,bridge=${BRIDGE} --agent enabled=1 --ipconfig0 ip=${IP_CONFIG}"

  echo "--- Step 4: Generating and uploading bastion overlay snippet ---"
  OVERLAY_CONTENT="$(get_bastion_overlay_snippet)"
  upload_snippet "${OVERLAY_SNIPPET_PATH}" "${OVERLAY_CONTENT}"
  run_ssh "qm set ${VMID} --cicustom user=local:snippets/${OVERLAY_SNIPPET_NAME}"

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
  run_ssh "qm set ${VMID} --ide2 ${STORAGE}:cloudinit --ipconfig0 ip=${IP_CONFIG}"

  echo "--- Step 5: Generating and uploading unified cloud-init snippet ---"
  UNIFIED_CONTENT="$(get_unified_init_snippet)"
  upload_snippet "${UNIFIED_SNIPPET_PATH}" "${UNIFIED_CONTENT}"
  run_ssh "qm set ${VMID} --cicustom user=local:snippets/${UNIFIED_SNIPPET_NAME}"

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
    if ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "${PVE_USER}@${PVE_HOST}" "qm guest cmd ${VMID} ping" >/dev/null 2>&1; then
      ASSIGNED_IP=$(ssh -p "${PVE_SSH_PORT}" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "${PVE_USER}@${PVE_HOST}" "qm guest cmd ${VMID} network-get-interfaces" 2>/dev/null \
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
echo "  SSH Key:       staged ~/.ssh/id_nkpadmin_ecdsa"
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
