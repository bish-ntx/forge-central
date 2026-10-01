# Forge Central VM Bootstrap & Operator SOP

This runbook documents the automated and manual provisioning procedures for the dedicated **Forge Central / Bastion VM** on a Proxmox Virtual Environment (VE) host (e.g. Nutanix lab host `10.123.238.110`).

> **Note on Directory Paths:** In commands throughout this documentation, `~/forge-central` represents the default deployment directory on the Forge Central VM. If you are developing locally on a workstation (e.g. `~/work/git/forge-central` or another directory), adjust the path to your clone root accordingly.

---

## 1. Architecture & Sizing Recommendations

Forge Central operates as the centralized orchestration control plane, web console, and operational bastion for NKP Kubernetes deployments. It hosts the FastAPI backend, Vite React dashboard, persistent state database, container runtime, and Kubernetes management tooling.

### Resource Sizing

| Component | Minimum | Recommended (Production / Lab Bastion) | Notes |
| :--- | :--- | :--- | :--- |
| **vCPU** | 2 cores | **4 cores** (`--cores 4`) | Host CPU passthrough (`--cpu host`) |
| **RAM** | 4096 MB | **8192 MB** (`--memory 8192`) | Accommodates Docker engine, local cache, and concurrent CLI runs |
| **Disk** | 40 GB | **210 GB** (`--disk 210G`) | High-speed SSD/NVMe pool (`NTX-STORAGE-POOL` or `local-lvm`), SCSI with discard/TRIM |
| **Network** | 1 Gbps | **Bridge `vmbr263` / `vmbr0`** | VirtIO NIC (`virtio`), DHCP or pinned static IP |
| **OS** | Ubuntu 22.04 LTS | **Ubuntu 24.04 LTS (Noble Numbat)** | Official cloud image (`noble-server-cloudimg-amd64.img`) |
| **QEMU Agent**| Required | **Enabled (`agent=1`)** | Enables IP discovery, shutdown control, and health checks |

---

## 2. Operational Paths Overview

Forge Central provisioning supports two operational paths:

1. **Option A (Golden Template Exists):**
   - Full clone from an existing Proxmox golden VM template (e.g., VMID `100` or custom VMID).
   - Injects `nkp-bastion-overlay.sh` cloud-init snippet providing Docker CE, Docker Compose plugin, `kubectl`, `helm`, and working directory setup.
   - Fastest bring-up (~60 seconds).

2. **Option B (Scratch Bring-Up / No Golden Template):**
   - Downloads the Ubuntu 24.04 LTS cloud image directly onto Proxmox storage.
   - Creates a VM shell (`q35`, `virtio-scsi-single`, serial console, cloud-init drive).
   - Injects `forge-central-unified-init.sh` cloud-init snippet combining base OS hardening (user `nkpadmin`, passwordless sudo, ECDSA keys, disable swap/IPv6/UFW, QEMU agent) with bastion runtime packages (`docker`, `docker-compose`, `kubectl`, `helm`, `nfs-common`, `git`, `python3-pip`).
   - Zero external template dependencies; completely reproducible from scratch.

3. **Auto Mode (Default):**
   - Probes live Proxmox state for the golden template VMID.
   - If present, executes Option A. If missing, automatically falls back to Option B.

---

## 3. Automated Quickstart

The script `scripts/bootstrap-forge-central-vm.sh` automates the entire process remotely over SSH.

### Prerequisites

From the operator workstation or runner:
- SSH access with root credentials or SSH key to the Proxmox VE host (`10.123.238.110`).
- Bash 4+ and standard tools (`ssh`, `sed`, `grep`).

> **Note on Directory Paths:** In commands throughout this documentation, `~/forge-central` represents the default deployment directory on the Forge Central VM. If you are developing locally on a workstation (e.g. `~/work/git/forge-central` or another directory), adjust the path to your clone root accordingly.

### Quickstart Commands

```bash
# 1. Automatic bring-up (clones if VMID 100 exists; otherwise scratches from Ubuntu 24.04 cloud image)
./scripts/bootstrap-forge-central-vm.sh --pve-host 10.123.238.110

# 2. Enforce Option A (Full clone from Golden Template VMID 100)
./scripts/bootstrap-forge-central-vm.sh --mode clone --template-vmid 100 --vmid 150

# 3. Enforce Option B (Scratch bring-up with pinned static IP)
./scripts/bootstrap-forge-central-vm.sh --mode scratch \
  --pve-host 10.123.238.110 \
  --vmid 150 \
  --vm-name forge-central \
  --cores 4 \
  --memory 8192 \
  --disk 60G \
  --ip 10.123.238.150/24,gw=10.123.238.1

# 4. Supply your own SSH keypair (files) -- or use env FORGE_SSH_KEY_FILE / FORGE_SSH_PUBKEY_FILE
./scripts/bootstrap-forge-central-vm.sh --mode scratch \
  --ssh-key-file ~/.ssh/id_nkpadmin_ecdsa \
  --ssh-pubkey-file ~/.ssh/id_nkpadmin_ecdsa.pub

# 5. Dry-run inspection (simulates all SSH and qm commands without touching Proxmox)
./scripts/bootstrap-forge-central-vm.sh --dry-run --mode scratch

# 6. Print verbatim copy-pasteable manual shell commands for an operator
./scripts/bootstrap-forge-central-vm.sh --print-manual-steps

# 7. Interactive wizard (see "Interactive Wizard" below)
./scripts/bootstrap-forge-central-vm.sh --interactive

# 8. Static IP with DNS, non-interactive
./scripts/bootstrap-forge-central-vm.sh --pve-host 10.123.238.110 \
  --ip 10.123.238.150/24,gw=10.123.238.1 \
  --nameserver "10.40.64.15 8.8.8.8" --searchdomain nutanix.com --non-interactive
```

### Interactive Wizard

Start it with `-i` / `--interactive`, or by running the script with **no arguments** on a TTY (`[ -t 0 ]`). Any other flag run (`--dry-run`, `--print-manual-steps`, `--non-interactive`, or plain flags) never prompts, so CI and the pytest suite are unaffected. `--interactive --dry-run` previews the wizard and the command stream without touching Proxmox. Values given on the command line or in env vars become the prompt defaults, except for the host (below).

Walkthrough:

1. **Proxmox host (safety stop).** There is no default. Enter the IP/hostname explicitly (a host passed via `--pve-host` / `PVE_CLUSTER_HOST` is only offered as a value to confirm). Blank input aborts immediately.
2. **Sizing.** SSH user, mode (`clone|scratch|auto`), template VMID, VMID, VM name, cores, memory, disk, storage pool, bridge.
3. **Networking & DNS.** `dhcp` or `static`. Static asks for IPv4/CIDR and gateway. Both modes then ask for nameserver(s) (e.g. `10.40.64.15 8.8.8.8`) and search domain (e.g. `nutanix.com`); blank means none.
4. **Key A, operator access.** `Operator workstation public key for passwordless login [~/.ssh/id_ed25519.pub]:`. Injected into `/home/nkpadmin/.ssh/authorized_keys` for workstation-to-VM login.
5. **Key B, shared inter-VM cluster keypair (optional).** `Shared cluster private key file for inter-VM orchestration (leave blank to auto-generate inside VM):`. If given, you are also asked for its public key file. If blank, the VM generates a fresh ECDSA keypair on first boot and stages it in `/home/nkpadmin/ssh-key/` for the `./forge` scripts.
6. **Final confirmation (safety stop).** A summary table is shown, then `Are you sure you want to proceed with deployment on <target>? (yes/no) [no]:`. Only `yes` / `y` proceeds; anything else, including Enter, aborts with nothing changed.
7. **Proxmox connectivity pre-flight** (after confirmation, skipped for dry-run). The wizard probes `ssh -o BatchMode=yes root@<host>`. If key-based SSH fails it asks for the Proxmox password (hidden with `read -s`) and offers `ssh-copy-id` to install Key A. If `sshpass` is installed the password is passed through it; otherwise `ssh-copy-id` prompts itself. If the key still fails and `sshpass` exists, the password is used for this run only (kept in memory, never printed or written to disk).

Equivalent flags for scripted runs: `--ssh-pubkey-file` (Key A), `--ssh-key-file` plus `--ssh-cluster-pubkey-file` (Key B; env `FORGE_SSH_CLUSTER_PUBKEY_FILE`).

### DNS Configuration

`--nameserver` (space or comma separated IPs; env `VM_NAMESERVER`) and `--searchdomain` (env `VM_SEARCHDOMAIN`) are added to the VM's `qm set` call, for example:

```bash
qm set 150 --ide2 local-lvm:cloudinit --nameserver "10.40.64.15 8.8.8.8" --searchdomain "nutanix.com" --ipconfig0 ip=10.123.238.150/24,gw=10.123.238.1
```

When neither is given, the `qm set` commands are unchanged. Values are validated (IP addresses / domain characters only) before use.

### SSH Key Handling

No SSH key material is stored in the script or this guide. Keys are supplied at run time (CLI option wins over environment variable; inline content wins over a file path):

| CLI option | Environment variable | Purpose |
| :--- | :--- | :--- |
| `--ssh-key-file <path>` | `FORGE_SSH_KEY_FILE` | Private key file staged in the VM as `~/.ssh/id_nkpadmin_ecdsa` |
| `--ssh-pubkey-file <path>` | `FORGE_SSH_PUBKEY_FILE` | Key A: operator public key file authorized in the VM |
| `--ssh-cluster-pubkey-file <path>` | `FORGE_SSH_CLUSTER_PUBKEY_FILE` | Key B public half, when it differs from Key A (requires a private key) |
| `--ssh-private-key "<content>"` | `FORGE_SSH_PRIVATE_KEY` | Inline private key content |
| `--ssh-public-key "<content>"` | `FORGE_SSH_PUBLIC_KEY` | Inline public key content |

Resolution rules:

- **Public key auto-detection:** if no public key is supplied, the script uses the first of `~/.ssh/id_ed25519.pub`, `~/.ssh/id_ecdsa.pub`, `~/.ssh/id_rsa.pub` found on the workstation and appends it to the VM's `authorized_keys`.
- **Private key supplied:** staged to `~/.ssh/id_nkpadmin_ecdsa` and copied to `~/ssh-key/`. If no paired public key is given, it is derived in the guest (`ssh-keygen -y`).
- **No private key supplied:** a fresh keypair is generated in the guest on first boot (`ssh-keygen -t ecdsa -b 256 -N "" -C "nkpadmin@forge-central"`). Retrieve it with `scp nkpadmin@<ASSIGNED_IP>:.ssh/id_nkpadmin_ecdsa ~/.ssh/`.
- `~/.ssh/id_ecdsa` is always created and copied to `~/ssh-key/` for `./forge` cluster scripts.
- Password login (`nkpadmin` / `Nutanix.123`) stays enabled, so `ssh-copy-id nkpadmin@<ASSIGNED_IP>` always works.
- Private key content is never printed: `--dry-run` and `--print-manual-steps` show it masked. A supplied private key is embedded (base64) in the cloud-init snippet on the Proxmox host, so protect `/var/lib/vz/snippets/` accordingly. These keys apply to scratch bring-up (Option B); clone mode (Option A) inherits keys from the golden template.

---

## 4. Step-by-Step Manual Runbook

For operators who prefer running commands manually via the Proxmox VE root shell or web terminal, use the exact sequences below.

### Option A: Manual Full Clone from Golden Template

#### Step A1: Verify Golden Template
Log in to Proxmox VE (`ssh root@10.123.238.110`) and check template status:
```bash
qm status 100
# Output should indicate template exists (status: stopped)
```

#### Step A2: Clone Template to Forge Central VM
```bash
qm clone 100 150 --name forge-central --full 1 --storage local-lvm
```

#### Step A3: Configure VM Sizing & Networking
```bash
qm set 150 \
  --cores 4 \
  --memory 8192 \
  --net0 virtio,bridge=vmbr0 \
  --agent enabled=1 \
  --ipconfig0 ip=dhcp
```
*(If assigning a static IP, replace `ip=dhcp` with `ip=10.123.238.150/24,gw=10.123.238.1`)*

#### Step A4: Create Bastion Overlay Cloud-Init Snippet
```bash
mkdir -p /var/lib/vz/snippets

cat << 'EOF' > /var/lib/vz/snippets/nkp-bastion-overlay.sh
#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

NKP_USER="nkpadmin"
NKP_HOME="/home/${NKP_USER}"

echo "=== [1/5] Installing prerequisite packages ==="
apt-get update -y
apt-get install -y --no-install-recommends \
  nfs-common \
  curl \
  wget \
  jq \
  git \
  python3-pip \
  python3-venv \
  htop \
  tree \
  ca-certificates \
  gnupg \
  lsb-release

echo "=== [2/5] Installing Docker CE and compose plugin ==="
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "${NKP_USER}"

echo "=== [3/5] Installing kubectl ==="
if ! command -v kubectl >/dev/null 2>&1; then
  K8S_STABLE=$(curl -L -s https://dl.k8s.io/release/stable.txt)
  curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/${K8S_STABLE}/bin/linux/amd64/kubectl"
  chmod +x /usr/local/bin/kubectl
fi

echo "=== [4/5] Installing Helm ==="
if ! command -v helm >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo "=== [5/5] Creating Forge Central directories ==="
mkdir -p "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"
chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"

mkdir -p /var/cloud-init
touch /var/cloud-init/SUCCESS
echo "=== Bastion cloud-init overlay complete ==="
EOF

chmod +x /var/lib/vz/snippets/nkp-bastion-overlay.sh

cat << 'EOF_META' > /var/lib/vz/snippets/forge-central-meta.yaml
instance-id: forge-central
local-hostname: forge-central
EOF_META
```

#### Step A5: Attach Cloud-Init Snippet and Boot VM
```bash
# Attach user overlay and metadata snippets
qm set 150 --cicustom user=local:snippets/nkp-bastion-overlay.sh,meta=local:snippets/forge-central-meta.yaml

# Start VM
qm start 150
```

#### Step A6: Monitor Guest Agent & Retrieve IP
```bash
# Test guest agent response:
qm guest cmd 150 ping

# Retrieve assigned IP:
qm guest cmd 150 network-get-interfaces
```

---

### Option B: Manual Scratch Bring-Up (No Golden Template)

#### Step B1: Download Ubuntu 24.04 LTS Cloud Image
Log in to Proxmox VE (`ssh root@10.123.238.110`):
```bash
mkdir -p /var/lib/vz/template/iso
wget -N -P /var/lib/vz/template/iso https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img
```

#### Step B2: Create VM Shell
```bash
qm create 150 \
  --name forge-central \
  --memory 8192 \
  --cores 4 \
  --cpu host \
  --machine q35 \
  --net0 virtio,bridge=vmbr0 \
  --ostype l26 \
  --agent enabled=1 \
  --serial0 socket \
  --vga serial0 \
  --boot order=scsi0
```

#### Step B3: Import Cloud Disk Image & Attach
```bash
# Import raw image into storage pool
qm importdisk 150 /var/lib/vz/template/iso/ubuntu-24.04-server-cloudimg-amd64.img local-lvm

# Attach imported disk as SCSI 0 with TRIM/SSD emulation
qm set 150 --scsihw virtio-scsi-single --scsi0 local-lvm:vm-150-disk-0,discard=on,ssd=1

# Resize primary disk to 60GB
qm resize 150 scsi0 60G

# Add cloud-init optical drive and IP config
qm set 150 --ide2 local-lvm:cloudinit --ipconfig0 ip=dhcp
```

#### Step B4: Create Unified Cloud-Init Snippet
The unified snippet sets up user accounts, SSH keys, network parameters, Docker, and Kubernetes tools in a single script:
```bash
mkdir -p /var/lib/vz/snippets

cat << 'EOF' > /var/lib/vz/snippets/forge-central-unified-init.sh
#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

NKP_USER="nkpadmin"
NKP_PASS="Nutanix.123"
NKP_HOME="/home/${NKP_USER}"
NKP_SSH_DIR="${NKP_HOME}/.ssh"

echo "=== [1/8] Configuring user ${NKP_USER} and sudo ==="
if ! id "${NKP_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${NKP_USER}"
fi
echo "${NKP_USER}:${NKP_PASS}" | chpasswd

cat > "/etc/sudoers.d/${NKP_USER}" <<SUDO_EOF
${NKP_USER} ALL=(ALL) NOPASSWD:ALL
SUDO_EOF
chmod 0440 "/etc/sudoers.d/${NKP_USER}"

echo "=== [2/8] Hardening SSH and staging credentials ==="
rm -f /etc/ssh/sshd_config.d/60-cloudimg-settings.conf
sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
if ! grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config; then
  echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config
fi
systemctl restart ssh || systemctl restart sshd

mkdir -p "${NKP_SSH_DIR}"
chmod 700 "${NKP_SSH_DIR}"

# --- SSH keys (no key material is hardcoded) ---------------------------------
# Optional: base64 of YOUR private key / public keys, produced on your workstation:
#   base64 < ~/.ssh/id_nkpadmin_ecdsa | tr -d '\n'
# Leave NKP_PRIV_KEY_B64 empty to generate a fresh ECDSA keypair in the guest.
NKP_PRIV_KEY_B64=''   # base64 of operator private key (optional)
NKP_PAIR_PUB_B64=''   # base64 of the public key paired with that private key (optional)
NKP_AUTH_PUB_B64=''   # base64 of an operator public key to authorize, e.g. ~/.ssh/id_ed25519.pub (optional)

add_authorized_key() {
  grep -qxF "$1" "${NKP_SSH_DIR}/authorized_keys" 2>/dev/null || echo "$1" >> "${NKP_SSH_DIR}/authorized_keys"
}
touch "${NKP_SSH_DIR}/authorized_keys"

if [ -n "${NKP_PRIV_KEY_B64}" ]; then
  echo "${NKP_PRIV_KEY_B64}" | base64 -d > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa"
  chmod 600 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa"
  if [ -n "${NKP_PAIR_PUB_B64}" ]; then
    echo "${NKP_PAIR_PUB_B64}" | base64 -d > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub"
  else
    ssh-keygen -y -P "" -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" </dev/null
  fi
elif [ ! -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" ]; then
  rm -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub"
  ssh-keygen -t ecdsa -b 256 -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" -N "" -C "nkpadmin@forge-central"
fi

cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa"
cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"
add_authorized_key "$(cat "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub")"
if [ -n "${NKP_AUTH_PUB_B64}" ]; then
  add_authorized_key "$(echo "${NKP_AUTH_PUB_B64}" | base64 -d)"
fi
unset NKP_PRIV_KEY_B64

cat > "${NKP_SSH_DIR}/config" <<'CONFIG_EOF'
Host *
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR
CONFIG_EOF

chmod 600 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa" "${NKP_SSH_DIR}/authorized_keys" "${NKP_SSH_DIR}/config"
chmod 644 "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"
chown -R "${NKP_USER}:${NKP_USER}" "${NKP_SSH_DIR}"

mkdir -p "${NKP_HOME}/ssh-key"
cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_HOME}/ssh-key/"
cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_HOME}/ssh-key/"
chmod 700 "${NKP_HOME}/ssh-key"
chmod 600 "${NKP_HOME}/ssh-key/id_nkpadmin_ecdsa"
chmod 644 "${NKP_HOME}/ssh-key/id_nkpadmin_ecdsa.pub"
chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/ssh-key"

echo "=== [3/8] Disabling UFW, swap, and IPv6 ==="
ufw disable 2>/dev/null || true
systemctl disable --now ufw 2>/dev/null || true

swapoff -a || true
sed -i '/swap/d' /etc/fstab || true

cat > /etc/sysctl.d/99-disable-ipv6.conf <<SYSCTL_EOF
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
net.ipv6.conf.lo.disable_ipv6 = 1
SYSCTL_EOF
sysctl -p /etc/sysctl.d/99-disable-ipv6.conf || true

echo "=== [4/8] Installing base packages and guest agent ==="
apt-get update -y
apt-get install -y --no-install-recommends \
  qemu-guest-agent \
  open-iscsi \
  nfs-common \
  curl \
  wget \
  jq \
  git \
  python3-pip \
  python3-venv \
  htop \
  tree \
  ca-certificates \
  gnupg \
  lsb-release

systemctl enable --now qemu-guest-agent

echo "=== [5/8] Installing Docker CE and compose plugin ==="
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "${NKP_USER}"

echo "=== [6/8] Installing kubectl ==="
if ! command -v kubectl >/dev/null 2>&1; then
  K8S_STABLE=$(curl -L -s https://dl.k8s.io/release/stable.txt)
  curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/${K8S_STABLE}/bin/linux/amd64/kubectl"
  chmod +x /usr/local/bin/kubectl
fi

echo "=== [7/8] Installing Helm ==="
if ! command -v helm >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo "=== [8/8] Setting up Forge Central directories ==="
mkdir -p "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"
chown -R "${NKP_USER}:${NKP_USER}" "${NKP_HOME}/forge-central" "${NKP_HOME}/forge-state" "${NKP_HOME}/cacrt"

mkdir -p /var/cloud-init
touch /var/cloud-init/SUCCESS
echo "=== Unified cloud-init initialization complete ==="
EOF

chmod +x /var/lib/vz/snippets/forge-central-unified-init.sh

cat << 'EOF_META' > /var/lib/vz/snippets/forge-central-meta.yaml
instance-id: forge-central
local-hostname: forge-central
EOF_META
```

#### Step B5: Attach Unified Snippet & Boot VM
```bash
qm set 150 --cicustom user=local:snippets/forge-central-unified-init.sh,meta=local:snippets/forge-central-meta.yaml
qm start 150
```

#### Step B6: Wait for IP Address
```bash
qm guest cmd 150 ping
qm guest cmd 150 network-get-interfaces
```

---

## 5. Day-1 Post-Bootstrap Verification

Once the VM is running and reports an IP address, perform these quick sanity checks:

### 1. SSH Connectivity
Connect using your authorized public key, the staged ECDSA key, or the default password:
```bash
# Pubkey auth (your authorized workstation key):
ssh nkpadmin@<ASSIGNED_IP>

# Pubkey auth with the staged keypair (if you supplied --ssh-key-file, or fetched the generated key):
ssh -i ~/.ssh/id_nkpadmin_ecdsa nkpadmin@<ASSIGNED_IP>

# Password auth (password: Nutanix.123):
ssh nkpadmin@<ASSIGNED_IP>
```

### 2. Privilege & Sudo Verification
```bash
sudo whoami
# Expected output: root (no password prompt)
```

### 3. Docker Engine & Compose Status
```bash
docker --version
docker compose version
docker ps
# Expected: Docker daemon is responsive; nkpadmin can execute docker commands without sudo
```

### 4. Kubernetes CLI Tooling
```bash
kubectl version --client
helm version
```

### 5. Cloud-Init Completion Marker
```bash
cat /var/cloud-init/SUCCESS
# Verify initialization script finished cleanly
```

---

## 6. Next Steps: Synchronizing Forge Central & Service Bring-Up

### Step 1: Sync Codebase to Bastion
From your local development machine:
```bash
# Using rsync (convenience alias: forge-central-sync-ntx):
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  ./ nkpadmin@<ASSIGNED_IP>:/home/nkpadmin/forge-central/
```

### Step 2: Start Forge Central via Docker Compose
SSH into the VM:
```bash
ssh nkpadmin@<ASSIGNED_IP>
cd /home/nkpadmin/forge-central

# Launch backend and frontend containers
docker compose up -d

# Verify container health
docker compose ps
docker compose logs -f --tail=50
```

### Step 3: Access Web Console
Open a browser and navigate to:
```
http://<ASSIGNED_IP>:8000
```
- API Documentation (Swagger): `http://<ASSIGNED_IP>:8000/docs`
- Health check endpoint: `http://<ASSIGNED_IP>:8000/healthz`
