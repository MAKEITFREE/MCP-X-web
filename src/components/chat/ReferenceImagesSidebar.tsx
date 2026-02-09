import React, { useState, useEffect } from 'react';
import { X, Image, Download, Maximize, Minimize } from 'lucide-react';

interface ReferenceImagesSidebarProps {
  isOpen: boolean;
  className?: string;
  onClose: () => void;
  images: string[];
  loading: boolean;
  error: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const ReferenceImagesSidebar: React.FC<ReferenceImagesSidebarProps> = ({
  isOpen,
  className,
  onClose,
  images,
  loading,
  error,
  onFullscreenChange
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const handleFullscreenToggle = () => {
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    onFullscreenChange?.(newFullscreenState);
  };

  // 添加键盘事件监听，按ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      // 防止页面滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const handleImageClick = (imageUrl: string) => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadClick = (imageUrl: string) => {
    // 创建一个临时的 a 标签来下载图片
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageUrl.split('/').pop() || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={handleFullscreenToggle}
        />
      )}
      <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0 bg-white/70 backdrop-blur">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Image size={16} className="text-green-600" />
          参考图片
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFullscreenToggle}
            className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
            title={isFullscreen ? "退出全屏" : "全屏显示"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className={`p-4 ${isFullscreen ? '' : ''}`}>
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <div className="mt-2 text-sm text-slate-500">加载中...</div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-500 text-sm">{error}</div>
            </div>
          )}

          {!loading && !error && images.length === 0 && (
            <div className="text-center py-8">
              <div className="text-slate-500 text-sm">暂无参考图片</div>
            </div>
          )}

          {!loading && !error && images.length > 0 && (
            <div className={`grid gap-3 ${isFullscreen ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-2'}`}>
              {images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <div className={`${isFullscreen ? 'aspect-video' : 'aspect-square'} bg-slate-100 rounded-lg overflow-hidden border border-slate-200`}>
                    <img
                      src={imageUrl}
                      alt={`参考图片 ${index + 1}`}
                      className="w-full h-full object-cover cursor-pointer transition-transform duration-200 hover:scale-105"
                      onClick={() => handleImageClick(imageUrl)}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NCAyMSAzIDE2Ljk3MDYgMyAxMkMzIDcuMDI5NCA3LjAyOTQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQgMjEgMTJaIiBzdHJva2U9IiM5Q0E4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                        img.alt = '图片加载失败';
                        img.className = 'w-full h-full object-contain opacity-50';
                      }}
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick(imageUrl);
                        }}
                        className="p-2 bg-white/90 rounded-full text-slate-700 hover:bg-white transition-colors"
                        title="查看大图"
                      >
                        <Image size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadClick(imageUrl);
                        }}
                        className="p-2 bg-white/90 rounded-full text-slate-700 hover:bg-white transition-colors"
                        title="下载图片"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 图片编号 */}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};
