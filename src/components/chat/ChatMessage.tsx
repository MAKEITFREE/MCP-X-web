import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatMessageVo } from '../../services/chatApi';
import ReactMarkdown from 'react-markdown';
import { Bot, Copy, Share2, Check, Volume2, Square, Image, FileText, Video, Music, Download, Globe } from 'lucide-react';
import { toast } from '../../utils/toast';
import 'github-markdown-css/github-markdown-light.css';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

// Mermaid 渲染器（按需加载CDN脚本，避免额外依赖）
const MermaidRenderer: React.FC<{ code: string }> = ({ code }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const ensureMermaid = async () => {
      const w = window as unknown as { mermaid?: any };
      let mermaidLib: any = w.mermaid;
      if (!mermaidLib) {
        // 优先尝试以模块方式加载本地文件（常见为 esm.mjs 构建，体积较大）
        try {
          const mod = await import(/* @vite-ignore */ new URL('/mermaid.min.js', window.location.origin).href);
          mermaidLib = (mod as any)?.default || (mod as any)?.mermaid;
          if (mermaidLib) {
            w.mermaid = mermaidLib;
          }
        } catch (e) {
          // 回退：以经典<script>方式加载本地 UMD 文件
          try {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = '/mermaid.min.js';
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Mermaid local script load failed'));
              document.head.appendChild(script);
            });
            mermaidLib = (window as any).mermaid;
          } catch (e2) {
            // 最终回退到 CDN，保证不阻塞渲染
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('Mermaid CDN load failed'));
              document.head.appendChild(script);
            });
            mermaidLib = (window as any).mermaid;
          }
        }
      }
      try {
        if (mermaidLib && typeof mermaidLib.initialize === 'function') {
          mermaidLib.initialize({ startOnLoad: false });
          if (containerRef.current) {
            containerRef.current.innerHTML = code;
            mermaidLib.init(undefined, containerRef.current);
          }
        }
      } catch (e) {
        console.warn('Mermaid render failed:', e);
      }
    };
    ensureMermaid();
  }, [code]);

  return (
    <div className="mb-2 overflow-auto">
      <div ref={containerRef} className="mermaid" />
    </div>
  );
};

interface AgentStep {
  stage?: string;
  status?: string;
  message?: string;
  timestamp?: number;
}

// 工具调用步骤接口
interface ToolCallStep {
  stage: string;
  type: string;
  message: string;
  tool: string;
  timestamp: number;
}

interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  score?: number;
  raw_content?: string | null;
}

interface WebSearchData {
  id: string;
  name: string;
  arguments: string;
  result: string;
  type: string;
  parsedResult?: {
    query?: string;
    results?: WebSearchResult[];
    images?: any[];
    answer?: string | null;
    follow_up_questions?: string[] | null;
    response_time?: number;
    request_id?: string;
  };
}

interface ChatMessageProps {
  message: ChatMessageVo;
  isTyping?: boolean;
  agentSteps?: AgentStep[];
  onShowReferenceLinks?: () => void;
  onShowReferenceImages?: () => void;
  parsedFiles?: any[];
  webSearchData?: WebSearchData;
  toolCallSteps?: ToolCallStep[];
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isTyping, agentSteps, onShowReferenceLinks, onShowReferenceImages, parsedFiles, webSearchData, toolCallSteps }) => {
  const navigate = useNavigate();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showToolCalls, setShowToolCalls] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [showThink, setShowThink] = useState<boolean>(false);
  const [showWebSearch, setShowWebSearch] = useState<boolean>(false);

  // 解析 <think> 内容，并返回去除后的正文和思考文本
  const parseThink = (content: string): { visibleContent: string; thinkContent: string } => {
    try {
      const matches = [...content.matchAll(/<think>([\s\S]*?)<\/think>/gi)];
      const thinkContent = matches.map(m => (m[1] || '').trim()).filter(Boolean).join('\n\n');
      const visibleContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return { visibleContent, thinkContent };
    } catch {
      return { visibleContent: content, thinkContent: '' };
    }
  };

  // 解析 <images> 标签，提取图片URL并返回去除标签后的文本内容
  const parseImages = (content: string): { cleanContent: string; imageUrls: string[] } => {
    try {
      const imageMatches = [...content.matchAll(/<images>(.*?)<\/images>/gi)];
      const imageUrls: string[] = [];
      
      imageMatches.forEach(match => {
        const urlsText = match[1] || '';
        // 提取URL，支持多种分隔符（换行、逗号、分号、空格）
        const urls = urlsText.split(/[\n\r,;|\s]+/)
          .map(url => url.trim())
          .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
        imageUrls.push(...urls);
      });
      
      // 移除 <images> 标签，保留其他内容
      const cleanContent = content.replace(/<images>.*?<\/images>/gi, '').trim();
      
      return { cleanContent, imageUrls };
    } catch {
      return { cleanContent: content, imageUrls: [] };
    }
  };

  // 解析引用链接，提取 ref 编号和对应的 URL 映射
  const parseReferenceUrls = (content: string): Map<string, string> => {
    const refMap = new Map<string, string>();
    
    // 匹配引用文献部分的格式，例如：
    // **[1] 标题**  
    // 📊 [查看完整报告](https://example.com)
    // 或者直接的 [1]: URL 格式
    // 或者 **[1]** ... (URL) 格式
    
    // 方法1: 匹配 **[数字]...** 后面紧跟的链接
    const refBlockRegex = /\*\*\[(\d+)\][^*]*\*\*[^[]*\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = refBlockRegex.exec(content)) !== null) {
      const refNum = match[1];
      const url = match[2];
      if (!refMap.has(refNum)) {
        refMap.set(refNum, url);
      }
    }
    
    // 方法2: 匹配参考来源部分的 URL 列表（带数字前缀的）
    // 例如: 1. https://example.com
    const sourceListRegex = /^(\d+)\.\s+(https?:\/\/[^\s]+)/gm;
    while ((match = sourceListRegex.exec(content)) !== null) {
      const refNum = match[1];
      const url = match[2];
      if (!refMap.has(refNum)) {
        refMap.set(refNum, url);
      }
    }
    
    // 方法3: 匹配 markdown 引用定义格式 [数字]: URL
    const refDefRegex = /^\[(\d+)\]:\s*(https?:\/\/[^\s]+)/gm;
    while ((match = refDefRegex.exec(content)) !== null) {
      const refNum = match[1];
      const url = match[2];
      if (!refMap.has(refNum)) {
        refMap.set(refNum, url);
      }
    }
    
    return refMap;
  };

  const { visibleContent, thinkContent, imageUrls, referenceUrls } = React.useMemo(() => {
    const content = message.content || '';
    // 先解析引用链接
    const referenceUrls = parseReferenceUrls(content);
    // 再解析 think 标签
    const { visibleContent: afterThink, thinkContent } = parseThink(content);
    // 再解析 images 标签
    const { cleanContent: visibleContent, imageUrls } = parseImages(afterThink);
    return { visibleContent, thinkContent, imageUrls, referenceUrls };
  }, [message.content]);

  // 流式时展开，完成后默认折叠
  React.useEffect(() => {
    if (message.role === 'assistant' && thinkContent) {
      setShowThink(Boolean(isTyping));
    }
  }, [message.id, message.role, isTyping, thinkContent]);
  
  // const avatar = isUser 
  //   ? 'https://avatars.githubusercontent.com/u/76239030?v=4'
  //   : 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png';

  // 格式化时间显示
  const formatMessageTime = (timeStr?: string) => {
    if (!timeStr) return '';
    
    try {
      const date = new Date(timeStr);
      const now = new Date();
      // const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      // 如果是今天，显示时间
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      }
      
      // 如果是昨天，显示"昨天 + 时间"
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })}`;
      }
      
      // 如果是今年，显示"月-日 时间"
      if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })}`;
      }
      
      // 其他情况显示完整日期
      return date.toLocaleDateString('zh-CN', { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.warn('时间格式化失败:', timeStr, error);
      return '';
    }
  };

  // 复制文字功能
  const handleCopy = async () => {
    try {
      const copyText = isUser ? message.content : visibleContent;
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      toast.error('复制失败');
    }
  };

  // 分享文案功能
  const handleShare = async () => {
    const shareText = `AI助手回复：\n\n${isUser ? message.content : visibleContent}\n\n— 来自智能助手`;
    
    if (navigator.share) {
      // 使用原生分享API（移动端）
      try {
        await navigator.share({
          title: 'AI助手回复',
          text: shareText
        });
              } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error('分享失败:', error);
            // 如果原生分享失败，fallback到复制
            fallbackShare(shareText);
          }
        }
    } else {
      // 桌面端fallback到复制
      fallbackShare(shareText);
    }
  };

  const fallbackShare = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('分享文案已复制到剪贴板');
    } catch (error) {
      console.error('复制分享文案失败:', error);
      toast.error('分享失败');
    }
  };

  // 语音朗读
  const canTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const handleSpeak = () => {
    const speakText = isUser ? message.content : visibleContent;
    if (!canTTS || !speakText) return;
    try {
      // 停止任何正在进行的朗读，避免串音
      window.speechSynthesis.cancel();

      // 清除之前的引用
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current = null;
      }

      const utterance = new SpeechSynthesisUtterance(speakText);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // 设置事件处理器
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);

      // 立即设置speaking状态，确保按钮显示正确
      setSpeaking(true);
    } catch (e) {
      console.error('朗读失败:', e);
      toast.error('朗读失败');
      setSpeaking(false);
    }
  };

  const handleStopSpeak = () => {
    if (!canTTS) return;
    try {
      window.speechSynthesis.cancel();
      // 清除引用
      if (utteranceRef.current) {
        utteranceRef.current.onend = null;
        utteranceRef.current.onerror = null;
        utteranceRef.current = null;
      }
      setSpeaking(false);
    } catch (e) {
      console.error('停止朗读失败:', e);
    }
  };

  // 检测和渲染链接的函数
  const renderTextWithLinks = (text: string) => {
    // URL正则表达式，匹配http/https链接
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if(text){
      const parts = text.split(urlRegex);
    
      return parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <a
              key={index}
              href={part}
              onClick={(e) => {
                e.preventDefault();
                window.open(part, '_blank', 'noopener,noreferrer');
              }}
              className="text-blue-400 hover:text-blue-300 underline cursor-pointer transition-colors"
              target="_blank"
              rel="noopener noreferrer"
              title={part}
            >
              {part}
            </a>
          );
        }
        return part;
      });
    }
    return null;
  };

  // 获取文件图标
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  // 处理图片查看
  const handleImageClick = (imageUrl: string, imageName?: string) => {
    if (!imageUrl) return;
    const params = new URLSearchParams();
    params.set('url', imageUrl);
    if (imageName) {
      params.set('name', imageName);
    }
    navigate(`/image-viewer?${params.toString()}`);
  };

  // 检测消息内容中是否有链接
  const hasLinks = React.useMemo(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(visibleContent);
  }, [visibleContent]);

  // 渲染解析出的图片
  const renderParsedImages = () => {
    if (!imageUrls || imageUrls.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        <div className={`grid gap-2 ${imageUrls.length === 1 ? 'grid-cols-1' : imageUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
          {imageUrls.map((url, index) => (
            <div key={index} className="w-[150px] h-[150px] border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
              <div className="relative group w-full h-full">
                <img
                  src={url}
                  alt={`图片 ${index + 1}`}
                  className="w-full h-full object-cover cursor-pointer transition-transform duration-200 hover:scale-105"
                  onClick={() => handleImageClick(url, `图片 ${index + 1}`)}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NCAyMSAzIDE2Ljk3MDYgMyAxMkMzIDcuMDI5NCA3LjAyOTQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQgMjEgMTJaIiBzdHJva2U9IiM5Q0E4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                    img.alt = '图片加载失败';
                    img.className = 'w-full h-full object-contain opacity-50';
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <button
                    onClick={() => handleImageClick(url, `图片 ${index + 1}`)}
                    className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-1.5 shadow-lg transition-opacity duration-200"
                    title="查看大图"
                  >
                    <Image className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染文件附件
  const renderFileAttachments = () => {
    if (!message.files || message.files.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {message.files.map((file) => {
          const isImage = file.type.startsWith('image/');

          return (
            <div key={file.uid} className="border border-gray-200 rounded-lg overflow-hidden">
              {isImage && file.url ? (
                // 图片预览
                <div className="relative group">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-w-full max-h-64 object-contain cursor-pointer"
                    onClick={() => handleImageClick(file.url!, file.name)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                    <button
                      onClick={() => handleImageClick(file.url!, file.name)}
                      className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-2 shadow-lg transition-opacity duration-200"
                      title="查看大图"
                    >
                      <Image className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                // 文件信息显示
                <div className="p-3 bg-gray-50 flex items-center gap-3">
                  <div className="text-gray-500">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  {file.url && (
                    <button
                      onClick={() => window.open(file.url, '_blank')}
                      className="text-gray-500 hover:text-blue-500 transition-colors"
                      title="下载文件"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染网络搜索结果
  const renderWebSearchResults = () => {
    if (!webSearchData || !webSearchData.parsedResult) return null;

    const { parsedResult } = webSearchData;
    const results = parsedResult.results || [];
    
    if (results.length === 0) return null;

    return (
      <div className="mt-3 mb-3 border border-blue-200 rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
        <button
          onClick={() => setShowWebSearch(!showWebSearch)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              网络搜索结果
            </span>
            <span className="text-xs text-blue-600 bg-blue-200/50 px-2 py-0.5 rounded-full">
              {results.length} 条
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-blue-600 transition-transform ${showWebSearch ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showWebSearch && (
          <div className="border-t border-blue-200 bg-white">
            {parsedResult.query && (
              <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100">
                <span className="text-xs text-blue-700">
                  搜索关键词: <span className="font-medium">{parsedResult.query}</span>
                </span>
              </div>
            )}
            <div className="max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="px-4 py-3 border-b border-blue-100 last:border-b-0 hover:bg-blue-50/30 transition-colors"
                >
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {index + 1}
                      </span>
                      <h4 className="text-sm font-medium text-blue-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {result.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-1 ml-6">
                      {result.content}
                    </p>
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-xs text-gray-400 truncate">
                        {result.url}
                      </span>
                      {result.score !== undefined && (
                        <span className="text-xs text-gray-400">
                          相关度: {(result.score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </a>
                </div>
              ))}
            </div>
            {parsedResult.response_time && (
              <div className="px-4 py-2 bg-blue-50/50 border-t border-blue-100 text-xs text-gray-500 text-right">
                响应时间: {parsedResult.response_time.toFixed(2)}s
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染工具调用步骤 - Manus 风格
  const renderToolCallSteps = () => {
    if (!toolCallSteps || toolCallSteps.length === 0) return null;

    // 按工具分组步骤
    const toolGroups: Record<string, ToolCallStep[]> = {};
    toolCallSteps.forEach(step => {
      const tool = step.tool || 'unknown';
      if (!toolGroups[tool]) {
        toolGroups[tool] = [];
      }
      toolGroups[tool].push(step);
    });

    // 获取最后一个步骤的状态
    const lastStep = toolCallSteps[toolCallSteps.length - 1];
    const isComplete = lastStep?.stage === 'complete';
    const hasError = toolCallSteps.some(s => s.stage?.includes('error') || s.stage?.includes('failed'));

    // 获取工具图标
    const getToolIcon = (tool: string) => {
      switch (tool.toLowerCase()) {
        case 'websearch':
          return '🔍';
        case 'fetchurlcontent':
          return '🌐';
        default:
          return '⚡';
      }
    };

    // 获取步骤状态图标
    const getStepIcon = (stage: string) => {
      if (stage?.includes('complete') || stage?.includes('success')) return '✓';
      if (stage?.includes('error') || stage?.includes('failed')) return '✗';
      if (stage?.includes('waiting') || stage?.includes('fetching')) return '○';
      return '›';
    };

    return (
      <div className="mb-3 rounded-xl border border-slate-200/60 bg-slate-50/50 overflow-hidden">
        {/* 折叠头部 */}
        <button
          onClick={() => setShowToolCalls(!showToolCalls)}
          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-100/50 transition-colors"
        >
          {/* 状态指示器 */}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
            isComplete 
              ? 'bg-emerald-100 text-emerald-600' 
              : hasError 
                ? 'bg-amber-100 text-amber-600' 
                : 'bg-blue-100 text-blue-600'
          }`}>
            {isComplete ? '✓' : hasError ? '!' : (
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
          
          {/* 标题和统计 */}
          <div className="flex-1 flex items-center gap-2 text-left">
            <span className="text-sm font-medium text-slate-700">
              {isComplete ? '已完成' : '正在执行'} 工具调用
            </span>
            <span className="text-xs text-slate-400">
              {Object.keys(toolGroups).length} 个工具
            </span>
          </div>
          
          {/* 展开/收起图标 */}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showToolCalls ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* 展开内容 */}
        {showToolCalls && (
          <div className="border-t border-slate-200/60">
            {Object.entries(toolGroups).map(([tool, steps], groupIndex) => {
              const toolComplete = steps.some(s => s.stage === 'complete' || s.stage?.includes('success'));
              const toolError = steps.some(s => s.stage?.includes('error') || s.stage?.includes('failed'));
              
              return (
                <div key={tool} className={`${groupIndex > 0 ? 'border-t border-slate-100' : ''}`}>
                  {/* 工具标题 */}
                  <div className="px-3 py-2 bg-white/50 flex items-center gap-2">
                    <span className="text-base">{getToolIcon(tool)}</span>
                    <span className="text-xs font-medium text-slate-600">{tool}</span>
                    <div className={`ml-auto w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                      toolComplete 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : toolError 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-slate-100 text-slate-400'
                    }`}>
                      {toolComplete ? '✓' : toolError ? '✗' : '…'}
                    </div>
                  </div>
                  
                  {/* 步骤列表 */}
                  <div className="px-3 py-1.5 bg-white/30 max-h-48 overflow-y-auto">
                    {steps.map((step, index) => {
                      const isError = step.stage?.includes('error') || step.stage?.includes('failed');
                      const isSuccess = step.stage?.includes('success') || step.stage === 'complete';
                      
                      return (
                        <div
                          key={`${step.timestamp}-${index}`}
                          className="flex items-start gap-2 py-1 text-xs"
                        >
                          {/* 步骤图标 */}
                          <span className={`w-4 h-4 flex items-center justify-center flex-shrink-0 ${
                            isError ? 'text-red-500' : 
                            isSuccess ? 'text-emerald-500' : 
                            'text-slate-400'
                          }`}>
                            {getStepIcon(step.stage)}
                          </span>
                          
                          {/* 步骤消息 */}
                          <span className={`flex-1 leading-relaxed ${
                            isError ? 'text-red-600' : 
                            isSuccess ? 'text-emerald-600' : 
                            'text-slate-500'
                          }`}>
                            {step.message?.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/gu, '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 渲染解析出的文件（来自 <files> 标签）
  const renderParsedFiles = () => {
    console.log('ChatMessage 组件接收到的 parsedFiles:', parsedFiles);
    if (!parsedFiles || parsedFiles.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {parsedFiles.map((file, index) => {
          const isImage = (file.type || '').startsWith('image/');

          return (
            <div key={`parsed-${index}`} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              {isImage && file.url ? (
                // 图片预览
                <div className="relative group">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="max-w-full max-h-64 object-contain cursor-pointer"
                    onClick={() => handleImageClick(file.url, file.name)}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NCAyMSAzIDE2Ljk3MDYgMyAxMkMzIDcuMDI5NCA3LjAyOTQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQgMjEgMTJaIiBzdHJva2U9IiM5Q0E4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                      img.alt = '图片加载失败';
                      img.className = 'w-full h-24 object-contain opacity-50';
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                    <button
                      onClick={() => handleImageClick(file.url, file.name)}
                      className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-2 shadow-lg transition-opacity duration-200"
                      title="查看大图"
                    >
                      <Image className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                // 文件信息显示
                <div className="p-3 bg-gray-50 flex items-center gap-3">
                  <div className="text-gray-600">
                    {getFileIcon(file.type || 'application/octet-stream')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.name || '解析的文件'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {file.size && file.size > 0 ? formatFileSize(file.size) : '点击下载查看'}
                    </div>
                  </div>
                  {file.url && (
                    <button
                      onClick={() => window.open(file.url, '_blank')}
                      className="text-gray-500 hover:text-blue-600 transition-colors flex-shrink-0"
                      title="下载文件"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end items-start' : 'justify-start items-start'}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0 mt-1 -ml-[52px] mr-6">
          <Bot size={20} className="text-white" />
        </div>
      )}

      <div className={`w-full ${!isUser ? 'relative group' : ''}`}>
        <div className={`px-4 py-3 rounded-lg shadow-sm ${
            isUser
            ? 'bg-blue-600 text-white rounded-br-sm ml-auto w-fit max-w-5xl'
            : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm w-fit max-w-5xl'
        }`}>
          {isTyping ? (
            <div>
              {/* 工作流步骤面板 - 即使在typing状态也要显示 */}
              {!isUser && agentSteps && agentSteps.length > 0 && (
                <div className="mb-4 rounded-lg border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50 shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between bg-white/50 rounded-t-lg">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      工作流状态
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-200/50 px-2 py-1 rounded-full">
                      深度思考模式
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                    {agentSteps?.map((step, idx) => {
                      const status = (step.status || '').toLowerCase();
                      const statusColor =
                        status === 'start' || status === 'running'
                          ? 'text-blue-600'
                          : status === 'success' || status === 'end' || status === 'finished'
                          ? 'text-green-600'
                          : status === 'error' || status === 'failed'
                          ? 'text-red-600'
                          : status === 'skip'
                          ? 'text-yellow-600'
                          : 'text-slate-600';
                      return (
                        <div key={`${idx}-${step.timestamp || idx}`} className="px-4 py-3 border-t border-slate-100/50 text-sm hover:bg-white/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              status === 'start' || status === 'running'
                                ? 'bg-blue-500 animate-pulse'
                                : status === 'success' || status === 'end' || status === 'finished'
                                ? 'bg-green-500'
                                : status === 'error' || status === 'failed'
                                ? 'bg-red-500'
                                : status === 'skip'
                                ? 'bg-yellow-500'
                                : 'bg-slate-400'
                            }`}></div>
                            <span className={`font-medium ${statusColor} capitalize`}>{step.status || '...'}</span>
                            {step.stage && (
                              <span className="text-slate-600 bg-slate-200/50 px-2 py-1 rounded text-xs">{step.stage}</span>
                            )}
                            {step.timestamp && (
                              <span className="ml-auto text-xs text-slate-500 font-mono">
                                {new Date(step.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {step.message && (
                            <div className="mt-2 text-slate-700 leading-relaxed pl-5 border-l-2 border-slate-200/50">{step.message}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          ) : isUser ? (
            // 用户消息使用简单的链接检测
            <div>
              <div style={{ color: isUser ? 'white' : 'inherit' }}>
                {renderTextWithLinks(visibleContent)}
              </div>
              {/* 渲染解析出的图片 */}
              {renderParsedImages()}
            </div>
          ) : (
            // AI消息使用Markdown渲染
            <div className="markdown-body" style={{ background: 'transparent', color: isUser ? 'white' : 'inherit' }}>
              {/* 工作流步骤面板 */}
              {agentSteps && agentSteps.length > 0 && (
                <div className="mb-4 rounded-lg border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/50 shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between bg-white/50 rounded-t-lg">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      工作流状态
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-200/50 px-2 py-1 rounded-full">
                      深度思考模式
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                    {agentSteps?.map((step, idx) => {
                      const status = (step.status || '').toLowerCase();
                      const statusColor =
                        status === 'start' || status === 'running'
                          ? 'text-blue-600'
                          : status === 'success' || status === 'end' || status === 'finished'
                          ? 'text-green-600'
                          : status === 'error' || status === 'failed'
                          ? 'text-red-600'
                          : status === 'skip'
                          ? 'text-yellow-600'
                          : 'text-slate-600';
                      return (
                        <div key={`${idx}-${step.timestamp || idx}`} className="px-4 py-3 border-t border-slate-100/50 text-sm hover:bg-white/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              status === 'start' || status === 'running'
                                ? 'bg-blue-500 animate-pulse'
                                : status === 'success' || status === 'end' || status === 'finished'
                                ? 'bg-green-500'
                                : status === 'error' || status === 'failed'
                                ? 'bg-red-500'
                                : status === 'skip'
                                ? 'bg-yellow-500'
                                : 'bg-slate-400'
                            }`}></div>
                            <span className={`font-medium ${statusColor} capitalize`}>{step.status || '...'}</span>
                            {step.stage && (
                              <span className="text-slate-600 bg-slate-200/50 px-2 py-1 rounded text-xs">{step.stage}</span>
                            )}
                            {step.timestamp && (
                              <span className="ml-auto text-xs text-slate-500 font-mono">
                                {new Date(step.timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {step.message && (
                            <div className="mt-2 text-slate-700 leading-relaxed pl-5 border-l-2 border-slate-200/50">{step.message}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {thinkContent && (
                <div className="mb-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500 select-none">
                    <span>思考过程</span>
                    <button
                      type="button"
                      onClick={() => setShowThink(v => !v)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {showThink ? '收起' : '展开'}
                    </button>
                  </div>
                  {showThink && (
                    <div className="mt-1 text-gray-500 text-sm whitespace-pre-wrap leading-relaxed">
                      {thinkContent}
                    </div>
                  )}
                </div>
              )}
              {/* 调试信息 - 仅在开发环境显示 */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-500 mb-1" style={{ fontSize: '10px' }}>
                  内容长度: {visibleContent.length} 字符
                </div>
              )}
              {/* 渲染工具调用步骤 - 放在内容上方 */}
              {renderToolCallSteps()}
              <ReactMarkdown
                key={`${message.id}-${visibleContent.length}`}
                rehypePlugins={[rehypeRaw]}
                remarkPlugins={[remarkGfm]}
                components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ children, className }) => {
                      const isInline = !className?.includes('language-');
                      // Mermaid 代码块渲染
                      if (!isInline && className && /language-?mermaid/i.test(className)) {
                        return <MermaidRenderer code={String(children)} />;
                      }
                      return isInline ? (
                        <code className="bg-gray-700 px-1 py-0.5 rounded text-xs">{children}</code>
                      ) : (
                        <pre className="bg-gray-700 p-3 rounded-lg overflow-x-auto">
                          <code className="text-xs">{children}</code>
                        </pre>
                      );
                    },
                    pre: ({ children }) => <div className="mb-2">{children}</div>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-300 mb-2">
                        {children}
                      </blockquote>
                    ),
                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    a: ({ href, children }) => {
                      const handleLinkClick = (e: React.MouseEvent) => {
                        e.preventDefault();
                        if (href) {
                          // 检查是否是引用锚点链接（如 #ref1, #ref2 等）
                          const refMatch = href.match(/^#ref(\d+)$/i);
                          if (refMatch) {
                            const refNum = refMatch[1];
                            // 从引用映射中获取实际URL
                            const actualUrl = referenceUrls.get(refNum);
                            if (actualUrl) {
                              window.open(actualUrl, '_blank', 'noopener,noreferrer');
                              return;
                            }
                          }
                          // 非引用链接或找不到对应URL，直接在新标签页中打开
                          window.open(href, '_blank', 'noopener,noreferrer');
                        }
                      };
                      
                      // 获取实际显示的URL（用于title提示）
                      let displayUrl = href;
                      if (href) {
                        const refMatch = href.match(/^#ref(\d+)$/i);
                        if (refMatch) {
                          const refNum = refMatch[1];
                          const actualUrl = referenceUrls.get(refNum);
                          if (actualUrl) {
                            displayUrl = actualUrl;
                          }
                        }
                      }
                      
                      return (
                        <a
                          href={href}
                          onClick={handleLinkClick}
                          className="text-blue-400 hover:text-blue-300 underline cursor-pointer transition-colors"
                          target="_blank"
                          rel="noopener noreferrer"
                          title={displayUrl}
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
              >
                {visibleContent}
              </ReactMarkdown>
              {/* 渲染网络搜索结果 */}
              {renderWebSearchResults()}
              {/* 渲染解析出的图片 */}
              {renderParsedImages()}
            </div>
          )}
        </div>

        {/* 文件附件区域 - 在气泡外部显示 */}
        {!isTyping && (
          <div className={`${isUser ? 'ml-auto w-fit' : ''}`}>
            {/* 渲染用户上传的文件 */}
            {renderFileAttachments()}
            {/* 渲染解析出的文件（来自 <files> 标签） */}
            {renderParsedFiles()}
          </div>
        )}

        {/* AI回复的操作按钮和时间 */}
        {!isUser && !isTyping && visibleContent && (
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 transition-opacity duration-200 md:opacity-100">
            {canTTS && (
              <>
                <button
                  onClick={handleSpeak}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-all duration-200 border border-transparent hover:border-emerald-200 active:scale-95"
                  title={speaking ? '重新播放' : '朗读'}
                >
                  <Volume2 size={12} />
                  <span>{speaking ? '重播' : '朗读'}</span>
                </button>
                {speaking && (
                  <button
                    onClick={handleStopSpeak}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-200 border border-transparent hover:border-red-200 active:scale-95"
                    title="停止朗读"
                  >
                    <Square size={12} />
                    <span>停止</span>
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-all duration-200 border border-transparent hover:border-gray-300 active:scale-95"
              title="复制文字"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-green-500" />
                  <span className="text-green-500">已复制</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>复制</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleShare}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200 border border-transparent hover:border-blue-200 active:scale-95"
              title="分享文案"
            >
              <Share2 size={12} />
              <span>分享</span>
            </button>

            {hasLinks && onShowReferenceLinks && (
              <button
                onClick={() => onShowReferenceLinks()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-all duration-200 border border-transparent hover:border-purple-200 active:scale-95"
                title="查看参考链接"
              >
                <Globe size={12} />
                <span>参考链接</span>
              </button>
            )}

            {/* 参考图片按钮 */}
            {onShowReferenceImages && (
              <button
                onClick={() => onShowReferenceImages()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-all duration-200 border border-transparent hover:border-green-200 active:scale-95"
                title="查看参考图片"
              >
                <Image size={12} />
                <span>参考图片</span>
              </button>
            )}

            {/* 时间显示在按钮右边 */}
            {formatMessageTime(message.createTime) && (
              <span className="text-xs text-gray-400 select-none">
                {formatMessageTime(message.createTime)}
              </span>
            )}
          </div>
        )}

        {/* 用户消息的时间显示 */}
        {isUser && !isTyping && formatMessageTime(message.createTime) && (
          <div className="flex items-center justify-end mt-1">
            <span className="text-xs text-gray-400 px-1 select-none">
              {formatMessageTime(message.createTime)}
            </span>
          </div>
        )}
      </div>

      {/* {isUser && (
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shadow-sm flex-shrink-0 mt-1">
          <User size={20} className="text-slate-500" />
        </div>
      )} */}
    </div>
  );
}; 