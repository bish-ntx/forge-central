# Forge Central VM Bootstrap & Operator SOP

This runbook documents the automated and manual provisioning procedures for the dedicated **Forge Central / Bastion VM** on a Proxmox Virtual Environment (VE) host (e.g. Nutanix lab host `10.123.238.110`).

---

## 1. Architecture & Sizing Recommendations

Forge Central operates as the centralized orchestration control plane, web console, and operational bastion for NKP Kubernetes deployments. It hosts the FastAPI backend, Vite React dashboard, persistent state database, container runtime, and Kubernetes management tooling.

### Resource Sizing

| Component | Minimum | Recommended (Production / Lab Bastion) | Notes |
| :--- | :--- | :--- | :--- |
| **vCPU** | 2 cores | **4 cores** (`--cores 4`) | Host CPU passthrough (`--cpu host`) |
| **RAM** | 4096 MB | **8192 MB** (`--memory 8192`) | Accommodates Docker engine, local cache, and concurrent CLI runs |
| **Disk** | 40 GB | **60 GB** (`--disk 60G`) | High-speed SSD/NVMe pool (`local-lvm`), SCSI with discard/TRIM |
| **Network** | 1 Gbps | **Bridge `vmbr0`** | VirtIO NIC (`virtio`), DHCP or pinned static IP |
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

# 4. Dry-run inspection (simulates all SSH and qm commands without touching Proxmox)
./scripts/bootstrap-forge-central-vm.sh --dry-run --mode scratch

# 5. Print verbatim copy-pasteable manual shell commands for an operator
./scripts/bootstrap-forge-central-vm.sh --print-manual-steps
```

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
```

#### Step A5: Attach Cloud-Init Snippet and Boot VM
```bash
# Attach snippet to user cloud-init data
qm set 150 --cicustom user=local:snippets/nkp-bastion-overlay.sh

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

cat > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" <<'PRIV_KEY_EOF'
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAaAAAABNlY2RzYS
1zaGEyLW5pc3RwMjU2AAAACG5pc3RwMjU2AAAAQQQqWmeNGmS+KNY6NNDwRVGZn+cs+ZuV
+Bq1SlrvSyEKpRxGqU3sV8J3Hetjz1kOxGK+NvlK+bJwMEIRDI2pH3t5AAAAsBhjcl4YY3
JeAAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBCpaZ40aZL4o1jo0
0PBFUZmf5yz5m5X4GrVKWu9LIQqlHEapTexXwncd62PPWQ7EYr42+Ur5snAwQhEMjakfe3
kAAAAhAMsXpe9exqAeexKC29wavVk6EBg6IjV2KTRn1od/rn9IAAAAFG5rcGFkbWluQG51
dGFuaXguY29tAQID
-----END OPENSSH PRIVATE KEY-----
PRIV_KEY_EOF

cat > "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" <<'PUB_KEY_EOF'
ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBCpaZ40aZL4o1jo00PBFUZmf5yz5m5X4GrVKWu9LIQqlHEapTexXwncd62PPWQ7EYr42+Ur5snAwQhEMjakfe3k= nkpadmin@nutanix.com
PUB_KEY_EOF

cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa"
cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" "${NKP_SSH_DIR}/id_ecdsa.pub"
cat "${NKP_SSH_DIR}/id_nkpadmin_ecdsa.pub" >> "${NKP_SSH_DIR}/authorized_keys"

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
```

#### Step B5: Attach Unified Snippet & Boot VM
```bash
qm set 150 --cicustom user=local:snippets/forge-central-unified-init.sh
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
Connect using the pre-staged ECDSA key or default password:
```bash
# Pubkey auth (if using staged id_nkpadmin_ecdsa):
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
