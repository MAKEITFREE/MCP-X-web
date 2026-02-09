import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  searchQuery?: string;
  onClear?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = "搜索或输入提示查找服务器...",
  searchQuery = "",
  onClear
}) => {
  const [query, setQuery] = useState(searchQuery);

  // 当外部searchQuery改变时，更新内部状态
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg py-3 px-4 pr-24 focus:outline-none focus:border-orange-500 transition-colors"
      />
      {query && onClear && (
        <button
          type="button"
          className="absolute right-14 top-1/2 transform -translate-y-1/2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded px-2 py-1 transition-colors duration-200 text-sm"
          onClick={() => {
            setQuery('');
            onClear();
          }}
          tabIndex={-1}
          aria-label="清除搜索内容"
        >
          清除
        </button>
      )}
      <button
        type="submit"
        className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-orange-500 text-white p-1.5 rounded-md hover:bg-orange-600 transition-colors"
      >
        <Search size={16} />
      </button>
    </form>
  );
};