# Product Requirements Document (PRD)
## Performance Dashboard - RIS Product Team

### Document Information
- **Version:** 1.0
- **Date:** July 22, 2025
- **Author:** Product Team
- **Status:** Draft

---

## 1. Executive Summary

### 1.1 Purpose
พัฒนาระบบ Performance Dashboard สำหรับติดตามและวิเคราะห์ประสิทธิภาพการทำงานของแต่ละ Product ภายใน RIS Product Team โดยแสดงข้อมูลเชิงลึกด้าน P/L, Stakeholder satisfaction, Productivity, Issues และ Quality metrics

### 1.2 Problem Statement
ปัจจุบันทีมขาดระบบกลางในการติดตามประสิทธิภาพการทำงานแบบ real-time ทำให้การตัดสินใจและการปรับปรุงกระบวนการทำงานเป็นไปอย่างล่าช้า

### 1.3 Solution Overview
สร้าง Web-based Dashboard ที่ดึงข้อมูลจาก Azure DevOps API แสดงผลแบบ Interactive Charts พร้อมระบบ Filter ที่ยืดหยุ่น รองรับการใช้งานบน Mobile Device

---

## 2. Goals & Success Metrics

### 2.1 Business Goals
- เพิ่มความโปร่งใสในการติดตามผลงานของแต่ละ Product
- ลดเวลาในการรวบรวมข้อมูลสำหรับ Management Review จาก 4 ชั่วโมง เหลือ 30 นาที
- ปรับปรุง Team Productivity โดยเฉลี่ย 15% ภายใน 6 เดือน

### 2.2 Success Metrics
- User Adoption Rate > 80% ภายใน 1 เดือนหลัง Launch
- Dashboard Load Time < 3 วินาที
- Mobile Usage > 30% ของ Total Sessions
- Data Accuracy > 99.5%

---

## 3. User Personas

### 3.1 Product Manager
- **Needs:** ติดตาม Overall Performance, P/L Analysis, Stakeholder Feedback
- **Pain Points:** ต้องรวบรวมข้อมูลจากหลายแหล่ง, ใช้เวลานานในการทำ Report

### 3.2 Team Lead
- **Needs:** ติดตาม Team Productivity, Individual Performance, Sprint Progress
- **Pain Points:** ไม่มี Real-time Visibility, ยากต่อการ Identify Bottlenecks

### 3.3 Developer
- **Needs:** ดู Personal Performance, Task Status, Quality Metrics
- **Pain Points:** ไม่เห็นภาพรวมของ Contribution ต่อ Product Success

### 3.4 Executive
- **Needs:** High-level Overview, P/L Trends, Cross-product Comparison
- **Pain Points:** ข้อมูลกระจัดกระจาย, ไม่มี Single Source of Truth

---

## 4. Feature Requirements

### 4.1 High-Level Features

#### 4.1.1 Product Selection
- Dropdown หรือ Tab Navigation สำหรับเลือก Product
- Quick Switch between Products
- Product Comparison View (Phase 2)

#### 4.1.2 Metrics Dashboard
**P/L Metrics:**
- Revenue Tracking
- Cost Analysis
- Profit Margin Trends
- Budget vs Actual

**Stakeholder Metrics:**
- Satisfaction Score
- Feedback Summary
- Response Time Analytics

**Productivity Metrics:**
- Velocity Trends
- Story Points Completed
- Sprint Burndown
- Cycle Time Analysis

**Quality Metrics:**
- Bug Count & Severity
- Code Review Metrics
- Test Coverage
- Technical Debt Tracking

**Issue Tracking:**
- Open/Closed Issues Ratio
- Issue Resolution Time
- Priority Distribution
- Blocker Analysis

#### 4.1.3 Visualization Types
- **Line Charts:** Trends over time (Velocity, P/L)
- **Bar Charts:** Comparisons (Story Points by Member)
- **Pie Charts:** Distribution (Task Types, Issue Priority)
- **Heatmaps:** Team Activity Patterns
- **KPI Cards:** Key metrics with trend indicators

#### 4.1.4 Filtering System
- **Time Filters:**
  - Sprint Selection (Current, Previous, Custom Range)
  - Calendar Date Picker
  - Quick Filters (Last 7/30/90 days)
  - Quarter/Year View

- **Data Filters:**
  - Team Member Selection
  - Task Type
  - Status
  - Priority Level

#### 4.1.5 Individual Performance View
- Personal Dashboard per Team Member
- Task Completion Rate
- Story Points Delivered
- Quality Metrics (Bugs Created vs Fixed)
- Contribution Timeline

### 4.2 Mid-Level Requirements

#### 4.2.1 User Interface
- Clean, modern design using Tailwind CSS
- Dark/Light mode toggle
- Customizable Dashboard Layout
- Export functionality (PDF, Excel)
- Real-time data refresh indicators

#### 4.2.2 Mobile Responsiveness
- Responsive grid system
- Touch-optimized interactions
- Simplified navigation for mobile
- Offline capability for viewing cached data
- Native app considerations (Phase 2)

#### 4.2.3 Performance Requirements
- Initial load time < 3 seconds
- Chart rendering < 1 second
- API response time < 500ms
- Support 100+ concurrent users

### 4.3 Low-Level Technical Requirements

#### 4.3.1 Azure DevOps Integration
**API Endpoints & Implementation:**

**1. Query Work Items (WIQL)**
```javascript
// Get all work items for a specific project
const getWorkItems = async () => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      },
      body: JSON.stringify({
        query: `SELECT [System.Id], [System.Title], [System.WorkItemType], 
                [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints],
                [System.CreatedDate], [System.ChangedDate], [System.AreaPath], 
                [System.IterationPath]
                FROM WorkItems 
                WHERE [System.TeamProject] = @project 
                AND [System.WorkItemType] IN ('Task', 'Bug', 'User Story')
                AND [System.State] <> 'Removed'
                ORDER BY [System.ChangedDate] DESC`
      })
    }
  );
  
  const data = await response.json();
  return data.workItems;
};
```

**2. Get Work Item Details with All Fields**
```javascript
// Fetch detailed information for specific work items
const getWorkItemDetails = async (workItemIds) => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  // Batch request for multiple work items
  const ids = workItemIds.join(',');
  const fields = [
    'System.Id',
    'System.Title',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.State',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'System.CreatedDate',
    'System.ChangedDate',
    'System.Tags',
    'System.AreaPath',
    'System.IterationPath',
    'Microsoft.VSTS.Common.Priority',
    'Microsoft.VSTS.Scheduling.RemainingWork',
    'Microsoft.VSTS.Scheduling.CompletedWork'
  ].join(',');
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems?ids=${ids}&fields=${fields}&api-version=7.0`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      }
    }
  );
  
  return await response.json();
};
```

**3. Get Sprint/Iteration Data**
```javascript
// Get current and past iterations
const getIterations = async (teamName) => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.0`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      }
    }
  );
  
  return await response.json();
};
```

**4. Get Team Capacity and Velocity**
```javascript
// Get team capacity for a specific iteration
const getTeamCapacity = async (teamName, iterationId) => {
  const organization = 'your-org';
  const project = 'your-project';
  const pat = 'YOUR_AZURE_DEVOPS_PAT_HERE';
  
  const response = await fetch(
    `https://dev.azure.com/${organization}/${project}/${teamName}/_apis/work/teamsettings/iterations/${iterationId}/capacities?api-version=7.0`,
    {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
      }
    }
  );
  
  return await response.json();
};
```

**5. Real cURL Examples for Testing**
```bash
# Query work items with specific conditions
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic OjluZTdTS01WV04wZG5FakRmVmtpelIzSE9wbDU1UlBJWmpxR0gwcVFJa21JUnFTUU5iSUhKUVFKOTlCR0FDQUFBQXZBZTZKQUFBU0FaRE8xZDZ1" \
  -d '{
    "query": "SELECT [System.Id], [System.Title], [System.WorkItemType], [System.AssignedTo], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints] FROM WorkItems WHERE [System.State] = \"In Progress\" AND [System.WorkItemType] = \"Task\""
  }' \
  "https://dev.azure.com/your-org/your-project/_apis/wit/wiql?api-version=7.0"

# Get specific work item details
curl -X GET \
  -H "Authorization: Basic OjluZTdTS01WV04wZG5FakRmVmtpelIzSE9wbDU1UlBJWmpxR0gwcVFJa21JUnFTUU5iSUhKUVFKOTlCR0FDQUFBQXZBZTZKQUFBU0FaRE8xZDZ1" \
  "https://dev.azure.com/your-org/your-project/_apis/wit/workitems/123?api-version=7.0"
```

**Authentication Setup:**
```javascript
// Configuration object for Azure DevOps
const azureDevOpsConfig = {
  organization: process.env.AZURE_DEVOPS_ORG,
  project: process.env.AZURE_DEVOPS_PROJECT,
  pat: process.env.AZURE_DEVOPS_PAT,
  apiVersion: '7.0'
};

// Helper function for authenticated requests
const makeAzureRequest = async (endpoint, options = {}) => {
  const baseUrl = `https://dev.azure.com/${azureDevOpsConfig.organization}`;
  const auth = Buffer.from(`:${azureDevOpsConfig.pat}`).toString('base64');
  
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};
```

**Data Fields Mapping:**
```javascript
// Complete field mapping for Azure DevOps work items
const fieldMapping = {
  id: 'System.Id',
  title: 'System.Title',
  type: 'System.WorkItemType',
  assignee: 'System.AssignedTo',
  state: 'System.State',
  storyPoints: 'Microsoft.VSTS.Scheduling.StoryPoints',
  priority: 'Microsoft.VSTS.Common.Priority',
  createdDate: 'System.CreatedDate',
  changedDate: 'System.ChangedDate',
  closedDate: 'Microsoft.VSTS.Common.ClosedDate',
  tags: 'System.Tags',
  areaPath: 'System.AreaPath',
  iterationPath: 'System.IterationPath',
  remainingWork: 'Microsoft.VSTS.Scheduling.RemainingWork',
  completedWork: 'Microsoft.VSTS.Scheduling.CompletedWork',
  originalEstimate: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
  blockedReason: 'System.Reason',
  parent: 'System.Parent'
};

// Transform Azure DevOps response to our data model
const transformWorkItem = (azureWorkItem) => {
  const fields = azureWorkItem.fields;
  return {
    id: fields['System.Id'],
    title: fields['System.Title'],
    type: fields['System.WorkItemType'],
    assignee: fields['System.AssignedTo']?.displayName || 'Unassigned',
    assigneeEmail: fields['System.AssignedTo']?.uniqueName,
    state: fields['System.State'],
    storyPoints: fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
    priority: fields['Microsoft.VSTS.Common.Priority'] || 4,
    createdDate: fields['System.CreatedDate'],
    changedDate: fields['System.ChangedDate'],
    closedDate: fields['Microsoft.VSTS.Common.ClosedDate'],
    tags: fields['System.Tags']?.split(';').filter(t => t) || [],
    areaPath: fields['System.AreaPath'],
    iterationPath: fields['System.IterationPath'],
    remainingWork: fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 0,
    completedWork: fields['Microsoft.VSTS.Scheduling.CompletedWork'] || 0
  };
};
```

#### 4.3.2 Data Processing
- **Caching Strategy:**
  - Redis for real-time data (5-minute TTL)
  - PostgreSQL for historical data
  - Background jobs for data synchronization

- **Aggregation Logic:**
  - Sprint velocity calculation
  - Burndown chart data preparation
  - Performance scoring algorithm
  - Trend analysis calculations

#### 4.3.3 Technology Stack
**Frontend:**
- React.js or Vue.js
- Tailwind CSS for styling
- Chart.js or D3.js for visualizations
- Redux/Vuex for state management
- Progressive Web App (PWA) capabilities

**Backend:**
- Node.js with Express or .NET Core
- GraphQL or REST API
- WebSocket for real-time updates

**Infrastructure:**
- Docker containers
- Kubernetes for orchestration
- Azure App Service or AWS ECS
- CDN for static assets

---

## 5. User Experience

### 5.1 Information Architecture
```
Dashboard
├── Product Selector
├── Overview Dashboard
│   ├── P/L Summary
│   ├── Productivity Metrics
│   ├── Quality Indicators
│   └── Issue Statistics
├── Detailed Views
│   ├── Financial Analysis
│   ├── Sprint Performance
│   ├── Team Performance
│   └── Individual Performance
├── Reports
│   ├── Export Options
│   └── Scheduled Reports
└── Settings
    ├── User Preferences
    ├── Notification Settings
    └── Data Source Configuration
```

### 5.2 User Flow
1. **Login** → Authenticate with Azure AD
2. **Product Selection** → Choose product from dropdown
3. **Dashboard View** → See overview metrics
4. **Apply Filters** → Refine data view
5. **Drill Down** → Click on metrics for details
6. **Export/Share** → Generate reports

### 5.3 Mobile UX Considerations
- Bottom navigation for primary actions
- Swipe gestures for switching between views
- Collapsible sections for space optimization
- Touch-friendly chart interactions
- Simplified data presentation

---

## 6. Security & Compliance

### 6.1 Security Requirements
- Role-based access control (RBAC)
- Data encryption in transit (TLS 1.3)
- Data encryption at rest
- Audit logging for all data access
- Regular security vulnerability scanning

### 6.2 Compliance
- GDPR compliance for personal data
- SOC 2 Type II certification alignment
- Data retention policies (90 days for detailed, 2 years for aggregated)

---

## 7. Performance & Scalability

### 7.1 Performance Targets
- 99.9% uptime SLA
- < 100ms API response time (cached)
- < 500ms API response time (fresh data)
- Support 1000 concurrent users
- Handle 100,000 work items per product

### 7.2 Scalability Plan
- Horizontal scaling for API servers
- Database sharding by product
- CDN integration for global access
- Microservices architecture for future growth

---

## 8. Integration Requirements

### 8.1 Current Integrations
- Azure DevOps (Primary data source)
- Azure Active Directory (Authentication)
- Microsoft Teams (Notifications - Phase 2)

### 8.2 Future Integrations
- Jira (Alternative to Azure DevOps)
- Slack (Notifications)
- Power BI (Advanced Analytics)
- Finance Systems (P/L Data)

---

## 9. MVP Scope

### Phase 1 (MVP - 3 months)
- Basic dashboard with core metrics
- Azure DevOps integration
- Product selection
- Sprint/Calendar filters
- Basic charts (Line, Bar, Pie)
- Mobile responsive design
- Individual performance view

### Phase 2 (3-6 months)
- Advanced analytics
- Custom dashboard creation
- Automated reporting
- Teams/Slack integration
- Performance predictions
- Multi-product comparison

### Phase 3 (6-12 months)
- AI-powered insights
- Resource optimization suggestions
- External stakeholder portal
- API for third-party integrations
- Native mobile apps

---

## 10. Risks & Mitigation

### 10.1 Technical Risks
| Risk | Impact | Mitigation |
|------|---------|------------|
| Azure DevOps API Rate Limits | High | Implement intelligent caching and batch requests |
| Data Accuracy Issues | High | Validation rules and reconciliation processes |
| Performance Degradation | Medium | Monitoring and auto-scaling |

### 10.2 Business Risks
| Risk | Impact | Mitigation |
|------|---------|------------|
| Low User Adoption | High | Training programs and gradual rollout |
| Scope Creep | Medium | Clear MVP definition and change management |
| Data Privacy Concerns | High | Clear data usage policies and opt-in features |

---

## 11. Success Criteria

### 11.1 Launch Criteria
- All MVP features implemented and tested
- Performance benchmarks met
- Security audit passed
- User acceptance testing completed
- Documentation and training materials ready

### 11.2 Post-Launch Success Metrics
- 80% of team members actively using the dashboard weekly
- 50% reduction in time spent creating reports
- 90% user satisfaction score
- Zero critical security incidents
- < 0.1% data discrepancy rate

---

## 12. Timeline & Milestones

### Development Timeline (MVP)
- **Week 1-2:** Technical architecture and setup
- **Week 3-4:** Azure DevOps integration
- **Week 5-8:** Core dashboard development
- **Week 9-10:** Mobile optimization
- **Week 11:** Testing and bug fixes
- **Week 12:** Deployment and launch

### Key Milestones
- Architecture Review Complete
- API Integration Complete
- Alpha Version Ready
- Beta Testing Start
- Production Launch

---

## 13. Appendix

### A. Design Mockups & Wireframes

#### A.1 Desktop Dashboard Mockup
```
┌─────────────────────────────────────────────────────────────────────┐
│ RIS Performance Dashboard                        [User] [Settings] ▼ │
├─────────────────────────────────────────────────────────────────────┤
│ Product: [Product A ▼] Sprint: [Sprint 23 ▼] Date: [Jul 1-15 ▼]    │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│ │   P/L YTD   │ │  Velocity   │ │ Bug Count   │ │ Satisfaction│   │
│ │   +15.2%    │ │  42 pts/spr │ │     23      │ │    4.2/5    │   │
│ │   ▲ $1.2M   │ │   ▲ 12%     │ │   ▼ -8%     │ │    ▲ 0.3    │   │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│ │     Sprint Burndown         │ │    Team Velocity Trend      │   │
│ │         [Chart]             │ │         [Chart]             │   │
│ └─────────────────────────────┘ └─────────────────────────────┘   │
│                                                                     │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│ │   Task Distribution         │ │  Individual Performance     │   │
│ │      [Pie Chart]            │ │      [Bar Chart]            │   │
│ └─────────────────────────────┘ └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

#### A.2 Mobile Dashboard Mockup
```
┌─────────────────┐
│ ≡ RIS Dashboard │
├─────────────────┤
│ Product A    ▼  │
│ Sprint 23    ▼  │
├─────────────────┤
│ ┌─────────────┐ │
│ │  P/L +15.2% │ │
│ │  Vel: 42pts │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Bugs: 23    │ │
│ │ Sat: 4.2/5  │ │
│ └─────────────┘ │
├─────────────────┤
│ [Sprint Chart]  │
│                 │
├─────────────────┤
│ [Team Stats]    │
│                 │
├─────────────────┤
│ 🏠 📊 👥 ⚙️    │
└─────────────────┘
```

#### A.3 Individual Performance View
```
┌────────────────────────────────────────────────────────────┐
│                   John Doe - Performance                    │
├────────────────────────────────────────────────────────────┤
│  Current Sprint    Last 30 Days    Quarter    Year         │
├────────────────────────────────────────────────────────────┤
│ Story Points: 21   Completed Tasks: 8   Quality Score: 92% │
│ ┌──────────────────────────┐ ┌──────────────────────────┐ │
│ │  Weekly Velocity Trend   │ │   Task Type Breakdown    │ │
│ │      [Line Chart]        │ │      [Pie Chart]         │ │
│ └──────────────────────────┘ └──────────────────────────┘ │
│                                                             │
│ Recent Tasks:                                               │
│ ✓ TASK-123: Implement login API          [8 pts] Done     │
│ ⚡ TASK-124: Database optimization        [5 pts] In Prog  │
│ ○ TASK-125: Unit test coverage           [3 pts] To Do    │
└────────────────────────────────────────────────────────────┘
```

### B. Research Tasks & Documentation

#### B.1 Pre-Development Research Tasks

**1. Technical Feasibility Study**
- **Objective:** Validate Azure DevOps API capabilities and limitations
- **Duration:** 1 week
- **Deliverables:**
  - API rate limit analysis
  - Data availability assessment
  - Performance benchmarking results
  - Integration complexity report

**2. User Research & Requirements Gathering**
- **Objective:** Deep dive into user needs and pain points
- **Duration:** 2 weeks
- **Activities:**
  - Interview 10+ stakeholders across roles
  - Shadow current reporting processes
  - Analyze existing tools and gaps
  - Create user journey maps
- **Deliverables:**
  - User interview transcripts
  - Pain point analysis document
  - Feature prioritization matrix
  - User journey documentation

**3. Competitive Analysis**
- **Objective:** Benchmark against industry solutions
- **Duration:** 1 week
- **Tools to Analyze:**
  - Azure DevOps Analytics
  - Jira Advanced Roadmaps
  - Monday.dev
  - LinearB
  - Velocity by Code Climate
- **Deliverables:**
  - Feature comparison matrix
  - Pricing analysis
  - Strengths/weaknesses report
  - Recommendation document

**4. Technology Stack Research**
- **Objective:** Select optimal technologies
- **Duration:** 1 week
- **Areas:**
  - Frontend framework comparison (React vs Vue vs Angular)
  - Charting library evaluation (Chart.js vs D3.js vs Recharts)
  - Backend performance testing (Node.js vs .NET Core)
  - Database selection (PostgreSQL vs MongoDB)
  - Caching solutions (Redis vs Memcached)
- **Deliverables:**
  - Technology comparison matrix
  - Performance benchmark results
  - Architecture decision records (ADRs)

#### B.2 Research Documentation Structure

**1. API Integration Research Document**
```markdown
# Azure DevOps API Integration Research

## Executive Summary
- API capabilities overview
- Key findings and limitations
- Recommended approach

## API Endpoints Analysis
### Work Items API
- Endpoint details
- Query capabilities
- Performance metrics
- Rate limits

### Analytics API
- OData queries
- Aggregation capabilities
- Historical data access

## Data Model Mapping
- Azure DevOps fields → Our data model
- Transformation requirements
- Data quality considerations

## Performance Testing Results
- Response time analysis
- Concurrent request handling
- Caching strategy recommendations

## Security Considerations
- Authentication methods
- Token management
- Data privacy compliance

## Implementation Recommendations
- Batch processing strategies
- Error handling approaches
- Monitoring requirements
```

**2. User Research Findings Template**
```markdown
# User Research Findings - Performance Dashboard

## Research Methodology
- Interview count: X participants
- Survey responses: Y participants
- Observation sessions: Z hours

## Key Findings

### Pain Points
1. [Pain Point 1]
   - Frequency: High/Medium/Low
   - Impact: High/Medium/Low
   - User Quote: "..."

### Feature Requests
1. [Feature 1]
   - Requested by: X% of users
   - Priority: Must Have/Nice to Have
   - Use Case: ...

## User Personas Deep Dive
### Product Manager Insights
- Daily workflows
- Critical metrics
- Tool preferences

## Recommendations
- Priority 1 features
- Quick wins
- Long-term vision
```

#### B.3 Design System Documentation

**Component Library Specifications:**
```css
/* Tailwind CSS Custom Configuration */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      boxShadow: {
        'dashboard': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }
    }
  }
}
```

**Chart.js Configuration Examples:**
```javascript
// Velocity Trend Chart Configuration
const velocityChartConfig = {
  type: 'line',
  data: {
    labels: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'],
    datasets: [{
      label: 'Team Velocity',
      data: [32, 38, 35, 42],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Story Points'
        }
      }
    }
  }
};

// Task Distribution Pie Chart
const taskDistributionConfig = {
  type: 'pie',
  data: {
    labels: ['Development', 'Bug Fixes', 'Testing', 'Documentation'],
    datasets: [{
      data: [45, 25, 20, 10],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(245, 158, 11, 0.8)'
      ]
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      }
    }
  }
};
```

### C. Database Schema Design

```sql
-- Performance metrics table
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(100) NOT NULL,
    sprint_id VARCHAR(100) NOT NULL,
    metric_date DATE NOT NULL,
    velocity INTEGER,
    bugs_created INTEGER DEFAULT 0,
    bugs_resolved INTEGER DEFAULT 0,
    story_points_completed INTEGER DEFAULT 0,
    story_points_committed INTEGER DEFAULT 0,
    team_satisfaction DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual performance table
CREATE TABLE individual_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    sprint_id VARCHAR(100) NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    story_points_delivered INTEGER DEFAULT 0,
    bugs_created INTEGER DEFAULT 0,
    bugs_fixed INTEGER DEFAULT 0,
    code_review_count INTEGER DEFAULT 0,
    average_cycle_time DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work items cache table
CREATE TABLE work_items_cache (
    work_item_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    item_type VARCHAR(50),
    assignee_email VARCHAR(255),
    state VARCHAR(50),
    story_points INTEGER,
    priority INTEGER,
    area_path VARCHAR(255),
    iteration_path VARCHAR(255),
    created_date TIMESTAMP,
    changed_date TIMESTAMP,
    raw_data JSONB,
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_metrics_product_sprint ON performance_metrics(product_id, sprint_id);
CREATE INDEX idx_individual_perf_user_sprint ON individual_performance(user_email, sprint_id);
CREATE INDEX idx_work_items_assignee ON work_items_cache(assignee_email);
CREATE INDEX idx_work_items_iteration ON work_items_cache(iteration_path);
```

### D. API Documentation

**RESTful API Endpoints:**
```yaml
openapi: 3.0.0
info:
  title: RIS Performance Dashboard API
  version: 1.0.0
  
paths:
  /api/products:
    get:
      summary: Get all products
      responses:
        200:
          description: List of products
          
  /api/products/{productId}/metrics:
    get:
      summary: Get product metrics
      parameters:
        - name: productId
          in: path
          required: true
        - name: sprintId
          in: query
        - name: startDate
          in: query
        - name: endDate
          in: query
      responses:
        200:
          description: Product metrics data
          
  /api/users/{userId}/performance:
    get:
      summary: Get individual performance metrics
      parameters:
        - name: userId
          in: path
          required: true
        - name: period
          in: query
          enum: [sprint, month, quarter, year]
      responses:
        200:
          description: Individual performance data
```

### E. Testing Strategy Document

```markdown
# Testing Strategy - Performance Dashboard

## Unit Testing
- Target: 80% code coverage
- Framework: Jest for frontend, Mocha for backend
- Mock Azure DevOps API responses

## Integration Testing
- API endpoint testing with Supertest
- Database integration tests
- Authentication flow testing

## E2E Testing
- Framework: Cypress
- Critical user journeys:
  1. Login → Select Product → View Dashboard
  2. Apply Filters → Export Report
  3. View Individual Performance
  
## Performance Testing
- Tool: K6 or JMeter
- Scenarios:
  - 100 concurrent users
  - 1000 API requests/minute
  - Large dataset rendering (10,000 work items)

## Security Testing
- OWASP Top 10 verification
- Penetration testing
- API security scanning
```

### F. Deployment & Operations Guide

```bash
# Docker deployment example
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

# Kubernetes deployment manifest
apiVersion: apps/v1
kind: Deployment
metadata:
  name: performance-dashboard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: performance-dashboard
  template:
    metadata:
      labels:
        app: performance-dashboard
    spec:
      containers:
      - name: dashboard
        image: ris-dashboard:latest
        ports:
        - containerPort: 3000
        env:
        - name: AZURE_DEVOPS_PAT
          valueFrom:
            secretKeyRef:
              name: azure-devops-secret
              key: pat
```

---

## 14. Claude Code Implementation Guide

### 14.1 Project Structure for Claude Code

```
performance-dashboard/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   │   ├── MetricCard.jsx
│   │   │   │   ├── VelocityChart.jsx
│   │   │   │   ├── BurndownChart.jsx
│   │   │   │   └── TeamPerformance.jsx
│   │   │   ├── Filters/
│   │   │   │   ├── ProductSelector.jsx
│   │   │   │   ├── SprintFilter.jsx
│   │   │   │   └── DateRangePicker.jsx
│   │   │   └── Layout/
│   │   │       ├── Header.jsx
│   │   │       ├── Sidebar.jsx
│   │   │       └── MobileNav.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── IndividualPerformance.jsx
│   │   │   └── Reports.jsx
│   │   ├── hooks/
│   │   │   ├── useAzureDevOps.js
│   │   │   ├── useMetrics.js
│   │   │   └── useFilters.js
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   ├── chartConfigs.js
│   │   │   └── dataTransformers.js
│   │   ├── App.jsx
│   │   └── index.js
│   ├── public/
│   ├── package.json
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── metrics.js
│   │   │   ├── workItems.js
│   │   │   └── auth.js
│   │   ├── services/
│   │   │   ├── azureDevOpsService.js
│   │   │   ├── metricsCalculator.js
│   │   │   └── cacheService.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── errorHandler.js
│   │   ├── config/
│   │   │   └── database.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── docker-compose.yml
├── README.md
└── .gitignore
```

### 14.2 Step-by-Step Implementation with Claude Code

#### Phase 1: Initial Setup (Day 1)
```bash
# Claude Code commands to initialize project
claude-code create performance-dashboard
cd performance-dashboard

# Setup frontend
claude-code generate react-app frontend --tailwind --routing
cd frontend
npm install axios recharts date-fns

# Setup backend
cd ..
claude-code generate express-api backend --cors --auth
cd backend
npm install node-fetch redis bull dotenv
```

#### Phase 2: Azure DevOps Integration (Days 2-3)
```javascript
// Request to Claude Code:
// "Create an Azure DevOps service that fetches work items with caching"

// Expected implementation by Claude Code:
// backend/src/services/azureDevOpsService.js
class AzureDevOpsService {
  constructor() {
    this.baseUrl = `https://dev.azure.com/${process.env.AZURE_ORG}`;
    this.headers = {
      'Authorization': `Basic ${Buffer.from(`:${process.env.AZURE_PAT}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  async getWorkItems(project, query) {
    // Implementation with error handling and caching
  }
}
```

#### Phase 3: Frontend Components (Days 4-6)
```bash
# Claude Code prompts for component generation:
claude-code generate component MetricCard --props "title,value,trend,icon"
claude-code generate component VelocityChart --with-recharts
claude-code generate component ProductSelector --with-api-integration
```

### 14.3 Claude Code-Specific Considerations

#### 14.3.1 Environment Configuration
```bash
# .env.example for Claude Code
AZURE_DEVOPS_ORG=your-organization
AZURE_DEVOPS_PROJECT=your-project
AZURE_DEVOPS_PAT=your-personal-access-token
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:password@localhost:5432/dashboard
PORT=3001
REACT_APP_API_URL=http://localhost:3001/api
```

#### 14.3.2 Claude Code Prompts for Complex Features

**1. Dashboard State Management:**
```
"Create a React context for managing dashboard filters including product selection, 
sprint filter, and date range. Include localStorage persistence for user preferences."
```

**2. Real-time Updates:**
```
"Implement WebSocket connection for real-time metric updates. Create a hook called 
useRealtimeMetrics that subscribes to metric changes for the selected product."
```

**3. Mobile Optimization:**
```
"Create a responsive dashboard layout that switches from grid to stack on mobile. 
Include swipe gestures for switching between metric cards on mobile devices."
```

#### 14.3.3 Testing with Claude Code
```bash
# Generate test files
claude-code generate tests --unit --integration

# Test file structure
tests/
├── unit/
│   ├── services/
│   │   └── azureDevOpsService.test.js
│   └── utils/
│       └── dataTransformers.test.js
├── integration/
│   └── api/
│       └── metrics.test.js
└── e2e/
    └── dashboard.test.js
```

### 14.4 Claude Code Implementation Checklist

#### Week 1: Foundation
- [ ] Initialize project structure
- [ ] Setup development environment
- [ ] Configure Azure DevOps authentication
- [ ] Create base API structure
- [ ] Setup database schema
- [ ] Implement basic caching

#### Week 2: Core Features
- [ ] Work items fetching and transformation
- [ ] Metrics calculation service
- [ ] Basic dashboard UI components
- [ ] Product selection functionality
- [ ] Sprint/date filtering
- [ ] Basic charts implementation

#### Week 3: Advanced Features
- [ ] Individual performance views
- [ ] Advanced filtering options
- [ ] Export functionality
- [ ] Mobile responsive design
- [ ] Performance optimizations
- [ ] Error handling and logging

#### Week 4: Polish & Deploy
- [ ] UI/UX refinements
- [ ] Comprehensive testing
- [ ] Documentation
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Production deployment

### 14.5 Common Claude Code Commands for This Project

```bash
# Development shortcuts
claude-code run dev              # Start both frontend and backend
claude-code test                 # Run all tests
claude-code build               # Build for production
claude-code deploy              # Deploy to cloud

# Code generation
claude-code generate api-endpoint GET /api/metrics/:productId
claude-code generate chart-component BurndownChart
claude-code generate auth-middleware jwt

# Debugging
claude-code debug api           # Debug API issues
claude-code analyze performance # Performance analysis
claude-code check security      # Security audit
```

### 14.6 Performance Optimization Tips for Claude Code

1. **Implement request batching for Azure DevOps API**
```javascript
// Tell Claude Code: "Implement a batch processor for Azure DevOps API 
// calls that groups multiple requests and respects rate limits"
```

2. **Use React.memo and useMemo for chart components**
```javascript
// Claude Code prompt: "Optimize chart components using React.memo 
// and useMemo to prevent unnecessary re-renders"
```

3. **Implement virtual scrolling for large datasets**
```javascript
// Claude Code prompt: "Add virtual scrolling to the work items 
// list using react-window"
```

### 14.7 Troubleshooting Guide for Claude Code

**Common Issues and Solutions:**

1. **Azure DevOps API Rate Limiting**
   - Implement exponential backoff
   - Use Redis queue for API requests
   - Cache responses aggressively

2. **Large Dataset Performance**
   - Implement pagination
   - Use data virtualization
   - Progressive loading for charts

3. **Mobile Performance**
   - Lazy load chart libraries
   - Use CSS containment
   - Implement service worker for offline support

### 14.8 Production Deployment with Claude Code

```bash
# Production setup commands
claude-code setup production --provider azure
claude-code config ssl
claude-code setup monitoring --datadog
claude-code deploy --environment production

# Environment-specific configurations
production/
├── nginx.conf
├── docker-compose.prod.yml
├── kubernetes/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── monitoring/
    ├── alerts.yaml
    └── dashboards.json
```

---

## Document Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| UX Designer | | | |
| Engineering Manager | | | |