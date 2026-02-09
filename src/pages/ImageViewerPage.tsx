import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCcw, Move, MousePointer } from 'lucide-react';

export const ImageViewerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragMode, setIsDragMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const imageUrl = searchParams.get('url');
  const imageName = searchParams.get('name') || '图片预览';

  // 如果没有图片URL，返回首页
  useEffect(() => {
    if (!imageUrl) {
      navigate('/');
      return;
    }
  }, [imageUrl, navigate]);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          handleRotate();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    // 使用window.history.back()避免React Router重新导航导致的重新渲染
    window.history.back();
  };

  const handleDownload = () => {
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setImagePosition({ x: 0, y: 0 });
  };

  const toggleDragMode = () => {
    setIsDragMode(prev => !prev);
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDragMode) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - imagePosition.x,
      y: e.clientY - imagePosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !isDragMode) return;

    setImagePosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between p-4 bg-black bg-opacity-50 text-white">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium truncate max-w-md">{imageName}</h1>
          <span className="text-sm text-gray-300">
            缩放: {Math.round(zoom * 100)}% | 旋转: {rotation}°
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded transition-colors"
            title="缩小 (Ctrl -)"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded transition-colors"
            title="放大 (Ctrl +)"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded transition-colors"
            title="旋转 (R)"
          >
            <RotateCcw size={20} />
          </button>
          <button
            onClick={toggleDragMode}
            className={`p-2 rounded transition-colors ${
              isDragMode
                ? 'hover:bg-white hover:bg-opacity-10'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            title={isDragMode ? "切换到默认鼠标模式" : "切换到抓手移动模式"}
          >
            {isDragMode ? <MousePointer size={20} /> : <Move size={20} />}
          </button>
          <button
            onClick={resetView}
            className="px-3 py-1 text-sm hover:bg-white hover:bg-opacity-10 rounded transition-colors"
            title="重置视图"
          >
            重置
          </button>
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded transition-colors"
            title="下载图片"
          >
            <Download size={20} />
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white hover:bg-opacity-10 rounded transition-colors"
            title="关闭 (Esc)"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* 图片显示区域 */}
      <div
        ref={containerRef}
        className={`flex-1 flex items-center justify-center p-4 overflow-auto ${
          isDragMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageError ? (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-xl mb-2">图片加载失败</p>
            <p className="text-gray-400 mb-4">无法加载图片，可能链接已失效</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                重新加载
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                返回
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <img
              src={imageUrl}
              alt={imageName}
              className={`max-w-full max-h-full object-contain transition-transform duration-200 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              } ${isDragMode ? 'select-none' : ''}`}
              style={{
                transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
              draggable={false}
            />

            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-lg">加载中...</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="p-4 bg-black bg-opacity-50 text-gray-300 text-center text-sm">
        <p>
          {isDragMode
            ? "拖拽移动图片 | 鼠标滚轮缩放 | 按 R 键旋转 | 按 Esc 关闭"
            : "使用鼠标滚轮缩放 | 按 R 键旋转 | 按 Esc 关闭"
          }
        </p>
      </div>
    </div>
  );
};
