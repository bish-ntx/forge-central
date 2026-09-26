import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import InventoryYamlViewer from '../InventoryYamlViewer.jsx';

describe('InventoryYamlViewer', () => {
  const mockRawYaml = `apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
kind: PreprovisionedInventory
metadata:
  name: inventory-lab-01
spec:
  hosts:
    - address: 10.10.40.11
    - address: 10.10.40.21`;

  const mockCpNodes = ['10.10.40.11', '10.10.40.12', '10.10.40.13'];
  const mockWorkerNodes = ['10.10.40.21', '10.10.40.22'];

  const mockCheckResults = [
    { name: 'YAML Syntax & Kind Validation', status: 'pass', message: 'Valid PreprovisionedInventory manifest syntax.' },
    { name: 'Control Plane Quorum', status: 'pass', message: 'Optimal etcd HA quorum with 3 control plane nodes.' },
    { name: 'Network Connectivity', status: 'warn', message: 'Subnet latency higher than 50ms.' },
  ];

  test('renders filename, YAML text, and node chips correctly', () => {
    render(
      <InventoryYamlViewer
        filename="inventory-lab-01.yaml"
        rawYaml={mockRawYaml}
        controlPlaneNodes={mockCpNodes}
        workerNodes={mockWorkerNodes}
      />
    );

    expect(screen.getByTestId('inventory-filename')).toHaveTextContent('inventory-lab-01.yaml');
    expect(screen.getByTestId('inventory-yaml-text')).toHaveTextContent('kind: PreprovisionedInventory');

    const cpChip = screen.getByTestId('chip-cp-nodes');
    expect(cpChip).toHaveTextContent('Control Plane: 3 Nodes');

    const workerChip = screen.getByTestId('chip-worker-nodes');
    expect(workerChip).toHaveTextContent('Worker: 2 Nodes');
  });

  test('triggers copy-to-clipboard and calls onCopy callback', async () => {
    const handleCopy = vi.fn();

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });

    render(
      <InventoryYamlViewer
        filename="inventory-lab-01.yaml"
        rawYaml={mockRawYaml}
        onCopy={handleCopy}
      />
    );

    const copyBtn = screen.getByTestId('btn-copy-yaml');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockRawYaml);
    expect(handleCopy).toHaveBeenCalledWith(mockRawYaml);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  test('renders validation check status badges with pass and warn statuses', () => {
    render(
      <InventoryYamlViewer
        filename="inventory-lab-01.yaml"
        rawYaml={mockRawYaml}
        checkResults={mockCheckResults}
        isValid={true}
      />
    );

    const badges = screen.getAllByTestId('validation-status-badge');
    expect(badges).toHaveLength(3);

    expect(screen.getByText('YAML Syntax & Kind Validation')).toBeInTheDocument();
    expect(screen.getByText('Control Plane Quorum')).toBeInTheDocument();
    expect(screen.getByText('Network Connectivity')).toBeInTheDocument();
    expect(screen.getByText('Subnet latency higher than 50ms.')).toBeInTheDocument();
  });
});
