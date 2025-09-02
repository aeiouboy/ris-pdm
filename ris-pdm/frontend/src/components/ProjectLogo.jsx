import React from 'react';
import { brandingConfig } from '../config/branding';

const ProjectLogo = ({ 
  size = 'md', 
  showText = true, 
  className = '',
  variant = 'default' 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  return (
    <div className={`flex items-center ${className}`}>
      {/* Project Icon */}
      <div className={`${sizeClasses[size]} flex-shrink-0 rounded-lg flex items-center justify-center`} style={{ backgroundColor: brandingConfig.colors.primary }}>
        <span className={`${textSizeClasses[size]} text-white`}>
          📊
        </span>
      </div>
      
      {/* Project Name */}
      {showText && (
        <div className="ml-3">
          <h1 className={`${textSizeClasses[size]} font-bold text-gray-900 leading-tight`}>
            {variant === 'full' ? brandingConfig.project.fullName : brandingConfig.project.name}
          </h1>
          {variant === 'full' && (
            <p className="text-sm text-gray-600">
              {brandingConfig.project.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectLogo;