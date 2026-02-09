import React from 'react';
import { CheckCircle } from 'lucide-react';

export const VerifiedBadge: React.FC = () => {
  return (
    <span className="inline-flex" title="已认证">
      <CheckCircle className="w-4 h-4 text-orange-500" />
    </span>
  );
};