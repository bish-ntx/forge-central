# =============================================================================
# Forge Central — Synthetic Mock Data (FORGE_MOCK_MODE=true)
# Project: Forge Central Control Plane
# Version: 1.0.0
# Author:  Bishwajit Kumar <Bishwajit.Kumar@nutanix.com>
# Description: Deterministic VM, cluster, and NFS share payloads for offline dev.
# =============================================================================

from __future__ import annotations

from typing import Any

MOCK_VMS: list[dict[str, Any]] = [
    {"vmid": 101, "name": "cp-01", "node": "pve-01", "cores": 4, "memory_mb": 16384, "disk_gb": 100, "status": "running"},
    {"vmid": 102, "name": "cp-02", "node": "pve-01", "cores": 4, "memory_mb": 16384, "disk_gb": 100, "status": "running"},
    {"vmid": 103, "name": "cp-03", "node": "pve-02", "cores": 4, "memory_mb": 16384, "disk_gb": 100, "status": "running"},
    {"vmid": 111, "name": "wk-01", "node": "pve-02", "cores": 8, "memory_mb": 32768, "disk_gb": 200, "status": "running"},
    {"vmid": 112, "name": "wk-02", "node": "pve-02", "cores": 8, "memory_mb": 32768, "disk_gb": 200, "status": "running"},
    {
        "vmid": 121,
        "name": "gpu-01",
        "node": "pve-03",
        "cores": 16,
        "memory_mb": 65536,
        "disk_gb": 500,
        "status": "running",
        "gpu_passthrough": True,
        "pci_devices": ["0000:01:00.0"],
    },
]

MOCK_CLUSTERS: list[dict[str, Any]] = [
    {
        "name": "amd-nkp1",
        "status": "ready",
        "kubernetes_version": "v1.32.3",
        "desired_nodes": 6,
        "ready_nodes": 6,
        "metallb": {"vip_range": "10.10.0.200-10.10.0.220", "address_pool": "amd-nkp1-pool"},
        "last_updated_at": "2026-09-26T08:15:00Z",
    },
    {
        "name": "cirra-nkp1",
        "status": "deploying",
        "kubernetes_version": "v1.32.3",
        "desired_nodes": 5,
        "ready_nodes": 2,
        "metallb": {"vip_range": "10.20.0.200-10.20.0.220", "address_pool": "cirra-nkp1-pool"},
        "last_updated_at": "2026-09-26T12:33:19Z",
    },
]

MOCK_SHARES: list[dict[str, str]] = [
    {"export": "~/nkp-forge", "client": "10.10.0.0/24", "type": "nfs", "status": "exported"},
    {"export": "~/forge-state", "client": "10.10.0.0/24", "type": "nfs", "status": "exported"},
    {"export": "~/cacrt", "client": "10.10.0.0/24", "type": "nfs", "status": "exported"},
]
