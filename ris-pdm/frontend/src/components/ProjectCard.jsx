import React from 'react';
import { projectsConfig } from '../config/branding';

const ProjectCard = ({ 
  projectId, 
  onClick, 
  showMetadata = true, 
  size = 'default',
  className = '' 
}) => {
  const project = projectsConfig.find(p => p.id === projectId);
  
  if (!project) {
    return null;
  }

  const sizeClasses = {
    small: 'p-3',
    default: 'p-4',
    large: 'p-6'
  };

  const iconSizes = {
    small: 'h-8 w-8',
    default: 'h-12 w-12',
    large: 'h-16 w-16'
  };

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${sizeClasses[size]} ${className}`}
      onClick={() => onClick && onClick(project)}
    >
      {/* Project Header */}
      <div className="flex items-start space-x-3">
        {/* Project Icon */}
        <div className={`flex-shrink-0 ${iconSizes[size]}`}>
          {project.icon ? (
            <div 
              className="w-full h-full rounded-lg flex items-center justify-center"
              style={{ backgroundColor: project.color }}
            >
              <span className="text-2xl">
                {project.icon}
              </span>
            </div>
          ) : (
            <div 
              className="w-full h-full rounded-lg flex items-center justify-center"
              style={{ backgroundColor: project.color }}
            >
              <span className="text-white text-sm font-bold">
                {project.abbreviation}
              </span>
            </div>
          )}
        </div>

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {project.name}
          </h3>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            {project.description}
          </p>
          
          {showMetadata && (
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                <span>{project.lastUpdate}</span>
                <span className="text-blue-600 hover:text-blue-800">
                  {project.process}
                </span>
              </div>
              <span className="text-gray-400">
                {project.visibility}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ProjectGrid component for displaying multiple project cards
export const ProjectGrid = ({ 
  projects = projectsConfig, 
  onProjectSelect,
  selectedProject,
  className = '' 
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          projectId={project.id}
          onClick={onProjectSelect}
          className={`${selectedProject === project.id ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
        />
      ))}
    </div>
  );
};

export default ProjectCard;