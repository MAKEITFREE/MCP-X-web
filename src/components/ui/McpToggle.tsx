import React from 'react';

interface McpToggleProps {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export const McpToggle: React.FC<McpToggleProps> = ({ enabled, disabled = false, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50 ${
        enabled
          ? 'text-blue-600 border-blue-300 bg-white hover:bg-blue-50'
          : 'text-gray-600 border-gray-300 bg-white hover:bg-gray-50'
      }`}
      title={enabled ? '关闭 MCP' : '开启 MCP'}
    >
      MCP
    </button>
  );
};


