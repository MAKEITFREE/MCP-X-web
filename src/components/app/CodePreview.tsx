import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Edit3, Download, RefreshCw } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { getStaticListUrl, getStaticFileUrl } from '../../services/appBuildApi';

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  selector: string;
  pagePath?: string;
}

interface CodePreviewProps {
  previewUrl?: string;
  isGenerating?: boolean;
  isEditMode?: boolean;
  selectedElementInfo?: ElementInfo | null;
  onToggleEditMode?: () => void;
  onClearSelection?: () => void;
  onElementSelected?: (elementInfo: ElementInfo) => void;
  onDownloadCode?: () => void;
  isOwner?: boolean;
  className?: string;
  appId?: string;
  codeGenType?: string;
}

export const CodePreview: React.FC<CodePreviewProps> = ({
  previewUrl,
  isGenerating,
  isEditMode = false,
  selectedElementInfo,
  onToggleEditMode,
  onClearSelection: _onClearSelection,
  onElementSelected,
  onDownloadCode,
  isOwner = true,
  className = '',
  appId,
  codeGenType,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [codeText, setCodeText] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [selectedLines, setSelectedLines] = useState<{ start: number; end: number } | null>(null);

  type FileNode = {
    name: string;
    path: string; // 服务端返回以 / 开头
    type: 'file' | 'dir';
    children?: FileNode[];
  };

  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));

  // 新窗口打开预览
  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  // iframe加载完成处理（生产避免内联脚本，改为注入外部脚本）
  const handleIframeLoad = () => {
    setPreviewReady(true);
    if (iframeRef.current && isOwner) {
      try {
        const iframeDocument = iframeRef.current.contentDocument;
        if (iframeDocument) {
          const script = iframeDocument.createElement('script');
          script.src = '/iframe-editor.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            try {
              iframeRef.current?.contentWindow?.postMessage({ type: 'toggleEditMode', enabled: isEditMode }, '*');
              if (!selectedElementInfo) {
                iframeRef.current?.contentWindow?.postMessage({ type: 'clearSelection' }, '*');
              }
            } catch {}
          };
          script.onerror = () => {
            // 回退：若外部脚本加载失败，尝试内联方案
            try {
              const fallback = iframeDocument.createElement('script');
              fallback.textContent = `
            (function() {
              let isEditModeActive = false;
              let selectedElement = null;
              let overlay = null;
              let mouseMoveHandler = null;

              // 创建选择覆盖层
              function createOverlay() {
                overlay = document.createElement('div');
                overlay.style.cssText = \`
                  position: fixed;
                  border: 2px solid #1890ff;
                  background: rgba(24, 144, 255, 0.1);
                  pointer-events: none;
                  z-index: 10000;
                  transition: all 0.2s ease;
                \`;
                document.body.appendChild(overlay);
              }

              // CSS 标识符转义，兼容 Tailwind 类名中的冒号等特殊字符
              function cssEscapeIdent(ident){
                try {
                  if (window.CSS && CSS.escape) return CSS.escape(ident);
                } catch(e) {}
                return String(ident).replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^\`{|}~])/g, '\\$1');
              }

              // 更新覆盖层位置
              function updateOverlay(element) {
                if (!overlay || !element) return;
                const rect = element.getBoundingClientRect();
                overlay.style.left = rect.left + 'px';
                overlay.style.top = rect.top + 'px';
                overlay.style.width = rect.width + 'px';
                overlay.style.height = rect.height + 'px';
                overlay.style.display = 'block';
              }

              // 生成CSS选择器
              function generateSelector(element) {
                if (element.id) {
                  return '#' + cssEscapeIdent(element.id);
                }
                
                let selector = element.tagName.toLowerCase();
                var classTokens = [];
                if (element.classList && element.classList.length) {
                  classTokens = Array.from(element.classList);
                } else if (element.className) {
                  classTokens = String(element.className).split(' ');
                }
                classTokens = classTokens.map(function(c){return c && c.trim();}).filter(Boolean);
                if (classTokens.length > 0) {
                  selector += '.' + classTokens.map(cssEscapeIdent).join('.');
                }
                
                // 如果选择器不够唯一，添加父级信息
                var elements = document.querySelectorAll(selector);
                if (elements.length > 1) {
                  var parent = element.parentElement;
                  if (parent && parent !== document.body) {
                    var parentSelector = generateSelector(parent);
                    selector = parentSelector + ' > ' + selector;
                  }
                }
                
                return selector;
              }

              // 处理元素选择
              function handleElementSelect(event) {
                if (!isEditModeActive) return;
                
                event.preventDefault();
                event.stopPropagation();
                
                const element = event.target;
                if (!element || element === document.body || element === document.documentElement) return;
                
                selectedElement = element;
                updateOverlay(element);
                
                // 发送选择信息到父窗口
                const elementInfo = {
                  tagName: element.tagName,
                  id: element.id || undefined,
                  className: element.className || undefined,
                  textContent: element.textContent ? element.textContent.substring(0, 100) : undefined,
                  selector: generateSelector(element),
                  pagePath: window.location.pathname,
                };
                
                window.parent.postMessage({
                  type: 'elementSelected',
                  data: elementInfo
                }, '*');
              }

              // 监听来自父窗口的消息
              window.addEventListener('message', function(event) {
                if (event.data.type === 'toggleEditMode') {
                  isEditModeActive = event.data.enabled;
                  
                  if (isEditModeActive) {
                    if (!overlay) createOverlay();
                    document.addEventListener('click', handleElementSelect, true);
                    mouseMoveHandler = function(e) {
                      if (!isEditModeActive) return;
                      const t = e.target;
                      if (t && t !== document.body && t !== document.documentElement) {
                        updateOverlay(t);
                      }
                    };
                    document.addEventListener('mousemove', mouseMoveHandler, true);
                    document.body.style.cursor = 'crosshair';
                  } else {
                    document.removeEventListener('click', handleElementSelect, true);
                    if (mouseMoveHandler) {
                      document.removeEventListener('mousemove', mouseMoveHandler, true);
                      mouseMoveHandler = null;
                    }
                    if (overlay) {
                      overlay.remove();
                      overlay = null;
                    }
                    selectedElement = null;
                    document.body.style.cursor = '';
                  }
                } else if (event.data.type === 'clearSelection') {
                  selectedElement = null;
                  if (overlay) {
                    overlay.style.display = 'none';
                  }
                }
              });
            })();
              `;
              iframeDocument.head.appendChild(fallback);
            } catch (e) {
              console.warn('无法注入编辑脚本(回退):', e);
            }
          };
          iframeDocument.head.appendChild(script);
        }
      } catch (error) {
        console.warn('无法注入编辑脚本:', error);
      }
    }
  };

  // 监听来自iframe的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'elementSelected' && onElementSelected) {
        onElementSelected(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelected]);

  // 向iframe发送编辑模式切换消息
  useEffect(() => {
    if (previewReady && iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage({
          type: 'toggleEditMode',
          enabled: isEditMode,
        }, '*');
      } catch (error) {
        console.warn('无法发送编辑模式消息:', error);
      }
    }
  }, [isEditMode, previewReady]);

  // 发送清除选择消息
  useEffect(() => {
    if (previewReady && iframeRef.current && !selectedElementInfo) {
      try {
        iframeRef.current.contentWindow?.postMessage({
          type: 'clearSelection',
        }, '*');
      } catch (error) {
        console.warn('无法发送清除选择消息:', error);
      }
    }
  }, [selectedElementInfo, previewReady]);

  // 当切换到代码 Tab 时，拉取 index.html 源码与目录结构
  useEffect(() => {
    const fetchCode = async () => {
      if (!previewUrl) return;
      setLoadingCode(true);
      setCodeError('');
      try {
        const res = await fetch(previewUrl, { credentials: 'omit' });
        const text = await res.text();
        setCodeText(text);
        setSelectedLines(null);
        _onClearSelection?.();
        // 通过新接口获取目录结构 /static/{deployKey}/list
        try {
          if (appId && codeGenType) {
            const listUrl = getStaticListUrl(String(codeGenType).toUpperCase(), appId);
            const token = localStorage.getItem('token');
            const listRes = await fetch(listUrl, {
              credentials: 'omit',
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (listRes.ok) {
              const items = await listRes.json();
              const root = normalizeServerTree(items);
              setFileTree(root);
              // 仅在首次无展开记录时设置默认展开
              setExpandedPaths((prev) => (prev && prev.size > 0 ? prev : new Set<string>(['/'])));
            }
          }
        } catch {}
      } catch (e) {
        setCodeError('加载源码失败');
      } finally {
        setLoadingCode(false);
      }
    };
    if (activeTab === 'code') {
      fetchCode();
    }
  }, [activeTab, previewUrl, appId, codeGenType]);

  // 预留的辅助：如需退化到解析HTML资源，可恢复使用
  // const extractAssetPathsFromHtml = (html: string): string[] => { ... };
  // const normalizeRelativePath = (p: string): string => { ... };

  // 规范化服务端树形结构
  const normalizeServerTree = (items: any[]): FileNode => {
    const toNode = (item: any): FileNode => ({
      name: item.name,
      path: item.path,
      type: item.directory ? 'dir' : 'file',
      children: item.children && item.children.length ? item.children.map(toNode) : undefined,
    });
    const root: FileNode = { name: '/', path: '/', type: 'dir', children: items.map(toNode) };
    const sortTree = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
      }
    };
    sortTree(root);
    return root;
  };

  // 解析目录索引页面中的相对链接
  // 目录索引解析方法已不再使用，保留注释方便回退
  // const extractLinksFromDirectoryIndex = (html: string): string[] => { ... };

  // 点击文件，加载并显示
  const handleSelectFile = async (path: string) => {
    if (!previewUrl) return;
    setSelectedPath(path);
    // 确保父级目录始终保持展开（如 /src、/src/pages等）
    try {
      const parts = path.split('/').filter(Boolean);
      const parents: string[] = [];
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc += '/' + parts[i];
        parents.push(acc);
      }
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        parents.forEach((p) => next.add(p));
        return next;
      });
    } catch {}
    setSelectedLines(null);
    _onClearSelection?.();
    setLoadingCode(true);
    setCodeError('');
    try {
      const url = getStaticFileUrl(String(codeGenType).toUpperCase(), appId || '', path);
      const token = localStorage.getItem('token');
      // 简单二进制判断
      const isText = /\.(html?|css|js|json|txt|md|svg|vue|ts|tsx|jsx)$/i.test(path);
      const res = await fetch(url, {
        credentials: 'omit',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!isText) {
        setCodeText('该文件为二进制或暂不支持的格式，无法预览。');
      } else {
        const text = await res.text();
        setCodeText(text);
      }
    } catch (e) {
      setCodeError('加载文件失败');
    } finally {
      setLoadingCode(false);
    }
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  // 目录树渲染（使用组件内部状态，避免全局事件带来的折叠问题）
  const renderTree = (node: any, depth: number): React.ReactNode => {
    if (!node) return null;
    const isDir = node.type === 'dir';
    const paddingLeft = 8 + depth * 12;
    if (isDir) {
      const expanded = expandedPaths.has(node.path);
      return (
        <div key={node.path}>
          <div
            className="cursor-pointer select-none px-1 py-1 hover:bg-slate-100 rounded"
            style={{ paddingLeft }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.path);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <span className="mr-1 text-slate-500">{expanded ? '▼' : '▶'}</span>
            <span className="font-medium text-slate-700">{node.name === '/' ? '根目录' : node.name}</span>
          </div>
          {expanded && node.children && node.children.map((c: any) => renderTree(c, depth + 1))}
        </div>
      );
    }
    const isActive = selectedPath === node.path;
    return (
      <div
        key={node.path}
        className={`cursor-pointer select-none px-1 py-1 rounded text-slate-700 ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100'}`}
        style={{ paddingLeft }}
        onClick={(e) => { e.stopPropagation(); handleSelectFile(node.path); }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {node.name}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200 ${className}`}>
      {/* 预览头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'preview'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            网页预览
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'code'
                ? 'bg-white text-slate-900 border border-slate-200'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            源代码
          </button>
        </div>
        <div className="flex items-center gap-2">
          {previewUrl && (
            <button
              onClick={() => {
                try {
                  iframeRef.current?.contentWindow?.location.reload();
                } catch (e) {
                  // ignore
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="刷新预览"
            >
              <RefreshCw size={14} />
              刷新
            </button>
          )}
          {isOwner && previewUrl && (
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                isEditMode
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
              title={isEditMode ? '退出编辑模式' : '进入编辑模式'}
            >
              <Edit3 size={14} />
              {isEditMode ? '退出编辑' : '编辑模式'}
            </button>
          )}
          {onDownloadCode && (
            <button
              onClick={onDownloadCode}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="下载代码"
            >
              <Download size={14} />
              下载
            </button>
          )}
          {previewUrl && (
            <button
              onClick={openInNewTab}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
              title="新窗口打开"
            >
              <ExternalLink size={14} />
              新窗口
            </button>
          )}
        </div>
      </div>

      {/* 选中元素信息 */}
      {/* {selectedElementInfo && (
        <div className="mx-4 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                  {selectedElementInfo.tagName.toLowerCase()}
                </span>
                {selectedElementInfo.id && (
                  <span className="px-2 py-1 text-xs font-mono bg-green-100 text-green-800 rounded">
                    #{selectedElementInfo.id}
                  </span>
                )}
                {selectedElementInfo.className && (
                  <span className="px-2 py-1 text-xs font-mono bg-yellow-100 text-yellow-800 rounded">
                    .{selectedElementInfo.className.split(' ').join('.')}
                  </span>
                )}
              </div>
              {selectedElementInfo.textContent && (
                <p className="text-xs text-slate-600 mb-1">
                  内容: {selectedElementInfo.textContent.substring(0, 50)}
                  {selectedElementInfo.textContent.length > 50 ? '...' : ''}
                </p>
              )}
              <p className="text-xs text-slate-500 font-mono">
                选择器: {selectedElementInfo.selector}
              </p>
            </div>
            <button
              onClick={onClearSelection}
              className="ml-2 p-1 text-slate-400 hover:text-slate-600 rounded"
              title="清除选择"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )} */}

      {/* 预览/代码内容 */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab === 'preview' ? (
          !previewUrl ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="mb-3">
                <Logo className="h-12 w-12" />
              </div>
            <p className="text-sm">网站文件生成完成后将在这里展示</p>
          </div>
        ) : (
          <>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full border-none"
              onLoad={handleIframeLoad}
              title="网站预览"
            />
            {isGenerating && (
              <div className="absolute inset-0 pointer-events-none flex items-start justify-end p-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur rounded-md shadow border border-slate-200">
                    <Logo className="h-4 w-4" />
                    <span className="text-xs text-slate-700 animate-pulse">正在生成中…</span>
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          <div className="w-full h-full flex bg-slate-50">
            {/* 目录侧栏 */}
            <div className="w-64 border-r border-slate-200 bg-white overflow-auto p-2">
              {!fileTree ? (
                <div className="text-sm text-slate-500 p-2">暂无目录</div>
              ) : (
                <div className="text-sm">
                  {renderTree(fileTree, 0)}
                </div>
              )}
            </div>
            {/* 文件内容（自适应：与网页预览同宽 = 剩余空间） */}
            <div className="flex-1 min-w-0 h-full overflow-auto p-0">
              {!previewUrl ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <div className="text-4xl mb-4">📄</div>
                  <p className="text-sm">暂无可展示的源码</p>
                </div>
              ) : loadingCode ? (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-2"></div>
                  <span className="text-sm">加载中…</span>
                </div>
              ) : codeError ? (
                <div className="text-center text-sm text-red-600">{codeError}</div>
              ) : (
                <div className="text-[12px] leading-5 font-mono bg-white rounded-md border border-slate-200 h-full flex flex-col select-none">
                  {/* 顶部提示与状态 */}
                  {isEditMode && (
                    <div className="px-3 py-1 text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                      单击/Shift+单击多行，可选中代码
                    </div>
                  )}
                  {isEditMode && selectedLines && (
                    <div className="px-3 py-1 text-xs text-blue-700 bg-blue-50 border-b border-slate-200">
                      已选中 {selectedPath || 'index.html'} 第 {selectedLines.start}-{selectedLines.end} 行
                    </div>
                  )}
                  <div className="flex-1 overflow-auto">
                    {(codeText.split(/\r?\n/)).map((line, i) => {
                      const lineNo = i + 1;
                      const inSel = selectedLines && lineNo >= Math.min(selectedLines.start, selectedLines.end) && lineNo <= Math.max(selectedLines.start, selectedLines.end);
                      return (
                        <div
                          key={i}
                          className={`flex items-start ${inSel ? 'bg-blue-50' : ''}`}
                          onClick={(e) => {
                            if (!isEditMode) return;
                            const withShift = (e as React.MouseEvent<HTMLDivElement>).shiftKey;
                            setSelectedLines((prev) => {
                              const next = !prev || !withShift ? { start: lineNo, end: lineNo } : { start: prev.start, end: lineNo };
                              // 向父组件上报选择信息
                              try {
                                const start = Math.min(next.start, next.end);
                                const end = Math.max(next.start, next.end);
                                const snippet = codeText.split(/\r?\n/).slice(start - 1, end).join('\n').slice(0, 500);
                                onElementSelected?.({
                                  tagName: 'CODE',
                                  selector: `${(selectedPath || 'index.html')}:${start}-${end}`,
                                  textContent: snippet,
                                  pagePath: selectedPath || 'index.html',
                                } as any);
                              } catch {}
                              return next;
                            });
                          }}
                        >
                          <div className="w-12 shrink-0 select-none text-right pr-3 py-0.5 text-slate-400 border-r border-slate-100">{lineNo}</div>
                          <div className="whitespace-pre-wrap break-words px-3 py-0.5 text-slate-800">{line || '\u00A0'}</div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// legacy render removed
