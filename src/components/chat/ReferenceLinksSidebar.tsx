import React from 'react';
import { X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReferenceLink {
  id: string;
  title?: string;
  url: string;
  content?: string;
  score?: string;
  description?: string;
  createTime?: string;
}

interface ReferenceLinksSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  links: ReferenceLink[];
  loading: boolean;
  error?: string;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
  onPageChange?: (page: number, pageSize: number) => void;
  className?: string; // Allow custom positioning
}

export const ReferenceLinksSidebar: React.FC<ReferenceLinksSidebarProps> = ({
  isOpen,
  onClose,
  links,
  loading,
  error,
  pagination,
  onPageChange,
  className
}) => {
  if (!isOpen && !className) return null; // If strictly controlled by isOpen and no custom class (legacy mode)

  // Default fixed styles if no className provided, otherwise assume caller handles layout
  const baseClasses = className 
    ? `bg-white border-l border-slate-200 flex flex-col h-full ${className}`
    : "fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-lg z-40 flex flex-col";

  if (!isOpen && className) return null; // Or keep hidden? Let's stick to isOpen logic for now.

  return (
    <div className={baseClasses}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800">参考链接</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          title="关闭"
        >
          <X size={20} className="text-slate-500" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-slate-500" />
              <span className="ml-2 text-slate-600">加载中...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-2">加载失败</div>
              <div className="text-sm text-slate-500">{error}</div>
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-slate-500 mb-2">暂无参考链接</div>
              <div className="text-sm text-slate-400">该消息可能没有相关的参考链接</div>
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((link, index) => (
                <div key={link.id || index} className="border-b border-slate-200 pb-4 last:border-b-0 last:pb-0 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    {/* 标题 - 大一点 */}
                    {link.title && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-blue-700 hover:text-blue-900 hover:underline line-clamp-2 mb-1 block"
                        title={link.title}
                      >
                        {link.title}
                      </a>
                    )}

                    {/* 链接 - 小一点，绿色 */}
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-700 hover:text-green-900 hover:underline break-all line-clamp-1 block mb-2"
                      title={link.url}
                    >
                      {link.url}
                    </a>

                    {/* 内容摘要 */}
                    {link.content && (
                      <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                        {link.content}
                      </p>
                    )}

                    {/* 时间 */}
                    {link.createTime && (
                      <div className="mt-2">
                        <span className="text-xs text-slate-400">
                          {new Date(link.createTime).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 分页区域 */}
        {onPageChange && pagination.total > 0 && (
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {pagination.total > 0 ? (
                  <>
                    第 {pagination.current} 页，共 {Math.ceil(pagination.total / pagination.pageSize)} 页
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(pagination.current - 1, pagination.pageSize)}
                  disabled={pagination.current <= 1 || loading}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="上一页"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-600 min-w-[60px] text-center">
                  {pagination.current}
                </span>
                <button
                  onClick={() => onPageChange(pagination.current + 1, pagination.pageSize)}
                  disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize) || loading}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="下一页"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            {pagination.total > 0 && (
              <div className="mt-2 text-xs text-slate-400 text-center">
                共 {pagination.total} 条记录
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
