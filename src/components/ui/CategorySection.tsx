import React, { useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Server } from '../../types';
import { ServerCard } from './ServerCard';
import { useLanguage } from '../../contexts/LanguageContext';

interface CategorySectionProps {
  title: string;
  count: number;
  servers: Server[];
  onSearch?: (query: string) => void;
  hideViewAll?: boolean;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ 
  title, 
  count, 
  servers, 
  onSearch,
  hideViewAll = false 
}) => {
  const { currentLanguage } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = current.clientWidth * 0.75;
      if (direction === 'left') {
        current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  const handleViewAll = () => {
    if (onSearch) {
      // 构建搜索字符串"类型：{类别名称}"
      onSearch(`类型:${title}`);
    }
  };

  return (
    <section className="mb-12 w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <span className="ml-2 px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full">{count}</span>
        </div>
        <div className="flex space-x-1 items-center">
          <button 
            onClick={() => scroll('left')}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            aria-label="向左滚动"
          >
            <ArrowLeft size={18} />
          </button>
          <button 
            onClick={() => scroll('right')}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            aria-label="向右滚动"
          >
            <ArrowRight size={18} />
          </button>
          {!hideViewAll && (
            <button 
              onClick={handleViewAll}
              className="text-sm text-gray-400 hover:text-white transition-colors ml-2"
            >
{currentLanguage === 'zh' ? '查看全部' : 'View All'}
            </button>
          )}
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex space-x-4 overflow-x-auto pb-4 snap-x scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
      >
        {servers.map(server => (
          <div 
            key={server.id} 
            className="min-w-[300px] max-w-[300px] snap-start"
          >
            <ServerCard server={server} />
          </div>
        ))}
      </div>
    </section>
  );
};