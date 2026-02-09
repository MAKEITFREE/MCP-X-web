import React from 'react';
import { ZapIcon } from 'lucide-react';

interface UsageBadgeProps {
  count: string;
}

export const UsageBadge: React.FC<UsageBadgeProps> = ({ count }) => {
  return (
    <div className="inline-flex items-center text-xs text-gray-400 ml-1">
      <ZapIcon className="w-3 h-3 mr-1" />
      {count}
    </div>
  );
};