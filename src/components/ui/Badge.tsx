import React from 'react';
import { ServerTag } from '../../types';

interface BadgeProps {
  type: ServerTag;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, className = '' }) => {
  const getBackgroundColor = () => {
    switch (type) {
      case 'Remote':
        return 'bg-blue-900 text-blue-400';
      case 'Local':
        return 'bg-green-900 text-green-400';
      case 'Scanned':
        return 'bg-purple-900 text-purple-400';
      default:
        return 'bg-gray-700 text-gray-300';
    }
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBackgroundColor()} ${className}`}>
      {type}
    </span>
  );
};