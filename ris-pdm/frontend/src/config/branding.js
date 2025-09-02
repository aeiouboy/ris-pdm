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

// ✅ ENABLED PROJECTS ONLY - PMP and DaaS as per backend PROJECT_CONFIG
export const projectsConfig = [
  {
    id: 'Product - Partner Management Platform',
    name: 'Product - Partner Management Platform',
    abbreviation: 'PP',
    description: 'Partner Management Platform',
    icon: '👥', // Using icon instead of logo
    color: '#059669',
    lastUpdate: '7/14/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'Product - Data as a Service',
    name: 'Product - Data as a Service',
    abbreviation: 'PD',
    description: 'Data as a Service Platform',
    icon: '📊', // Using icon instead of logo
    color: '#0891B2',
    lastUpdate: '4/3/2025',
    process: 'Align',
    visibility: 'Private'
  },
  {
    id: 'all-projects',
    name: 'All Projects',
    abbreviation: 'ALL',
    description: 'Combined view of all projects',
    icon: '🔄', // Using icon instead of logo
    color: '#6B7280',
    lastUpdate: 'Now',
    process: 'Mixed',
    visibility: 'Private'
  }
];

export default brandingConfig;