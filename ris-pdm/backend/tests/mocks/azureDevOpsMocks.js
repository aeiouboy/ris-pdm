const nock = require('nock');

// Mock data generators
const generateWorkItem = (id, options = {}) => ({
  id,
  rev: options.rev || 1,
  fields: {
    'System.Id': id,
    'System.Title': options.title || `Work Item ${id}`,
    'System.WorkItemType': options.type || 'User Story',
    'System.State': options.state || 'Active',
    'System.AssignedTo': options.assignedTo || {
      displayName: `User ${id % 10}`,
      uniqueName: `user${id % 10}@company.com`
    },
    'System.CreatedDate': options.createdDate || '2024-01-01T00:00:00.000Z',
    'System.ChangedDate': options.changedDate || '2024-01-15T00:00:00.000Z',
    'Microsoft.VSTS.Scheduling.StoryPoints': options.storyPoints || Math.floor(Math.random() * 13) + 1,
    'Microsoft.VSTS.Common.Priority': options.priority || Math.floor(Math.random() * 4) + 1,
    'Microsoft.VSTS.Scheduling.Effort': options.effort || Math.floor(Math.random() * 20) + 5,
    'System.Description': options.description || `Description for work item ${id}`,
    'System.Tags': options.tags || 'tag1; tag2',
    'System.AreaPath': options.areaPath || 'Project\\Team',
    'System.IterationPath': options.iterationPath || 'Project\\Sprint 1',
    ...options.customFields
  },
  url: `https://dev.azure.com/test-org/_apis/wit/workItems/${id}`
});

const generateWorkItems = (count = 100, options = {}) => {
  const workItems = [];
  const types = ['User Story', 'Bug', 'Task', 'Epic'];
  const states = ['New', 'Active', 'Resolved', 'Closed'];
  
  for (let i = 1; i <= count; i++) {
    workItems.push(generateWorkItem(i, {
      type: types[i % types.length],
      state: states[i % states.length],
      storyPoints: Math.floor(Math.random() * 13) + 1,
      priority: Math.floor(Math.random() * 4) + 1,
      ...options
    }));
  }
  
  return workItems;
};

const generateTeamMember = (id, options = {}) => ({
  id: `team-member-${id}`,
  displayName: options.displayName || `Team Member ${id}`,
  uniqueName: options.uniqueName || `user${id}@company.com`,
  url: `https://vssps.dev.azure.com/test-org/_apis/identities/${id}`,
  descriptor: `aad.${id}`,
  ...options
});

const generateTeamMembers = (count = 27) => {
  return Array.from({ length: count }, (_, i) => generateTeamMember(i + 1));
};

const generateIteration = (id, options = {}) => ({
  id: `iteration-${id}`,
  name: options.name || `Sprint ${id}`,
  path: options.path || `\\Project\\Sprint ${id}`,
  url: `https://dev.azure.com/test-org/_apis/work/teamsettings/iterations/${id}`,
  attributes: {
    startDate: options.startDate || '2024-01-01T00:00:00.000Z',
    finishDate: options.finishDate || '2024-01-14T00:00:00.000Z',
    timeFrame: options.timeFrame || 'current'
  },
  ...options
});

const generateIterations = (count = 5) => {
  return Array.from({ length: count }, (_, i) => {
    const startDate = new Date(2024, 0, i * 14 + 1);
    const finishDate = new Date(2024, 0, i * 14 + 14);
    
    return generateIteration(i + 1, {
      name: `Sprint ${i + 1}`,
      startDate: startDate.toISOString(),
      finishDate: finishDate.toISOString(),
      timeFrame: i === 1 ? 'current' : i < 1 ? 'past' : 'future'
    });
  });
};

const generateCapacity = (teamMemberId, options = {}) => ({
  teamMember: {
    id: teamMemberId,
    displayName: `Team Member ${teamMemberId}`,
    uniqueName: `user${teamMemberId}@company.com`
  },
  activities: [
    {
      capacityPerDay: options.capacityPerDay || 8,
      name: options.activityName || 'Development'
    }
  ],
  daysOff: options.daysOff || []
});

// Azure DevOps API Mock Factory
class AzureDevOpsMockFactory {
  constructor(baseUrl = 'https://dev.azure.com', organization = 'test-org') {
    this.baseUrl = baseUrl;
    this.organization = organization;
    this.scope = null;
  }

  init() {
    this.scope = nock(this.baseUrl);
    return this;
  }

  mockWorkItemsQuery(options = {}) {
    const workItems = generateWorkItems(options.count || 100, options);
    
    this.scope
      .get(`/${this.organization}/_apis/wit/wiql`)
      .query(true)
      .reply(200, {
        queryType: 'flat',
        queryResultType: 'workItem',
        asOf: new Date().toISOString(),
        workItems: workItems.map(wi => ({ id: wi.id, url: wi.url }))
      });

    // Mock individual work item details
    workItems.forEach(workItem => {
      this.scope
        .get(`/${this.organization}/_apis/wit/workItems/${workItem.id}`)
        .query(true)
        .reply(200, workItem);
    });

    // Mock batch work items
    this.scope
      .post(`/${this.organization}/_apis/wit/workItemsBatch`)
      .query(true)
      .reply(200, {
        count: workItems.length,
        value: workItems
      });

    return this;
  }

  mockTeamMembers(options = {}) {
    const teamMembers = generateTeamMembers(options.count || 27);
    
    this.scope
      .get(`/${this.organization}/_apis/projects/test-project/teams/test-team/members`)
      .query(true)
      .reply(200, {
        value: teamMembers,
        count: teamMembers.length
      });

    return this;
  }

  mockIterations(options = {}) {
    const iterations = generateIterations(options.count || 5);
    
    this.scope
      .get(`/${this.organization}/test-project/_apis/work/teamsettings/iterations`)
      .query(true)
      .reply(200, {
        value: iterations,
        count: iterations.length
      });

    // Mock current iteration
    const currentIteration = iterations.find(i => i.attributes.timeFrame === 'current') || iterations[1];
    this.scope
      .get(`/${this.organization}/test-project/_apis/work/teamsettings/iterations/current`)
      .query(true)
      .reply(200, currentIteration);

    return this;
  }

  mockCapacity(options = {}) {
    const teamMembers = generateTeamMembers(options.teamSize || 27);
    const capacities = teamMembers.map((member, index) => 
      generateCapacity(index + 1, {
        capacityPerDay: options.capacityPerDay || 8,
        daysOff: options.daysOff || []
      })
    );

    this.scope
      .get(`/${this.organization}/test-project/_apis/work/teamsettings/iterations/current/capacities`)
      .query(true)
      .reply(200, {
        value: capacities,
        count: capacities.length
      });

    return this;
  }

  mockProjects() {
    this.scope
      .get(`/${this.organization}/_apis/projects`)
      .query(true)
      .reply(200, {
        value: [{
          id: 'project-id',
          name: 'test-project',
          description: 'Test project for unit tests',
          url: `${this.baseUrl}/${this.organization}/_apis/projects/project-id`,
          state: 'wellFormed',
          visibility: 'private'
        }],
        count: 1
      });

    return this;
  }

  mockWorkItemTypes() {
    const workItemTypes = [
      { name: 'User Story', color: '009CCC' },
      { name: 'Bug', color: 'CC293D' },
      { name: 'Task', color: 'F2CB1D' },
      { name: 'Epic', color: '773B93' }
    ];

    this.scope
      .get(`/${this.organization}/test-project/_apis/wit/workitemtypes`)
      .query(true)
      .reply(200, {
        value: workItemTypes,
        count: workItemTypes.length
      });

    return this;
  }

  mockBurndownData() {
    // Generate mock burndown data
    const burndownData = Array.from({ length: 14 }, (_, day) => ({
      date: new Date(2024, 0, day + 1).toISOString(),
      planned: 100 - (day * 7),
      actual: Math.max(0, 100 - (day * 7) - Math.floor(Math.random() * 10))
    }));

    this.scope
      .get(new RegExp(`/${this.organization}/test-project/_apis/work/charts/.*`))
      .query(true)
      .reply(200, {
        burndownData,
        metadata: {
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-14T00:00:00.000Z',
          totalPoints: 100
        }
      });

    return this;
  }

  mockAuthenticationSuccess() {
    this.scope
      .get(`/${this.organization}/_apis/connectionData`)
      .query(true)
      .reply(200, {
        authenticatedUser: {
          id: 'test-user-id',
          displayName: 'Test User',
          uniqueName: 'testuser@company.com'
        },
        authorizedUser: {
          id: 'test-user-id',
          displayName: 'Test User',
          uniqueName: 'testuser@company.com'
        }
      });

    return this;
  }

  mockAuthenticationFailure() {
    this.scope
      .get(`/${this.organization}/_apis/connectionData`)
      .query(true)
      .reply(401, {
        message: 'Unauthorized',
        typeKey: 'UnauthorizedRequestException'
      });

    return this;
  }

  mockRateLimitError() {
    this.scope
      .get(new RegExp(`/${this.organization}/_apis/.*`))
      .query(true)
      .reply(429, {
        message: 'API rate limit exceeded',
        headers: {
          'retry-after': '60'
        }
      });

    return this;
  }

  mockServerError() {
    this.scope
      .get(new RegExp(`/${this.organization}/_apis/.*`))
      .query(true)
      .reply(500, {
        message: 'Internal Server Error',
        typeKey: 'InternalServerErrorException'
      });

    return this;
  }

  // Setup complete mock environment
  setupComplete(options = {}) {
    return this
      .init()
      .mockAuthenticationSuccess()
      .mockProjects()
      .mockWorkItemTypes()
      .mockWorkItemsQuery(options.workItems)
      .mockTeamMembers(options.teamMembers)
      .mockIterations(options.iterations)
      .mockCapacity(options.capacity)
      .mockBurndownData();
  }

  // Cleanup mocks
  cleanup() {
    if (this.scope) {
      this.scope.cleanAll();
      nock.cleanAll();
    }
  }

  // Get mock data for assertions
  getMockData() {
    return {
      workItems: generateWorkItems(100),
      teamMembers: generateTeamMembers(27),
      iterations: generateIterations(5),
      projects: [{
        id: 'project-id',
        name: 'test-project',
        description: 'Test project for unit tests'
      }]
    };
  }
}

// Helper functions for common test scenarios
const createBasicMocks = (options = {}) => {
  const factory = new AzureDevOpsMockFactory();
  return factory.setupComplete(options);
};

const createFailureMocks = (type = 'auth') => {
  const factory = new AzureDevOpsMockFactory().init();
  
  switch (type) {
    case 'auth':
      return factory.mockAuthenticationFailure();
    case 'rateLimit':
      return factory.mockRateLimitError();
    case 'server':
      return factory.mockServerError();
    default:
      return factory;
  }
};

const cleanupMocks = () => {
  nock.cleanAll();
};

module.exports = {
  AzureDevOpsMockFactory,
  createBasicMocks,
  createFailureMocks,
  cleanupMocks,
  generateWorkItem,
  generateWorkItems,
  generateTeamMember,
  generateTeamMembers,
  generateIteration,
  generateIterations,
  generateCapacity
};