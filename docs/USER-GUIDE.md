# Forge Central User Guide

## Web Console Launch

Start the frontend locally:

```bash
cd ~/work/git/forge-central/ui
npm install
npm run dev
```

Open the Vite URL shown in terminal (default: `http://127.0.0.1:5173`).

## Layout Overview

The web console uses a dark Tailwind layout inspired by Nutanix/Proxmox operations dashboards:

- **Sidebar (`ui/src/components/layout/Sidebar.jsx`)**
  - Lab site badge: `amd-lab (Santa Clara)`
  - Mode switcher between:
    - `Forge Central Console` (local write mode)
    - `Forge Fleet Dashboard` (HQ read-only mode)
  - Navigation routes:
    - `/vms`
    - `/clusters`
    - `/fleet`
    - `/ipam`
    - `/settings`
- **Header (`ui/src/components/layout/Header.jsx`)**
  - Control-plane mode badge
  - System health status dot
  - Global search trigger bar with `⌘K`
- **Main Panel (`ui/src/components/layout/Layout.jsx`)**
  - Renders route pages through React Router `<Outlet />`

## Route Placeholders

The initial Prompt 02 skeleton includes route pages:

- `VmListPage.jsx` (`/vms`)
- `ClustersPage.jsx` (`/clusters`)
- `FleetDashboardPage.jsx` (`/fleet`)
- `IpamPage.jsx` (`/ipam`)
- `SettingsPage.jsx` (`/settings`)

Each page container includes a stable `data-testid` to support automated tests and CI flows.

## Live Terminal Streaming

The Clusters view now includes a reusable live terminal component:

- Component: `ui/src/components/common/LiveTerminal.jsx`
- Hook: `ui/src/hooks/useEventSource.js`
- Backend stream: `GET /api/v1/pipeline/{run_id}/stream`

Behavior:

- Subscribes to SSE log events (`stdout` and `stderr`) from active pipeline runs.
- Renders numbered terminal lines in a dark monospace panel.
- Colors `stderr` lines in amber to make failures easy to spot.
- Shows run status with spinner/success/failure state icons.
- Displays active step name and elapsed execution timer.
- Supports auto-scroll toggle and one-click copy-to-clipboard log export.

## Frontend Validation Commands

```bash
cd ~/work/git/forge-central/ui
npm test
npm run build
```
