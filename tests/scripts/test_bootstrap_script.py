"""Tests for scripts/bootstrap-forge-central-vm.sh."""

from __future__ import annotations

from pathlib import Path
import subprocess

SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "bootstrap-forge-central-vm.sh"


def run_script(*args: str) -> subprocess.CompletedProcess[str]:
    """Execute the bootstrap script and return the CompletedProcess."""
    return subprocess.run(
        [str(SCRIPT_PATH), *args],
        capture_output=True,
        text=True,
        check=False,
    )


def test_help_flag():
    """Verify --help flag displays usage and supported arguments."""
    res = run_script("--help")
    assert res.returncode == 0
    assert "Forge Central — Automated Proxmox VM Bootstrap Tool" in res.stdout
    assert "--pve-host" in res.stdout
    assert "--mode <clone|scratch|auto>" in res.stdout
    assert "--template-vmid" in res.stdout
    assert "--vmid" in res.stdout
    assert "--cores" in res.stdout
    assert "--memory" in res.stdout
    assert "--disk" in res.stdout
    assert "--storage" in res.stdout
    assert "--bridge" in res.stdout
    assert "--ip" in res.stdout
    assert "--dry-run" in res.stdout
    assert "--print-manual-steps" in res.stdout


def test_print_manual_steps_default():
    """Verify --print-manual-steps produces both Option A and Option B qm sequences by default."""
    res = run_script("--print-manual-steps")
    assert res.returncode == 0
    stdout = res.stdout

    # Option A validation
    assert "OPTION A: CLONE FROM GOLDEN TEMPLATE" in stdout
    assert "qm status 100" in stdout
    assert "qm clone 100 150 --name forge-central --full 1 --storage local-lvm" in stdout
    assert "qm set 150 --cores 4 --memory 8192 --net0 virtio,bridge=vmbr0" in stdout
    assert "qm set 150 --cicustom user=local:snippets/nkp-bastion-overlay.sh" in stdout
    assert "qm start 150" in stdout

    # Option B validation
    assert "OPTION B: SCRATCH BRING-UP" in stdout
    assert "wget -N -P /var/lib/vz/template/iso" in stdout
    assert "qm create 150 --name forge-central" in stdout
    assert "qm importdisk 150" in stdout
    assert "qm set 150 --scsihw virtio-scsi-single" in stdout
    assert "qm resize 150 scsi0 60G" in stdout
    assert "qm set 150 --cicustom user=local:snippets/forge-central-unified-init.sh" in stdout

    # Post-bootstrap verification
    assert "DAY-1 POST-BOOTSTRAP VERIFICATION" in stdout
    assert "docker --version" in stdout
    assert "kubectl version --client" in stdout


def test_print_manual_steps_clone_mode():
    """Verify --print-manual-steps with --mode clone prints only Option A."""
    res = run_script("--print-manual-steps", "--mode", "clone", "--vmid", "180", "--template-vmid", "105")
    assert res.returncode == 0
    assert "OPTION A: CLONE FROM GOLDEN TEMPLATE (VMID 105)" in res.stdout
    assert "qm clone 105 180" in res.stdout
    assert "OPTION B: SCRATCH BRING-UP" not in res.stdout


def test_print_manual_steps_scratch_mode():
    """Verify --print-manual-steps with --mode scratch prints only Option B."""
    res = run_script("--print-manual-steps", "--mode", "scratch", "--vmid", "190", "--disk", "80G")
    assert res.returncode == 0
    assert "OPTION B: SCRATCH BRING-UP" in res.stdout
    assert "qm create 190" in res.stdout
    assert "qm resize 190 scsi0 80G" in res.stdout
    assert "OPTION A: CLONE FROM GOLDEN TEMPLATE" not in res.stdout


def test_dry_run_clone_stream():
    """Verify --dry-run with --mode clone generates complete command stream."""
    res = run_script(
        "--dry-run",
        "--mode", "clone",
        "--pve-host", "10.123.238.110",
        "--template-vmid", "100",
        "--vmid", "150",
        "--vm-name", "forge-central",
        "--cores", "4",
        "--memory", "8192",
        "--storage", "local-lvm",
        "--bridge", "vmbr0",
        "--ip", "dhcp",
    )
    assert res.returncode == 0
    stdout = res.stdout

    assert "[dry-run] ssh root@10.123.238.110 'qm status 100'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm clone 100 150 --name forge-central --full 1 --storage local-lvm'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm set 150 --cores 4 --memory 8192 --net0 virtio,bridge=vmbr0 --agent enabled=1 --ipconfig0 ip=dhcp'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'cat > /var/lib/vz/snippets/nkp-bastion-overlay.sh'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm set 150 --cicustom user=local:snippets/nkp-bastion-overlay.sh'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm start 150'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm guest cmd 150 ping'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm guest cmd 150 network-get-interfaces'" in stdout
    assert "SSH Command:  ssh nkpadmin@10.123.238.150" in stdout


def test_dry_run_scratch_stream():
    """Verify --dry-run with --mode scratch generates complete command stream."""
    res = run_script(
        "--dry-run",
        "--mode", "scratch",
        "--pve-host", "10.123.238.110",
        "--vmid", "150",
        "--vm-name", "forge-central",
        "--cores", "4",
        "--memory", "8192",
        "--disk", "60G",
        "--storage", "local-lvm",
        "--bridge", "vmbr0",
        "--ip", "10.123.238.150/24,gw=10.123.238.1",
    )
    assert res.returncode == 0
    stdout = res.stdout

    assert "[dry-run] ssh root@10.123.238.110 'mkdir -p /var/lib/vz/template/iso'" in stdout
    assert "ubuntu-24.04-server-cloudimg-amd64.img" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm create 150 --name forge-central --memory 8192 --cores 4 --cpu host --machine q35 --net0 virtio,bridge=vmbr0 --ostype l26 --agent enabled=1 --serial0 socket --vga serial0 --boot order=scsi0'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm importdisk 150 /var/lib/vz/template/iso/ubuntu-24.04-server-cloudimg-amd64.img local-lvm'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm set 150 --scsihw virtio-scsi-single --scsi0 local-lvm:vm-150-disk-0,discard=on,ssd=1'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm resize 150 scsi0 60G'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm set 150 --ide2 local-lvm:cloudinit --ipconfig0 ip=10.123.238.150/24,gw=10.123.238.1'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'cat > /var/lib/vz/snippets/forge-central-unified-init.sh'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm set 150 --cicustom user=local:snippets/forge-central-unified-init.sh'" in stdout
    assert "[dry-run] ssh root@10.123.238.110 'qm start 150'" in stdout


def test_dry_run_auto_mode():
    """Verify --dry-run with --mode auto executes cleanly and simulates auto-detection."""
    res = run_script("--dry-run", "--mode", "auto")
    assert res.returncode == 0
    assert "Simulating auto-detection" in res.stdout
    assert "qm start 150" in res.stdout


def test_invalid_mode_rejected():
    """Verify invalid mode exits with non-zero code and error message."""
    res = run_script("--mode", "invalid_mode")
    assert res.returncode != 0
    assert "Invalid --mode 'invalid_mode'" in res.stderr


def test_invalid_vmid_rejected():
    """Verify non-integer VMID exits with non-zero code and error message."""
    res = run_script("--vmid", "abc")
    assert res.returncode != 0
    assert "--vmid must be an integer" in res.stderr


def test_custom_parameters_interpolation():
    """Verify custom CLI parameters are properly interpolated into commands."""
    res = run_script(
        "--dry-run",
        "--mode", "scratch",
        "--pve-host", "10.99.99.1",
        "--pve-user", "admin",
        "--vmid", "220",
        "--vm-name", "custom-bastion",
        "--cores", "8",
        "--memory", "16384",
        "--disk", "100G",
        "--storage", "tank-zfs",
        "--bridge", "vmbr1",
    )
    assert res.returncode == 0
    stdout = res.stdout
    assert "admin@10.99.99.1" in stdout
    assert "qm create 220 --name custom-bastion --memory 16384 --cores 8" in stdout
    assert "tank-zfs:vm-220-disk-0" in stdout
    assert "qm resize 220 scsi0 100G" in stdout
    assert "bridge=vmbr1" in stdout
