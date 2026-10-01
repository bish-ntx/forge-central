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


def run_script_env(env_extra: dict[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    """Execute the bootstrap script with a sandboxed HOME and extra environment variables."""
    import os

    env = {**os.environ, **env_extra}
    return subprocess.run(
        [str(SCRIPT_PATH), *args],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )


def test_script_has_no_hardcoded_private_key():
    """The script must never embed literal private key material."""
    content = SCRIPT_PATH.read_text()
    assert "BEGIN OPENSSH PRIVATE KEY" not in content
    assert "PRIV_KEY_EOF" not in content
    assert "nkpadmin@nutanix.com" not in content


def test_help_lists_ssh_key_options():
    res = run_script("--help")
    assert res.returncode == 0
    for opt in ("--ssh-key-file", "--ssh-pubkey-file", "--ssh-private-key", "--ssh-public-key"):
        assert opt in res.stdout
    for env in ("FORGE_SSH_KEY_FILE", "FORGE_SSH_PUBKEY_FILE", "FORGE_SSH_PRIVATE_KEY", "FORGE_SSH_PUBLIC_KEY"):
        assert env in res.stdout


def test_ssh_key_file_and_pubkey_file_handling(tmp_path):
    """--ssh-key-file / --ssh-pubkey-file are accepted and key content is never printed."""
    priv = tmp_path / "id_test"
    pub = tmp_path / "id_test.pub"
    priv.write_text("-----BEGIN FAKE KEY-----\nSECRETPAYLOAD\n-----END FAKE KEY-----\n")
    pub.write_text("ssh-ed25519 AAAATESTPUBKEY test@example\n")

    res = run_script("--dry-run", "--mode", "scratch", "--ssh-key-file", str(priv), "--ssh-pubkey-file", str(pub))
    assert res.returncode == 0
    assert "operator-supplied (content not printed)" in res.stdout
    assert f"file:{pub}" in res.stdout
    assert "SECRETPAYLOAD" not in res.stdout + res.stderr
    assert "BEGIN FAKE KEY" not in res.stdout + res.stderr


def test_ssh_public_key_inline_and_manual_steps_mask(tmp_path):
    """Inline public key is accepted; --print-manual-steps masks a supplied private key."""
    priv = tmp_path / "id_test"
    priv.write_text("-----BEGIN FAKE KEY-----\nSECRETPAYLOAD\n-----END FAKE KEY-----\n")

    res = run_script(
        "--print-manual-steps", "--mode", "scratch",
        "--ssh-public-key", "ssh-ed25519 AAAATESTPUBKEY test@example",
        "--ssh-key-file", str(priv),
    )
    assert res.returncode == 0
    out = res.stdout
    assert "SSH KEY OPTIONS" in out
    assert "inline" in out
    assert "<BASE64_OF_YOUR_PRIVATE_KEY>" in out
    assert "SECRETPAYLOAD" not in out
    assert "U0VDUkVUUEFZTE9BRA" not in out  # base64("SECRETPAYLOAD")
    assert 'ssh-keygen -t ecdsa -b 256 -f "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" -N "" -C "nkpadmin@forge-central"' in out
    assert "BEGIN OPENSSH PRIVATE KEY" not in out
    assert 'cp "${NKP_SSH_DIR}/id_nkpadmin_ecdsa" "${NKP_SSH_DIR}/id_ecdsa"' in out
    assert "PasswordAuthentication yes" in out
    assert "Nutanix.123" in out


def test_ssh_env_vars_honoured(tmp_path):
    pub = tmp_path / "k.pub"
    pub.write_text("ssh-rsa AAAATESTPUBKEY test@example\n")
    res = run_script_env({"FORGE_SSH_PUBKEY_FILE": str(pub)}, "--dry-run", "--mode", "scratch")
    assert res.returncode == 0
    assert f"file:{pub}" in res.stdout

    res = run_script_env({"FORGE_SSH_PUBLIC_KEY": "ecdsa-sha2-nistp256 AAAATEST x"}, "--dry-run", "--mode", "scratch")
    assert res.returncode == 0
    assert "SSH Pubkey:    inline" in res.stdout


def test_ssh_pubkey_autodetect_and_generate_fallback(tmp_path):
    """With a HOME holding id_ed25519.pub it is auto-detected; with an empty HOME the guest generates keys."""
    home = tmp_path / "home"
    (home / ".ssh").mkdir(parents=True)
    (home / ".ssh" / "id_ed25519.pub").write_text("ssh-ed25519 AAAATESTPUBKEY test@example\n")
    env = {"HOME": str(home)}
    for var in ("FORGE_SSH_KEY_FILE", "FORGE_SSH_PUBKEY_FILE", "FORGE_SSH_PRIVATE_KEY", "FORGE_SSH_PUBLIC_KEY"):
        env[var] = ""
    res = run_script_env(env, "--dry-run", "--mode", "scratch")
    assert res.returncode == 0
    assert "auto-detected:~/.ssh/id_ed25519.pub" in res.stdout
    assert "will generate ECDSA keypair in guest" in res.stdout

    empty_home = tmp_path / "empty"
    empty_home.mkdir()
    res = run_script_env({**env, "HOME": str(empty_home)}, "--dry-run", "--mode", "scratch")
    assert res.returncode == 0
    assert "SSH Pubkey:    none" in res.stdout


def test_missing_ssh_key_files_rejected(tmp_path):
    res = run_script("--dry-run", "--ssh-key-file", str(tmp_path / "nope"))
    assert res.returncode != 0
    assert "--ssh-key-file" in res.stderr
    res = run_script("--dry-run", "--ssh-pubkey-file", str(tmp_path / "nope.pub"))
    assert res.returncode != 0
    assert "--ssh-pubkey-file" in res.stderr


def test_invalid_public_key_rejected():
    res = run_script("--dry-run", "--ssh-public-key", "not-a-key")
    assert res.returncode != 0
    assert "OpenSSH public key" in res.stderr


# ---------------------------------------------------------------------------
# Task-30: interactive wizard, dual SSH keys, DNS
# ---------------------------------------------------------------------------
def run_script_stdin(stdin: str, *args: str) -> subprocess.CompletedProcess[str]:
    """Run the script feeding scripted answers on stdin (no real TTY needed with --interactive)."""
    return subprocess.run(
        [str(SCRIPT_PATH), *args],
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )


def test_help_lists_interactive_and_dns_flags():
    res = run_script("--help")
    assert res.returncode == 0
    for opt in ("--interactive", "--non-interactive", "--nameserver", "--searchdomain", "--ssh-cluster-pubkey-file"):
        assert opt in res.stdout


def test_nameserver_searchdomain_interpolation_dry_run():
    res = run_script(
        "--dry-run", "--mode", "scratch",
        "--ip", "10.123.238.150/24,gw=10.123.238.1",
        "--nameserver", "10.40.64.15 8.8.8.8",
        "--searchdomain", "nutanix.com",
    )
    assert res.returncode == 0
    assert (
        "qm set 150 --ide2 local-lvm:cloudinit --nameserver \"10.40.64.15 8.8.8.8\" "
        "--searchdomain \"nutanix.com\" --ipconfig0 ip=10.123.238.150/24,gw=10.123.238.1"
    ) in res.stdout


def test_nameserver_searchdomain_clone_and_manual_steps():
    res = run_script("--dry-run", "--mode", "clone", "--nameserver", "10.40.64.15,8.8.8.8", "--searchdomain", "nutanix.com")
    assert res.returncode == 0
    assert "--agent enabled=1 --nameserver \"10.40.64.15 8.8.8.8\" --searchdomain \"nutanix.com\" --ipconfig0 ip=dhcp" in res.stdout
    res = run_script("--print-manual-steps", "--nameserver", "10.40.64.15", "--searchdomain", "nutanix.com")
    assert res.returncode == 0
    assert "--nameserver \"10.40.64.15\" --searchdomain \"nutanix.com\"" in res.stdout


def test_no_dns_flags_leaves_qm_set_unchanged():
    res = run_script("--dry-run", "--mode", "scratch")
    assert res.returncode == 0
    assert "--nameserver" not in res.stdout.replace("DNS:", "")
    assert "--ide2 local-lvm:cloudinit --ipconfig0 ip=dhcp" in res.stdout


def test_invalid_dns_rejected():
    res = run_script("--dry-run", "--nameserver", "8.8.8.8; rm -rf /")
    assert res.returncode != 0
    assert "--nameserver" in res.stderr
    res = run_script("--dry-run", "--searchdomain", "bad domain;x")
    assert res.returncode != 0
    assert "--searchdomain" in res.stderr


def test_wizard_blank_host_aborts():
    res = run_script_stdin("\n", "--interactive")
    assert res.returncode != 0
    assert "No Proxmox host provided" in res.stderr
    assert "Starting Forge Central VM Bootstrap" not in res.stdout


def test_wizard_default_confirmation_is_no():
    # host, then Enter for every remaining prompt (including the final confirmation)
    res = run_script_stdin("10.9.9.9\n" + "\n" * 25, "--interactive", "--dry-run")
    assert res.returncode != 0
    assert "Are you sure you want to proceed with deployment on root@10.9.9.9? (yes/no) [no]:" in res.stderr
    assert "DEPLOYMENT SUMMARY" in res.stdout + res.stderr
    assert "Deployment not confirmed" in res.stderr
    assert "[dry-run] ssh" not in res.stdout


def test_wizard_explicit_no_aborts():
    res = run_script_stdin("10.9.9.9\n" + "\n" * 13 + "no\n", "--interactive", "--dry-run", "--ssh-pubkey-file", "/dev/null")
    assert res.returncode != 0
    assert "[dry-run] ssh" not in res.stdout


def test_wizard_full_flow_dual_keys_and_dns(tmp_path):
    key_a = tmp_path / "a.pub"
    key_a.write_text("ssh-ed25519 AAAAOPERATORKEY operator@mac\n")
    key_b = tmp_path / "cluster"
    key_b.write_text("-----BEGIN FAKE KEY-----\nSECRETPAYLOAD\n-----END FAKE KEY-----\n")
    key_b_pub = tmp_path / "cluster.pub"
    key_b_pub.write_text("ecdsa-sha2-nistp256 AAAACLUSTERKEY cluster@vm\n")
    answers = "\n".join([
        "10.9.9.9",            # host
        "",                    # user
        "scratch",             # mode
        "151",                 # vmid
        "fc2",                 # name
        "", "", "", "", "",    # cores, memory, disk, storage, bridge
        "static",
        "10.9.9.50/24",
        "10.9.9.1",
        "10.40.64.15 8.8.8.8",
        "nutanix.com",
        str(key_a),            # Key A
        str(key_b),            # Key B private
        "",                    # Key B public (default <priv>.pub)
        "yes",
    ]) + "\n"
    res = run_script_stdin(answers, "--interactive", "--dry-run")
    assert res.returncode == 0, res.stderr
    assert "Operator workstation public key for passwordless login" in res.stderr
    assert "Shared cluster private key file for inter-VM orchestration (leave blank to auto-generate inside VM):" in res.stderr
    assert (
        "[dry-run] ssh root@10.9.9.9 'qm set 151 --ide2 local-lvm:cloudinit --nameserver \"10.40.64.15 8.8.8.8\" "
        "--searchdomain \"nutanix.com\" --ipconfig0 ip=10.9.9.50/24,gw=10.9.9.1'"
    ) in res.stdout
    assert f"file:{key_a}" in res.stdout
    assert "operator-supplied (content not printed)" in res.stdout
    assert "SECRETPAYLOAD" not in res.stdout + res.stderr


def test_wizard_key_b_blank_generates_in_vm():
    answers = "\n".join(["10.9.9.9", "", "scratch", "", "", "", "", "", "", "", "dhcp", "", "", "", "", "y"]) + "\n"
    res = run_script_stdin(answers, "--interactive", "--dry-run")
    assert res.returncode == 0, res.stderr
    assert "auto-generate ECDSA inside VM" in res.stdout + res.stderr
    assert "will generate ECDSA keypair in guest" in res.stdout


def test_non_interactive_flag_never_prompts():
    res = subprocess.run(
        [str(SCRIPT_PATH), "--non-interactive", "--dry-run", "--mode", "scratch"],
        stdin=subprocess.DEVNULL, capture_output=True, text=True, check=False, timeout=30,
    )
    assert res.returncode == 0
    assert "Interactive Bootstrap Wizard" not in res.stdout + res.stderr


def test_cluster_pubkey_requires_private_key(tmp_path):
    pub = tmp_path / "c.pub"
    pub.write_text("ecdsa-sha2-nistp256 AAAACLUSTERKEY c@vm\n")
    res = run_script("--dry-run", "--ssh-cluster-pubkey-file", str(pub))
    assert res.returncode != 0
    assert "--ssh-cluster-pubkey-file requires a private key" in res.stderr
