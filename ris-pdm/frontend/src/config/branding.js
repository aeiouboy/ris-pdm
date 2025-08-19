// Project Branding Configuration
export const brandingConfig = {
  project: {
    name: 'Performance Dashboard',
    fullName: 'RIS Performance Dashboard',
    description: 'Project Management Platform',
    abbreviation: 'RP'
  },
  
  logo: {
    src: '/logo.svg',
    favicon: '/favicon.svg',
    alt: 'RIS Performance Dashboard'
  },
  
  colors: {
    primary: '#3B82F6',
    secondary: '#1E40AF',
    accent: '#60A5FA'
  },
  
  // Organization info (similar to Azure DevOps project structure)
  organization: {
    name: 'RIS Organization',
    abbreviation: 'RIS'
  },
  
  // Display preferences
  display: {
    showFullNameInSidebar: false,
    showLogoInHeader: true,
    showDescriptionInSidebar: false
  }
};

// Multiple Projects Configuration (matching real Azure DevOps projects)
export const projectsConfig = [
  {
    id: 'Product - Supplier Connect',
    name: 'Product - Supplier Connect',
    abbreviation: 'PC',
    description: 'To replace EDI web which is the old data platform wi...',
    logo: '/project-logos/pc-logo.svg',
    color: '#10B981',
    lastUpdate: '11/25/2021',
    process: 'ScrumBan',
    visibility: 'Private'
  },
  {
    id: 'Product - Standard ETax',
    name: 'Product - Standard ETax',
    abbreviation: 'PE',
    description: 'Electronic Tax Filing System',
    logo: '/project-logos/pe-logo.svg',
    color: '#F59E0B',
    lastUpdate: '5/24/2023',
    process: 'Scrum',
    visibility: 'Private'
  },
  {
    id: 'Product - Slick Web and App',
    name: 'Product - Slick Web and App',
    abbreviation: 'PA',
    description: 'Slick Application developed by IONIC Framework inc...',
    logo: '/project-logos/pa-logo.svg',
    color: '#EF4444',
    lastUpdate: '3/31/2020',
    process: 'Scrum',
    visibility: 'Private'
  },
  {
    id: 'Product - Slick Admin',
    name: 'Product - Slick Admin',
    abbreviation: 'PA',
    description: 'Slick Admin Panel',
    logo: '/project-logos/pa-logo.svg',
    color: '#EF4444',
    lastUpdate: '3/16/2021',
    process: 'Scrum',
    visibility: 'Private'
  },
  {
    id: 'Product - RTS-On-Prem',
    name: 'Product - RTS-On-Prem',
    abbreviation: 'PR',
    description: 'Real-time System On-Premises Solution',
    logo: '/project-logos/pr-logo.svg',
    color: '#6366F1',
    lastUpdate: '4/25/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - Partner Management Platform',
    name: 'Product - Partner Management Platform',
    abbreviation: 'PP',
    description: 'Partner Management Platform',
    logo: '/project-logos/pp-logo.svg',
    color: '#059669',
    lastUpdate: '7/14/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - Luke',
    name: 'Product - Luke',
    abbreviation: 'PL',
    description: 'Innovative data warehouse on Cloud with ML providi...',
    logo: '/project-logos/pl-logo.svg',
    color: '#7C3AED',
    lastUpdate: '11/18/2020',
    process: 'Scrum',
    visibility: 'Private'
  },
  {
    id: 'Product - ETAX',
    name: 'Product - ETAX',
    abbreviation: 'PE',
    description: 'Electronic Tax System',
    logo: '/project-logos/pe-logo.svg',
    color: '#DC2626',
    lastUpdate: '4/4/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - Data as a Service',
    name: 'Product - Data as a Service',
    abbreviation: 'PD',
    description: 'Data as a Service Platform',
    logo: '/project-logos/pd-logo.svg',
    color: '#0891B2',
    lastUpdate: '4/3/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - CFG Workflow',
    name: 'Product - CFG Workflow',
    abbreviation: 'PW',
    description: 'CFG Workflow Management',
    logo: '/project-logos/pw-logo.svg',
    color: '#7C2D12',
    lastUpdate: '10/15/2020',
    process: 'Basic',
    visibility: 'Private'
  },
  {
    id: 'all-projects',
    name: 'All Projects',
    abbreviation: 'ALL',
    description: 'Combined view of all projects',
    logo: '/logo.svg',
    color: '#6B7280',
    lastUpdate: 'Now',
    process: 'Mixed',
    visibility: 'Private'
  }
];

export default brandingConfig;