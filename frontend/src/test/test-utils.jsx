import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock WebSocket for testing
export const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN,
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,
};

// Mock Socket.IO for testing
export const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
  id: 'test-socket-id',
};

// Create a wrapper component that provides necessary context
function TestWrapper({ children }) {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
}

// Custom render function that includes router context
function render(ui, options = {}) {
  return rtlRender(ui, { wrapper: TestWrapper, ...options });
}

// Mock data generators
export const generateMockMetrics = (overrides = {}) => ({
  kpis: {
    plYtd: 1250000,
    velocity: 32,
    bugCount: 5,
    satisfaction: 4.2,
    ...overrides.kpis
  },
  charts: {
    sprintBurndown: [
      { date: '2024-01-01', planned: 100, actual: 95 },
      { date: '2024-01-02', planned: 90, actual: 85 },
      { date: '2024-01-03', planned: 80, actual: 75 },
      { date: '2024-01-04', planned: 70, actual: 65 },
      { date: '2024-01-05', planned: 60, actual: 55 },
      ...overrides.charts?.sprintBurndown || []
    ],
    teamVelocity: [
      { sprint: 'Sprint 1', velocity: 28 },
      { sprint: 'Sprint 2', velocity: 32 },
      { sprint: 'Sprint 3', velocity: 30 },
      { sprint: 'Sprint 4', velocity: 35 },
      ...overrides.charts?.teamVelocity || []
    ],
    taskDistribution: [
      { name: 'User Story', value: 45, color: '#3B82F6' },
      { name: 'Bug', value: 15, color: '#EF4444' },
      { name: 'Task', value: 25, color: '#10B981' },
      { name: 'Epic', value: 15, color: '#8B5CF6' },
      ...overrides.charts?.taskDistribution || []
    ]
  },
  metadata: {
    lastUpdate: new Date().toISOString(),
    totalItems: 2000,
    teamSize: 27,
    ...overrides.metadata
  },
  ...overrides
});

export const generateMockWorkItems = (count = 10) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Work Item ${index + 1}`,
    state: ['New', 'Active', 'Resolved', 'Closed'][index % 4],
    workItemType: ['User Story', 'Bug', 'Task', 'Epic'][index % 4],
    assignedTo: `user${(index % 5) + 1}@company.com`,
    storyPoints: Math.floor(Math.random() * 13) + 1,
    priority: Math.floor(Math.random() * 4) + 1,
    createdDate: new Date(2024, 0, index + 1).toISOString(),
    changedDate: new Date(2024, 0, index + 15).toISOString(),
  }));
};

export const generateMockTeamMembers = (count = 27) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `user${index + 1}`,
    displayName: `Team Member ${index + 1}`,
    uniqueName: `user${index + 1}@company.com`,
    avatar: `https://avatar.example.com/user${index + 1}`,
    capacity: 8,
    daysOff: Math.floor(Math.random() * 3),
  }));
};

// Mock API responses
export const mockApiResponses = {
  metrics: generateMockMetrics(),
  workItems: generateMockWorkItems(100),
  teamMembers: generateMockTeamMembers(),
  sprints: [
    { id: 'sprint-1', name: 'Sprint 1', state: 'closed' },
    { id: 'sprint-2', name: 'Sprint 2', state: 'active' },
    { id: 'sprint-3', name: 'Sprint 3', state: 'future' },
  ],
  products: [
    { id: 'product-a', name: 'Product A', description: 'Main product' },
    { id: 'product-b', name: 'Product B', description: 'Secondary product' },
  ]
};

// Test helpers for async operations
export const waitForLoadingToFinish = async () => {
  const { waitForElementToBeRemoved } = await import('@testing-library/react');
  try {
    await waitForElementToBeRemoved(
      () => document.querySelector('[data-testid="loading"]') || 
             document.querySelector('.animate-pulse') ||
             document.querySelector('[data-loading="true"]'),
      { timeout: 5000 }
    );
  } catch (error) {
    // Loading element might not exist or might have finished already
    console.debug('Loading element not found or finished quickly');
  }
};

// Mock fetch for API calls
export const mockFetch = (responses = {}) => {
  return vi.fn().mockImplementation((url) => {
    const urlString = url.toString();
    
    if (urlString.includes('/api/metrics')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses.metrics || mockApiResponses.metrics),
      });
    }
    
    if (urlString.includes('/api/workitems')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses.workItems || mockApiResponses.workItems),
      });
    }
    
    if (urlString.includes('/api/users')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses.teamMembers || mockApiResponses.teamMembers),
      });
    }
    
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  });
};

// Export everything including the custom render
export * from '@testing-library/react';
export { render };
export { default as userEvent } from '@testing-library/user-event';