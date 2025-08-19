# Performance Dashboard Frontend

React-based frontend application for the Performance Dashboard system, built with Vite and styled with Tailwind CSS.

## Features

- **Modern React Setup**: Built with Vite for fast development and hot reload
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Custom Tailwind Configuration**: Includes custom colors, spacing, and shadows as per PRD specifications
- **React Router**: Multi-page navigation with client-side routing
- **Component Architecture**: Modular components for scalability

## Tech Stack

- **React**: ^19.1.0
- **Vite**: ^7.0.4
- **React Router DOM**: ^7.7.0
- **Tailwind CSS**: ^4.1.11
- **Axios**: ^1.10.0 (for API calls)
- **Recharts**: ^3.1.0 (for data visualization)
- **Date-fns**: ^4.1.0 (for date utilities)

## Project Structure

```
src/
├── components/
│   ├── Header.jsx          # Top navigation bar
│   ├── Sidebar.jsx         # Desktop navigation sidebar
│   ├── MobileNav.jsx       # Mobile navigation menu
│   └── index.js            # Component exports
├── pages/
│   ├── Dashboard.jsx       # Main dashboard page
│   ├── IndividualPerformance.jsx  # Individual performance page
│   ├── Reports.jsx         # Reports page
│   └── index.js            # Page exports
├── App.jsx                 # Main application component with routing
├── main.jsx               # Application entry point
└── index.css              # Global styles with Tailwind imports
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

## Routes

- `/` - Dashboard (main overview)
- `/individual` - Individual Performance page
- `/reports` - Reports page

## Custom Tailwind Configuration

The application includes custom Tailwind configuration as specified in the PRD:

- **Colors**: Primary palette (blue), success (green), warning (amber), error (red)
- **Spacing**: Custom spacing values (18: 4.5rem, 88: 22rem)
- **Typography**: Extra small font size (xxs: 0.625rem)
- **Shadows**: Custom dashboard shadow

## Component Status

All components are placeholder implementations ready for feature development:

- ✅ **Header**: Responsive header with mobile menu toggle
- ✅ **Sidebar**: Desktop navigation with icons and quick actions
- ✅ **MobileNav**: Slide-out mobile navigation
- ✅ **Dashboard**: Layout with metric cards and chart placeholders
- ✅ **Individual Performance**: Search, filters, and employee table layout
- ✅ **Reports**: Report generation and history interface

## Next Steps

1. Implement data fetching with Axios
2. Add chart components using Recharts
3. Connect to backend API
4. Add authentication and user management
5. Implement real-time updates
6. Add comprehensive error handling

## Development Guidelines

- Follow mobile-first responsive design patterns
- Use Tailwind classes for consistent styling
- Maintain component modularity
- Implement proper error boundaries
- Use React Router for navigation
- Follow accessibility best practices