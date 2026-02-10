import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { ModelInfo } from '../../services/modelApi';

interface ModelSelectProps {
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  models?: ModelInfo[]; // 从父组件传入模型列表
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  selectedModel,
  onModelChange,
  disabled,
  models = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedModelInfo = models.find(m => m.id === selectedModel);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={selectRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        <span>{selectedModelInfo?.modelName || '选择模型'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[400px] overflow-hidden flex flex-col">
          <ul className="py-1 overflow-y-auto flex-1">
            {models.map(model => (
              <li key={model.id}>
                <button
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${selectedModel === model.id ? 'bg-blue-100 text-blue-800' : 'text-gray-800'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{model.modelName}</p>
                      <p className="text-xs text-gray-500">{model.remark}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ml-2 ${
                        model.modelPrice === 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {model.modelPrice === 0 ? '免费' : '收费'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
