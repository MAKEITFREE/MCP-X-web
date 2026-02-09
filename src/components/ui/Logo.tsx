import React from 'react';
import { Hammer } from 'lucide-react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return (
    <div className={`text-orange-500 ${className}`}>
      <Hammer size={24} strokeWidth={2.5} />
    </div>
  );
};