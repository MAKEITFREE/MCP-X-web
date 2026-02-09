import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChatProvider, useChat } from '../contexts/ChatContext';
import { FilesProvider } from '../contexts/FilesContext';
import { useLanguage } from '../contexts/LanguageContext';
import { chatApi, ChatMessageVo, streamChatSend, streamChatSendWithFiles } from '../services/chatApi';
import { modelApi, ModelInfo } from '../services/modelApi';
import { toast } from '../utils/toast';
import { 
  shouldShowSpeechRecognition, 
  createSpeechRecognition,
  isWeChatBrowser,
  isMobileBrowser,
  getBrowserEnvironmentInfo
} from '../utils/speechRecognition';

import { api } from '../services/api';
import config from '../config';
import { 
  Menu, 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  X, 
  Plus,
  User,
  Bot,
  FileText,
  Image,
  Video,
  Music
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import 'github-markdown-css/github-markdown-light.css';

// —— 设备指纹与持久机器用户ID（同机同ID） ——
const readCookie = (name: string): string | null => {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
};

const writeCookie = (name: string, value: string) => {
  try {
    const tenYears = 60 * 60 * 24 * 3650;
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${tenYears}`;
  } catch {}
};

const generateStableMachineId = (): number => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Stable Machine Fingerprint', 2, 2);
    }

    const features = [
      navigator.platform || '',
      navigator.language || '',
      screen && (screen.width + 'x' + screen.height),
      screen && screen.colorDepth,
      (navigator as any).hardwareConcurrency || '',
      (navigator as any).deviceMemory || '',
      window.devicePixelRatio || '',
      navigator.vendor || '',
      (navigator as any).maxTouchPoints || 0,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');

    let hash = 0;
    for (let i = 0; i < features.length; i++) {
      const ch = features.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash = hash & hash;
    }
    const absHash = Math.abs(hash);
    const base = 99000000000000000; // 99开头
    const id = base + (absHash % 1000000000000000);
    return id;
  } catch {
    // 兜底：时间种子但仍保持99前缀与长度
    const base = 99000000000000000;
    return base + (Date.now() % 1000000000000000);
  }
};

const getPersistentMachineUserId = (): number => {
  const fromCookie = readCookie('mcpx_machine_uid');
  const fromLs = localStorage.getItem('machineUserId');
  const existing = fromCookie || fromLs;
  if (existing && /^\d{18}$/.test(existing)) {
    if (!fromLs) localStorage.setItem('machineUserId', existing);
    if (!fromCookie) writeCookie('mcpx_machine_uid', existing);
    return parseInt(existing);
  }
  const generated = generateStableMachineId();
  const idStr = generated.toString();
  localStorage.setItem('machineUserId', idStr);
  writeCookie('mcpx_machine_uid', idStr);
  return generated;
};

// 解析中文时间格式
const parseChinaTimeString = (timeStr: string): Date | null => {
  try {
    // 处理格式：2025/8/12 下午7:46
    const match = timeStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, period, hour, minute] = match;
      let hourNum = parseInt(hour);
      
      // 处理上午/下午
      if (period === '下午' && hourNum !== 12) {
        hourNum += 12;
      } else if (period === '上午' && hourNum === 12) {
        hourNum = 0;
      }
      
      return new Date(
        parseInt(year),
        parseInt(month) - 1, // 月份从0开始
        parseInt(day),
        hourNum,
        parseInt(minute)
      );
    }
    return null;
  } catch (error) {
    return null;
  }
};

// 格式化时间显示
const formatMessageTime = (timeStr?: string | number, currentLanguage: string = 'zh') => {
  if (!timeStr) return '';
  
  try {
    let date: Date;
    
    // 处理不同的时间格式
    if (typeof timeStr === 'number') {
      // 数字时间戳
      date = new Date(timeStr);
    } else if (typeof timeStr === 'string') {
      // 字符串时间
      // 如果是纯数字字符串，当作时间戳处理
      if (/^\d+$/.test(timeStr)) {
        const timestamp = parseInt(timeStr);
        // 判断是秒还是毫秒时间戳
        date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
      } else {
        // 尝试解析中文时间格式
        const chinaDate = parseChinaTimeString(timeStr);
        if (chinaDate) {
          date = chinaDate;
        } else {
          date = new Date(timeStr);
        }
      }
    } else {
      return '';
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', timeStr, 'typeof:', typeof timeStr);
      return '';
    }
    
    const now = new Date();
    const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
    const hour12 = currentLanguage === 'en';
    
    // 如果是今天，显示时间
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString(locale, { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12 
      });
    }
    
    // 如果是昨天，显示"昨天/Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      const yesterdayText = currentLanguage === 'zh' ? '昨天' : 'Yesterday';
      return yesterdayText;
    }
    
    // 计算天数差，用于判断是否超过一周
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 本周内（昨天之后到7天内）：显示星期几
    if (diffDays > 1 && diffDays <= 7) {
      const weekdays = currentLanguage === 'zh'
        ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return weekdays[date.getDay()];
    }

    // 本周之前（超过7天）：只显示年月日
    if (diffDays > 7) {
      return date.toLocaleDateString(locale, {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
      });
    }

    // 如果是今年，显示"月-日 时间"
    if (date.getFullYear() === now.getFullYear()) {
      if (currentLanguage === 'zh') {
        return `${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}`;
      } else {
        return date.toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12
        });
      }
    }

    // 其他情况显示完整日期（跨年但在本周内）
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: currentLanguage === 'zh' ? '2-digit' : 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12
    });
  } catch (error) {
    console.warn('时间格式化失败:', timeStr, error);
    return '';
  }
};

// 移动端聊天消息组件
const MobileChatMessage: React.FC<{ message: ChatMessageVo; isTyping?: boolean }> = ({ 
  message, 
  isTyping 
}) => {
  const { currentLanguage, t } = useLanguage();
  const isUser = message.role === 'user';
  const [showRefModal, setShowRefModal] = useState(false);
  const [refLinks, setRefLinks] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState('');

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

  const { imageUrls, referenceLinks, contentWithoutRefs } = React.useMemo(() => {
    const raw = message.content || '';
    const { cleanContent, imageUrls } = parseImages(raw);

    // 提取“参考来源”后的链接列表
    const parts = raw.split(/参考来源[:：]/);
    const refTail = parts.length >= 2 ? parts.slice(1).join('参考来源：') : '';
    const urlRegex = /(https?:\/\/[^\s)]+)\)?/gi;
    const links: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(refTail)) !== null) {
      const url = m[1].trim();
      if (url && !links.includes(url)) {
        links.push(url);
      }
    }

    // 去掉正文中的参考来源段落
    const contentWithoutRefs = cleanContent.split(/参考来源[:：]/)[0]?.trim() || cleanContent;

    return { imageUrls, referenceLinks: links, contentWithoutRefs };
  }, [message.content]);

  // 加载参考来源列表（调用与 ChatPage 相同的接口）
  const loadReferenceLinks = useCallback(async () => {
    if (!message.sessionId) {
      setRefError('无法获取会话ID');
      setShowRefModal(true);
      return;
    }
    setRefLoading(true);
    setRefError('');
    setShowRefModal(true);
    try {
      const response = await chatApi.getAiQueryResults({
        queryId: message.sessionId,
        pageNum: 1,
        pageSize: 20
      });
      if (response.code === 200 || response.code === 0) {
        const { rows = [] } = response.data || response;
        setRefLinks(rows || []);
      } else {
        setRefError('获取参考链接失败');
        setRefLinks([]);
      }
    } catch (error: any) {
      console.error('获取参考链接失败:', error);
      setRefError(error?.message || '获取参考链接失败');
      setRefLinks([]);
    } finally {
      setRefLoading(false);
    }
  }, [message.sessionId]);

  // 获取文件图标
  const getFileIcon = (type: string = '') => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  // 渲染解析出的图片
  const renderParsedImages = () => {
    if (!imageUrls || imageUrls.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        <div className={`grid gap-1.5 ${imageUrls.length === 1 ? 'grid-cols-1' : imageUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {imageUrls.map((url, index) => (
            <div key={index} className="w-[150px] h-[150px] border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
              <img
                src={url}
                alt={`图片 ${index + 1}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => window.open(url, '_blank')}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NCAyMSAzIDE2Ljk3MDYgMyAxMkMzIDcuMDI5NCA3LjAyOTQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQgMjEgMTJaIiBzdHJva2U9IiM5Q0E4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                  img.alt = '图片加载失败';
                  img.className = 'w-full h-full object-contain opacity-50';
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染用户上传的文件（含图片预览）
  const renderFileAttachments = () => {
    if (!message.files || message.files.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {message.files.map((file, index) => {
          const isImage = (file.type || '').startsWith('image/');
          const key = file.uid || file.url || `${file.name}-${index}`;

          if (isImage && file.url) {
            return (
              <div key={key} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-auto max-h-40 object-cover cursor-pointer"
                  onClick={() => window.open(file.url!, '_blank')}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgMTJMMTEgMTRMMTUgMTBNMjEgMTJDMjEgMTYuOTcwNiAxNi45NzA2IDIxIDEyIDIxQzcuMDI5NCAyMSAzIDE2Ljk3MDYgMyAxMkMzIDcuMDI5NCA3LjAyOTQgMyAxMiAzQzE2Ljk3MDYgMyAyMSA3LjAyOTQgMjEgMTJaIiBzdHJva2U9IiM5Q0E4QjAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
                    img.alt = '图片加载失败';
                    img.className = 'w-full h-20 object-contain opacity-50';
                  }}
                />
              </div>
            );
          }

          return (
            <div key={key} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg text-sm">
              <span className="text-gray-500">
                {getFileIcon(file.type || '')}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="truncate max-w-[9rem] text-gray-700">{file.name}</span>
                {file.size ? (
                  <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
          <Bot size={16} className="text-white" />
        </div>
      )}
      
      <div className={`max-w-[280px] ${!isUser ? 'flex-1' : ''}`}>
        <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
          isUser 
            ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-br-md' 
            : 'bg-white/80 backdrop-blur border border-gray-200 text-gray-800 rounded-bl-md'
        }`}>
          {isTyping ? (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
          ) : (
            <div
              className={`markdown-body text-sm leading-6 break-words ${
                isUser
                  ? [
                      '[&_p]:text-white',
                      '[&_li]:text-white',
                      '[&_strong]:text-white',
                      '[&_em]:text-white',
                      '[&_a]:text-white',
                      '[&_a]:underline',
                      '[&_code]:text-white',
                      '[&_code]:bg-white/10',
                      '[&_pre]:bg-white/10',
                      '[&_pre]:text-white',
                      '[&_blockquote]:border-white/30',
                      '[&_blockquote]:text-white',
                      '[&_table]:text-white',
                      '[&_thead]:text-white',
                      '[&_tbody]:text-white',
                    ].join(' ')
                  : 'text-gray-800'
              }`}
              style={{ background: 'transparent' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {contentWithoutRefs || ''}
              </ReactMarkdown>
            </div>
          )}
          {/* 渲染解析出的图片 */}
          {!isTyping && renderParsedImages()}
          {/* 渲染用户上传的文件 */}
          {!isTyping && renderFileAttachments()}
        </div>
        
        {/* 时间显示 */}
        {!isTyping && (
          <div className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {formatMessageTime(message.createTime, currentLanguage) || (message.createTime ? t('errors.loadFailed') : '')}
          </div>
        )}

        {/* 参考来源折叠展示 */}
        {!isTyping && referenceLinks.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => {
                loadReferenceLinks();
              }}
              className="text-xs px-2 py-1 rounded-full border border-blue-200 text-blue-600 bg-white/80 hover:bg-blue-50 transition-colors"
            >
              参考来源 ({referenceLinks.length})
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-gray-700 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
          <User size={16} className="text-white" />
        </div>
      )}
      </div>

      {/* 参考来源弹层（移动端全宽） */}
      {showRefModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex">
          <div className="bg-white w-full h-full md:h-auto md:max-w-md md:mx-auto md:my-8 rounded-none md:rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="text-sm font-medium text-gray-800">参考来源</div>
              <button
                onClick={() => setShowRefModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
              {refLoading && (
                <div className="text-gray-500 text-center py-4">加载中...</div>
              )}
              {!refLoading && refError && (
                <div className="text-red-500 text-center py-4">{refError}</div>
              )}
              {!refLoading && !refError && refLinks.length === 0 && (
                <div className="text-gray-500 text-center py-4">暂无参考链接</div>
              )}
              {!refLoading && !refError && refLinks.length > 0 && (
                <div className="space-y-3">
                  {refLinks.map((item: any, idx: number) => {
                    const url = item?.url || item?.link || item?.href || item;
                    const title = item?.title || item?.name || url;
                    return (
                      <div key={idx} className="border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                        <div className="text-gray-800 text-sm font-medium line-clamp-2 break-words">
                          {title || '参考链接'}
                        </div>
                        {url && (
                          <a
                            className="text-blue-600 text-xs break-words hover:underline"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {url}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 移动端聊天输入组件
type MobileChatInputHandle = {
  setMessage: (text: string) => void;
  appendMessage: (text: string) => void;
  focus: () => void;
};

const MobileChatInput = React.forwardRef<MobileChatInputHandle, {
  onSend: (message: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}>(({ onSend, disabled = false, placeholder }, ref) => {
  const { currentLanguage, t } = useLanguage();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  // 检测语音识别支持情况
  const speechRecognitionSupported = shouldShowSpeechRecognition();
  
  // 调试信息（开发环境下显示）
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('移动端语音识别环境信息:', getBrowserEnvironmentInfo());
    }
  }, []);

  React.useImperativeHandle(ref, () => ({
    setMessage: (text: string) => setMessage(text),
    appendMessage: (text: string) => setMessage(prev => prev + text),
    focus: () => textAreaRef.current?.focus()
  }), []);

  // 语音识别功能
  const toggleRecording = () => {
    // 检查是否支持语音识别
    if (!speechRecognitionSupported) {
      if (isWeChatBrowser()) {
        toast.error(currentLanguage === 'zh' ? 
          '微信浏览器不支持语音识别功能' : 
          'WeChat browser does not support speech recognition'
        );
      } else if (isMobileBrowser()) {
        toast.error(currentLanguage === 'zh' ? 
          '当前移动浏览器不支持语音识别功能' : 
          'Current mobile browser does not support speech recognition'
        );
      } else {
        toast.error(t('errors.voiceNotSupported'));
      }
      return;
    }

    // 如果正在录音，停止录音
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.warn('停止语音识别失败:', error);
        setIsRecording(false);
        recognitionRef.current = null;
      }
      return;
    }

    // 创建语音识别实例
    const recognition = createSpeechRecognition(currentLanguage === 'zh' ? 'zh-CN' : 'en-US');
    if (!recognition) {
      toast.error(t('errors.voiceNotSupported'));
      return;
    }

    // 配置事件处理器
    recognition.onstart = () => {
      console.log('语音识别开始');
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      try {
        if (event.results && event.results.length > 0) {
          const transcript = event.results[0][0].transcript;
          console.log('识别结果:', transcript);
          setMessage(prev => prev + transcript);
        }
      } catch (error) {
        console.error('处理识别结果失败:', error);
      }
    };

    recognition.onend = () => {
      console.log('语音识别结束');
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
      setIsRecording(false);
      recognitionRef.current = null;
      
      // 根据错误类型提供更具体的错误信息
      let errorMessage = t('errors.sendFailed');
      if (event.error === 'no-speech') {
        errorMessage = currentLanguage === 'zh' ? '未检测到语音，请重试' : 'No speech detected, please try again';
      } else if (event.error === 'audio-capture') {
        errorMessage = currentLanguage === 'zh' ? '无法访问麦克风，请检查权限设置' : 'Cannot access microphone, please check permissions';
      } else if (event.error === 'not-allowed') {
        errorMessage = currentLanguage === 'zh' ? '麦克风权限被拒绝，请在浏览器设置中允许访问' : 'Microphone permission denied, please allow access in browser settings';
      } else if (event.error === 'network') {
        errorMessage = currentLanguage === 'zh' ? '网络错误，请检查网络连接' : 'Network error, please check your connection';
      }
      
      toast.error(errorMessage);
    };

    // 开始识别
    try {
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('启动语音识别失败:', error);
      setIsRecording(false);
      recognitionRef.current = null;
      toast.error(t('errors.voiceNotSupported'));
    }
  };

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除文件
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
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

  // 发送消息
  const handleSend = () => {
    if ((!message.trim() && files.length === 0) || disabled) return;
    
    onSend(message.trim(), files);
    setMessage('');
    setFiles([]);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter键发送消息（不包括Shift+Enter，Shift+Enter用于换行）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 阻止默认的换行行为
      handleSend();
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur border-t border-gray-200 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg text-sm">
                <span className="text-gray-500">
                  {getFileIcon(file.type)}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate max-w-20 text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-500 hover:text-red-500 ml-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex items-center gap-2">
        {/* 附件按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="h-11 w-11 flex items-center justify-center rounded-full text-gray-600 hover:text-blue-500 disabled:opacity-50"
        >
          <Paperclip size={20} />
        </button>
        
        {/* 输入框 */}
        <div className="flex-1 relative">
          <textarea
            ref={textAreaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('chat.typingPlaceholder')}
            disabled={disabled}
            className="w-full px-4 py-3 bg-gray-50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm leading-5 text-gray-800 placeholder-gray-500 border border-gray-200 shadow-inner"
            rows={1}
            style={{ minHeight: '44px', maxHeight: '160px' }}
          />
        </div>

        {/* 语音和发送按钮 */}
        <div className="flex gap-2">
          {/* 只在支持语音识别的环境中显示录音按钮 */}
          {speechRecognitionSupported && (
            <button
              onClick={toggleRecording}
              disabled={disabled}
              className={`h-11 w-11 flex items-center justify-center rounded-full transition-colors ${
                isRecording 
                  ? 'bg-red-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              } disabled:opacity-50`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={(!message.trim() && files.length === 0) || disabled}
            className="h-11 w-11 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* 语音录制提示 */}
      {speechRecognitionSupported && isRecording && (
        <div className="mt-2 text-center text-sm text-red-500">
          {t('chat.recording')}
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
});

// 聊天记录侧边栏
const ChatHistorySidebar = React.forwardRef<{
  clearCache: () => void;
}, {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  sessions: any[];
  lastMessages?: Record<string, { content: string; time: string }>;
}>(({ isOpen, onClose, onNewChat, onSelectSession, sessions, lastMessages = {} }, ref) => {
  const { } = useChat();
  const { currentLanguage, t } = useLanguage();

  // 清除缓存数据的方法
  const clearCache = useCallback(() => {
    console.log('Cache cleared for chat history sidebar');
  }, []);

  // 对会话列表进行实时排序
  const sortedSessions = React.useMemo(() => {
    return [...sessions].sort((a, b) => {
      // 时间解析函数
      const parseTime = (timeStr: any): number => {
        try {
          if (!timeStr) return 0;
          if (typeof timeStr === 'number') return timeStr > 1000000000000 ? timeStr : timeStr * 1000;
          if (typeof timeStr === 'string') {
            if (/^\d+$/.test(timeStr)) {
              const n = parseInt(timeStr, 10);
              return n > 1000000000000 ? n : n * 1000;
            }
            // 处理中文时间格式 "2025/7/29 下午12:22"
            const match = timeStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)(\d{1,2}):(\d{2})/);
            if (match) {
              const [, year, month, day, period, hour, minute] = match;
              let hourNum = parseInt(hour);
              if (period === '下午' && hourNum !== 12) {
                hourNum += 12;
              } else if (period === '上午' && hourNum === 12) {
                hourNum = 0;
              }
              const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hourNum, parseInt(minute));
              return date.getTime();
            }
            const d = new Date(timeStr);
            const t = d.getTime();
            return isNaN(t) ? 0 : t;
          }
          return 0;
        } catch {
          return 0;
        }
      };

      // 获取最后消息时间，如果没有则使用创建时间
      const getLastMessageTime = (session: any) => {
        const lastMessageData = lastMessages[session.id.toString()];
        if (lastMessageData?.time) {
          return parseTime(lastMessageData.time);
        } else {
          // 使用会话创建时间
          return parseTime(session.createTime);
        }
      };

      const aTime = getLastMessageTime(a);
      const bTime = getLastMessageTime(b);

      // 倒序排列（最新的在前面）
      return bTime - aTime;
    });
  }, [sessions, lastMessages]);

  // 通过 useImperativeHandle 暴露清除缓存的方法
  React.useImperativeHandle(ref, () => ({
    clearCache
  }), [clearCache]);

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* 侧边栏 */}
      <div className="fixed left-0 top-0 h-full w-[82vw] max-w-sm md:max-w-md bg-white/90 backdrop-blur z-50 shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white/70 backdrop-blur">
          <h2 className="text-lg font-semibold">{t('chat.chatHistory')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-shrink-0">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors shadow"
          >
            <Plus size={20} />
{t('chat.newChat')}
          </button>
        </div>

        {/* 会话列表 - 可滚动区域 */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pb-4">
            {sortedSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {t('chat.noMessages')}
              </div>
            ) : (
              sortedSessions.map((session) => {
                const sessionId = session.id.toString();
                const lastMessageData = lastMessages[sessionId];
                const lastMessageContent = lastMessageData?.content || '';
                const lastMessageTime = lastMessageData?.time;

                // 如果有最后一条消息的时间，使用它；否则使用会话创建时间
                const displayTime = lastMessageTime
                  ? formatMessageTime(lastMessageTime, currentLanguage)
                  : formatMessageTime(session.createTime, currentLanguage);

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      onSelectSession(sessionId);
                      onClose();
                    }}
                    className="p-3 mb-2 bg-white/70 backdrop-blur rounded-lg cursor-pointer hover:bg-white border border-gray-200 transition-colors shadow-sm"
                  >
                    {/* 第一行：标题（左）+ 时间（右） */}
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm text-gray-800 truncate flex-1 mr-2">
                        {session.sessionTitle || t('chat.newChat')}
                      </div>
                      <div className="text-xs text-gray-500 flex-shrink-0">
                        {displayTime || (session.createTime ? t('errors.loadFailed') : '')}
                      </div>
                    </div>
                    {/* 第二行：最后一条消息内容的前20字 */}
                    {lastMessageContent && (
                      <div className="text-xs text-gray-400 mt-1 truncate">
                        {lastMessageContent}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
});

ChatHistorySidebar.displayName = 'ChatHistorySidebar';

// 智能体选择器
const AgentSelector: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent: (agentId: string) => void;
  selectedAgentId?: string;
}> = ({ isOpen, onClose, onSelectAgent, selectedAgentId }) => {
  const { currentLanguage, t } = useLanguage();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 加载分类列表
  const loadCategories = useCallback(async () => {
    try {
      const response = await api.agent.getCategories();
      if (response.code === 200 && response.data) {
        // API返回的数据结构是 { categories: [], total: number }
        const categoriesList = response.data.categories || response.data || [];
        setCategories(Array.isArray(categoriesList) ? categoriesList : []);
      }
    } catch (error) {
      console.error(t('agent.loadingCategories'), error);
      setCategories([]); // 确保错误时设置为空数组
    }
  }, []);

  // 加载智能体列表
  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      console.log('开始加载智能体列表, categoryId:', selectedCategoryId);
      const response = selectedCategoryId 
        ? await api.agent.getByCategory(selectedCategoryId, { pageSize: 100 })
        : await api.agent.getList({ pageSize: 100 });
        
      console.log('智能体列表响应:', response);
      if (response.code === 200 && response.rows) {
        // 处理不同的API响应格式
        const agentList = response.rows || response.data || [];
        console.log('解析的智能体列表:', agentList);
        setAgents(Array.isArray(agentList) ? agentList : []);
      } else {
        console.error('智能体API响应格式错误:', response);
        setAgents([]);
      }
    } catch (error) {
      console.error(t('agent.loadingAgents'), error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId]);

  // 初始化数据
  useEffect(() => {
    if (isOpen) {
      console.log('智能体选择器打开，开始加载数据...');
      loadCategories();
      loadAgents();
    }
  }, [isOpen, loadCategories, loadAgents]);

  // 分类变化时重新加载智能体
  useEffect(() => {
    if (isOpen) {
      loadAgents();
    }
  }, [selectedCategoryId, isOpen, loadAgents]);

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* 右侧滑出面板 */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold">{t('agent.selectAgent')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* 分类筛选 */}
        <div className="px-4 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-4 py-2 rounded-full text-sm transition-all duration-200 font-medium active:scale-95 ${
                selectedCategoryId === null
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
              }`}
            >
{t('agent.allCategories')}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategoryId(category.id)}
                className={`px-4 py-2 rounded-full text-sm transition-all duration-200 font-medium active:scale-95 ${
                  selectedCategoryId === category.id
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* 智能体列表 - 可滚动区域 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* 默认选项 */}
            <div
              onClick={() => {
                onSelectAgent('');
                onClose();
              }}
              className={`p-4 mb-3 rounded-xl cursor-pointer border transition-all duration-200 active:scale-95 ${
                !selectedAgentId 
                  ? 'border-blue-500 bg-blue-50 shadow-lg' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot size={24} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-base mb-1">
                    {currentLanguage === 'zh' ? '通用助手' : 'General Assistant'}
                  </div>
                  <div className="text-sm text-gray-600 leading-relaxed mb-2">
                    {currentLanguage === 'zh' ? '默认AI助手，适用于各种对话场景' : 'Default AI assistant for various conversation scenarios'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">
{currentLanguage === 'zh' ? '通用' : 'General'}
                    </span>
                    <span className="text-xs bg-gradient-to-r from-green-100 to-green-200 text-green-700 px-2 py-1 rounded-full font-medium">
✨ {currentLanguage === 'zh' ? '默认' : 'Default'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 加载状态 */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <div className="mt-2 text-sm text-gray-500">{t('loading')}</div>
              </div>
            )}

            {/* 智能体列表 */}
            {!loading && agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => {
                  onSelectAgent(agent.id.toString());
                  onClose();
                }}
                className={`p-4 mb-3 rounded-xl cursor-pointer border transition-all duration-200 active:scale-95 ${
                  selectedAgentId === agent.id.toString()
                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden shadow-sm">
                    {agent.avatar ? (
                      agent.avatar.startsWith('/profile/') ? (
                        <img 
                          src={`${config.apiBaseUrl}${agent.avatar}`} 
                          alt={agent.name}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            const fallback = img.nextElementSibling as HTMLElement;
                            img.style.display = 'none';
                            fallback.style.display = 'block';
                          }}
                        />
                      ) : (
                        <img 
                          src={agent.avatar}
                          alt={agent.name}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            const fallback = img.nextElementSibling as HTMLElement;
                            img.style.display = 'none';
                            fallback.style.display = 'block';
                          }}
                        />
                      )
                    ) : (
                      <span className="text-xl">{agent.avatar || '🤖'}</span>
                    )}
                    <span className="text-xl hidden">🤖</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate text-base mb-1">{agent.name}</div>
                    <div 
                      className="text-sm text-gray-600 leading-relaxed mb-2"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {agent.description}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">
{categories.find(cat => cat.id === agent.categoryId)?.name || t('agent.uncategorized')}
                      </span>
                      {agent.isFeatured === 1 && (
                        <span className="text-xs bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 px-2 py-1 rounded-full font-medium">
⭐ {t('agent.featured')}
                        </span>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          💬 {agent.usageCount || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          👍 {agent.likeCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {!loading && agents.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {selectedCategoryId ? 
                  (currentLanguage === 'zh' ? '该分类下暂无智能体' : 'No agents in this category') : 
                  t('agent.noAgents')
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// 移动端聊天页面内容组件
const MobileChatPageContent: React.FC = () => {
  const { id: sessionId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, dispatch, setCurrentSession, addMessage } = useChat();
  const { currentLanguage, t } = useLanguage();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const fetchingHistoryRef = useRef<Record<string, boolean>>({});
  const chatHistorySidebarRef = useRef<any>(null);
  
  // 生成基于机器特征的唯一用户ID（数字类型）- 持久稳定
  const generateMachineUserId = () => getPersistentMachineUserId();
  
  // 判断是否为机器码用户
  const isMachineUser = (id: number) => {
    return id.toString().startsWith('99') && id.toString().length === 18;
  };

  const userId = (() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      const parsedId = parseInt(storedUserId);
      if (!isNaN(parsedId)) {
        console.log('Using stored userId:', parsedId, 'isMachine:', isMachineUser(parsedId));
        return parsedId;
      }
    }
    const machineId = generateMachineUserId();
    console.log('Generated machine userId:', machineId, 'isMachine:', isMachineUser(machineId));
    return machineId;
  })();
  const token = localStorage.getItem('token');
  
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [initialQuestions, setInitialQuestions] = useState<string[]>([]);
  const [isDevMode, setIsDevMode] = useState<boolean>(false);

  // 会话列表状态
  const [sessions, setSessions] = useState<any[]>([]);

  // 最后消息缓存，用于侧边栏实时更新
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; time: string }>>({});


  // 检测语音识别支持情况
  const speechRecognitionSupported = shouldShowSpeechRecognition();

  // 滑动相关状态
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // 滚动控制状态
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // 缓存相关状态
  const isDataLoadedRef = useRef(false);
  const cachedSessionsRef = useRef<any[]>([]);
  const cachedLastMessagesRef = useRef<Record<string, { content: string; time: string }>>({});

  // 统一的时间解析函数，便于排序与展示
  const parseTimeToTimestamp = useCallback((timeStr: any): number => {
    try {
      if (!timeStr) return 0;
      if (typeof timeStr === 'number') return timeStr > 1000000000000 ? timeStr : timeStr * 1000;
      if (typeof timeStr === 'string') {
        if (/^\d+$/.test(timeStr)) {
          const n = parseInt(timeStr, 10);
          return n > 1000000000000 ? n : n * 1000;
        }
        const cn = parseChinaTimeString(timeStr);
        if (cn) return cn.getTime();
        const d = new Date(timeStr);
        const t = d.getTime();
        return isNaN(t) ? 0 : t;
      }
      return 0;
    } catch {
      return 0;
    }
  }, []);

  // 更新最后消息的工具函数（会同时更新缓存与会话排序）
  const updateLastMessageState = useCallback((sessionId: string, content: string, time?: string) => {
    const trimmed = (content || '').trim();
    const truncatedContent = trimmed.length > 20 ? `${trimmed.substring(0, 20)}...` : trimmed;
    const messageTime = time || new Date().toISOString();
    const sessionKey = sessionId.toString();

    setLastMessages(prev => {
      const updated = { ...prev, [sessionKey]: { content: truncatedContent, time: messageTime } };
      cachedLastMessagesRef.current = updated;
      return updated;
    });

    // 同步更新 sessions 的排序与缓存，使侧边栏立即反映最新消息
    setSessions(prev => {
      const updatedSessions = prev.length > 0
        ? prev.map(s => s.id.toString() === sessionKey ? { ...s } : s)
        : prev;

      const sorted = [...updatedSessions].sort((a, b) => {
        const aKey = a.id?.toString?.() ?? a.id;
        const bKey = b.id?.toString?.() ?? b.id;
        const aTime = parseTimeToTimestamp(cachedLastMessagesRef.current[aKey]?.time || a.createTime);
        const bTime = parseTimeToTimestamp(cachedLastMessagesRef.current[bKey]?.time || b.createTime);
        return bTime - aTime;
      });

      cachedSessionsRef.current = sorted;
      return sorted;
    });
  }, [parseTimeToTimestamp]);

  // 新建会话后将其插入会话列表（在本地立即可见，无需等待列表 API）
  const upsertSessionLocally = useCallback((sessionId: string, title: string, createTime?: string) => {
    const normalizedId = sessionId.toString();
    const sessionTitle = title || (currentLanguage === 'zh' ? '新的对话' : 'New Chat');
    const ct = createTime || new Date().toISOString();

    setSessions(prev => {
      const filtered = prev.filter(s => s.id.toString() !== normalizedId);
      const next = [{ id: normalizedId, sessionTitle, createTime: ct }, ...filtered];
      cachedSessionsRef.current = next;
      return next;
    });
  }, [currentLanguage]);

  // 加载会话列表和最后消息
  const loadSessions = useCallback(async (forceRefresh = false) => {
    if (!userId) return;

    // 若未强制刷新且已有缓存，直接使用缓存
    if (!forceRefresh && isDataLoadedRef.current && cachedSessionsRef.current.length > 0) {
      console.log('Using cached session data');
      setSessions(cachedSessionsRef.current);
      setLastMessages(cachedLastMessagesRef.current);
      return;
    }

    try {
      // 根据登录状态选择不同的接口
      const isLoggedIn = !!localStorage.getItem('token');
      console.log(`Loading session list for userId: ${userId}, using ${isLoggedIn ? 'System API' : 'Web API'}`);

      const response = !isLoggedIn
        ? await chatApi.getWebSessionList(userId.toString())
        : await chatApi.getSessionList(userId.toString());

      console.log('Session list response:', response);

      // 401 未认证，跳过不处理
      if (response && response.code === 401) {
        console.log('401 unauthorized, skipping session load');
        return;
      }

      if (response.code === 200 && response.rows) {
        const rows = Array.isArray(response.rows) ? response.rows : [];
        // 统一时间戳，按最新在上排序
        const getTs = (it: any): number => {
          const ct: any = it?.createTime;
          try {
            if (!ct) return 0;
            if (typeof ct === 'number') return ct > 1000000000000 ? ct : ct * 1000;
            if (typeof ct === 'string') {
              if (/^\d+$/.test(ct)) {
                const n = parseInt(ct, 10);
                return n > 1000000000000 ? n : n * 1000;
              }
              const cn = parseChinaTimeString(ct);
              if (cn) return cn.getTime();
              const d = new Date(ct);
              const t = d.getTime();
              return isNaN(t) ? 0 : t;
            }
            return 0;
          } catch {
            return 0;
          }
        };
        // 先按创建时间排序作为初始排序
        const initialSorted = [...rows].sort((a, b) => getTs(b) - getTs(a));
        console.log(`Loaded ${initialSorted.length} sessions`);

        // 为每个会话获取最后一条消息内容
        const lastMessagePromises = initialSorted.map(async (session) => {
          try {
            const isLoggedIn = !!localStorage.getItem('token');
            const response = !isLoggedIn
              ? await chatApi.getWebChatList({ sessionId: session.id.toString(), userId: userId.toString() })
              : await chatApi.getChatList({ sessionId: session.id.toString(), userId: userId.toString() });

            if (response.code === 200 && response.rows && response.rows.length > 0) {
              // 获取最后一条消息（最新的一条）
              const lastMessage = response.rows[response.rows.length - 1];
              const content = lastMessage.content || '';
              const time = lastMessage.createTime || '';
              // 截取前20个字符
              const truncatedContent = content.length > 20 ? content.substring(0, 20) + '...' : content;
              return { sessionId: session.id.toString(), content: truncatedContent, time };
            }
            return { sessionId: session.id.toString(), content: '', time: '' };
          } catch (error) {
            console.error(`Failed to load last message for session ${session.id}:`, error);
            return { sessionId: session.id.toString(), content: '', time: '' };
          }
        });

        try {
          const results = await Promise.all(lastMessagePromises);
          const lastMessagesMap: Record<string, { content: string; time: string }> = {};
          results.forEach(({ sessionId, content, time }) => {
            lastMessagesMap[sessionId] = { content, time };
          });
          // 设置状态
          setLastMessages(lastMessagesMap);
          cachedLastMessagesRef.current = lastMessagesMap;

          // 时间解析函数
          const parseTime = (timeStr: any): number => {
            try {
              if (!timeStr) return 0;
              if (typeof timeStr === 'number') return timeStr > 1000000000000 ? timeStr : timeStr * 1000;
              if (typeof timeStr === 'string') {
                if (/^\d+$/.test(timeStr)) {
                  const n = parseInt(timeStr, 10);
                  return n > 1000000000000 ? n : n * 1000;
                }
                const cn = parseChinaTimeString(timeStr);
                if (cn) return cn.getTime();
                const d = new Date(timeStr);
                const t = d.getTime();
                return isNaN(t) ? 0 : t;
              }
              return 0;
            } catch {
              return 0;
            }
          };

          // 根据最后消息时间重新排序会话列表
          const sortedByLastMessage = [...initialSorted].sort((a, b) => {
            // 获取最后消息时间，如果没有则使用创建时间
            const getLastMessageTime = (session: any) => {
              const lastMessageData = lastMessagesMap[session.id.toString()];
              if (lastMessageData?.time) {
                return parseTime(lastMessageData.time);
              } else {
                // 使用会话创建时间
                return parseTime(session.createTime);
              }
            };

            const aTime = getLastMessageTime(a);
            const bTime = getLastMessageTime(b);

            // 倒序排列（最新的在前面）
            return bTime - aTime;
          });

          setSessions(sortedByLastMessage);
          console.log('Sessions sorted by last message time');

          // 数据加载完成，更新缓存
          isDataLoadedRef.current = true;
          cachedSessionsRef.current = sortedByLastMessage;
          cachedLastMessagesRef.current = lastMessagesMap;
          console.log('Session data cached for future use');
        } catch (error) {
          console.error('Failed to load last messages:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [userId]);

  // 强制刷新会话列表与缓存
  const refreshSessions = useCallback(() => {
    isDataLoadedRef.current = false;
    cachedSessionsRef.current = [];
    cachedLastMessagesRef.current = {};
    loadSessions(true);
  }, [loadSessions]);

  // 初始化加载数据
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 打开侧边栏时强制刷新会话列表与最后消息
  useEffect(() => {
    if (showChatHistory) {
      refreshSessions();
    }
  }, [showChatHistory, refreshSessions]);

  // 加载智能体详情
  const loadAgentDetail = useCallback(async (agentId: string) => {
    if (!agentId) {
      setSelectedAgent(null);
      return;
    }
    
    try {
      const response = await api.agent.getDetail(agentId);
      if (response.code === 200 && response.data) {
        setSelectedAgent(response.data);
        const qs: string | undefined = response.data.questions;
        if (qs && typeof qs === 'string') {
          const items = qs.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);
          setInitialQuestions(items);
        } else {
          setInitialQuestions([]);
        }
      }
    } catch (error) {
      console.error('加载智能体详情失败:', error);
    }
  }, []);

  // 初始化智能体选择和开发模式检测
  useEffect(() => {
    const agentId = searchParams.get('agent');
    if (agentId) {
      setSelectedAgentId(agentId);
      loadAgentDetail(agentId);
    } else {
      setSelectedAgentId('');
      setSelectedAgent(null);
    }

    // 检测开发模式参数
    const devMode = searchParams.get('devMode');
    setIsDevMode(devMode === 'true' || devMode === '1');
  }, [searchParams, loadAgentDetail]);

  // 无需检查登录状态 - 支持游客模式
  // useEffect(() => {
  //   if (!token || !userId) {
  //     navigate('/login');
  //     return;
  //   }
  // }, [token, userId, navigate]);

  // 加载模型列表
  const loadModels = useCallback(async () => {
    try {
      const response = await modelApi.getModelList();
      if (response.code === 200 && response.data) {
        setModels(response.data);
        if (!selectedModel && response.data.length > 0) {
          setSelectedModel(response.data[0].id);
        }
      }
    } catch (error) {
      console.error('加载模型列表失败:', error);
    }
  }, [selectedModel]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // 滚动到底部 - 只有当用户没有向上滚动时才执行
  const scrollToBottom = (force = false) => {
    if (force || !userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  };

  // 监听滚动事件，检测用户是否向上滚动
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const maxScrollTop = container.scrollHeight - container.clientHeight;

    // 如果用户滚动位置距离底部超过100px，认为用户在查看历史消息
    const isNearBottom = maxScrollTop - currentScrollTop < 100;
    const newUserScrolledUp = !isNearBottom;

    if (newUserScrolledUp !== userScrolledUp) {
      setUserScrolledUp(newUserScrolledUp);
    }


    // 如果用户滚动到底部附近，重置用户滚动状态
    if (isNearBottom && userScrolledUp) {
      setUserScrolledUp(false);
    }

    // 清除之前的定时器
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // 设置定时器，在用户停止滚动一段时间后检查是否需要重置状态
    scrollTimeoutRef.current = setTimeout(() => {
      if (container) {
        const currentScrollTop = container.scrollTop;
        const maxScrollTop = container.scrollHeight - container.clientHeight;
        const isNearBottom = maxScrollTop - currentScrollTop < 100;

        // 如果停止滚动后仍在底部附近，重置用户滚动状态
        if (isNearBottom) {
          setUserScrolledUp(false);
        }
      }
    }, 150);
  }, [userScrolledUp]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [handleScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [state.chatMap]);

  // 加载聊天历史 - 统一从服务器加载（含防重复与未登录非法会话保护）
  const loadChatHistory = useCallback(async (sessionId: string) => {
    if (!userId) return;
    if (fetchingHistoryRef.current[sessionId]) return; // 正在请求中
    
    // 如果已经加载过这个会话的聊天记录，就不重复加载
    if (state.chatMap[sessionId] && state.chatMap[sessionId].length > 0) return;

    try {
      fetchingHistoryRef.current[sessionId] = true;
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // 根据登录状态选择不同的接口
      const isLoggedIn = !!localStorage.getItem('token');
      console.log(`Loading chat history for sessionId: ${sessionId}, userId: ${userId}, using ${isLoggedIn ? 'System API' : 'Web API'}`);
      
      const response = !isLoggedIn
        ? await chatApi.getWebChatList({ sessionId, userId: userId.toString() })
        : await chatApi.getChatList({ sessionId, userId: userId.toString() });
      
      // 未登录直接访问系统会话的情况：接口可能返回401或空数据，直接跳转新对话，避免重复请求
      if (!isLoggedIn && (!response || response.code === 401 || (response.code === 200 && (!response.rows || response.rows.length === 0)))) {
        console.warn('Anonymous user cannot access this session. Redirect to new chat.');
        navigate('/mobile-chat');
        return;
      }

      if (response.code === 200 && response.rows) {
        const messages = response.rows.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          sessionId: msg.sessionId,
          userId: msg.userId,
          createTime: msg.createTime,
          modelName: msg.modelName,
          deductCost: msg.deductCost,
          totalTokens: msg.totalTokens,
          remark: msg.remark
        }));
        
        dispatch({ 
          type: 'SET_CHAT_MAP', 
          payload: { sessionId, messages } 
        });

        // 用最新一条消息刷新侧边栏的显示与排序
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          updateLastMessageState(
            sessionId,
            lastMsg.content || '',
            lastMsg.createTime || new Date().toISOString()
          );
        }
        
        setTimeout(() => {
          scrollToBottom(true); // 加载聊天历史后强制滚动到底部
        }, 100);
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      toast.error('加载聊天历史失败');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      fetchingHistoryRef.current[sessionId] = false;
    }
  }, [userId, state.chatMap, dispatch]);

  // 移除本地会话加载逻辑，统一使用服务器接口

  // 设置当前会话
  useEffect(() => {
    if (sessionId) {
      setCurrentSession(sessionId);
      loadChatHistory(sessionId);
    }
  }, [sessionId, userId, token, loadChatHistory]);

  // 当切换对话时，强制滚动到底部
  useEffect(() => {
    if (sessionId) {
      // 延迟一点时间，确保DOM更新完成
      const timer = setTimeout(() => {
        scrollToBottom(true); // 切换对话时强制滚动到底部
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  // 发送消息 - 支持游客模式
  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!content.trim() && (!files || files.length === 0)) {
      return;
    }

    // 本地聚合AI增量内容（避免状态异步导致取不到完整文本）
    let aggregatedContent = '';

    const currentUserId = (() => {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        const parsedId = parseInt(storedUserId);
        if (!isNaN(parsedId)) {
          console.log('Using stored currentUserId:', parsedId, 'isMachine:', isMachineUser(parsedId));
          return parsedId;
        }
      }
      const machineId = generateMachineUserId();
      console.log('Generated current machine userId:', machineId, 'isMachine:', isMachineUser(machineId));
      return machineId;
    })();

    let currentSessionId = sessionId;

    // 如果没有sessionId，创建新会话
    if (!sessionId) {
      // 登录状态使用 /system/session；未登录使用 /web/session
      try {
        const isLoggedIn = !!localStorage.getItem('token');
        const payload = {
          userId: currentUserId.toString(),
          sessionContent: content,
          sessionTitle: content.slice(0, 20),
          remark: content.slice(0, 20)
        };
        const sessionResponse = isLoggedIn
          ? await chatApi.createSession(payload)
          : await chatApi.createWebSession(payload);

        if (sessionResponse.code === 200 && sessionResponse.data) {
          currentSessionId = sessionResponse.data.toString();
          navigate(`/mobile-chat/${currentSessionId}${selectedAgentId ? `?agent=${selectedAgentId}` : ''}`);
          setCurrentSession(currentSessionId!);
          // 本地先插入新会话，确保侧边栏立即可见
          upsertSessionLocally(currentSessionId!, payload.sessionTitle, new Date().toISOString());
        } else {
          toast.error('创建会话失败');
          return;
        }
      } catch (error) {
        console.error('创建会话失败:', error);
        toast.error('创建会话失败');
        return;
      }
    }

    // 生成消息ID
    const timestamp = Date.now();
    const userMessageId = timestamp.toString();
    const aiMessageId = (timestamp + 1).toString();
    
    // 创建用户消息
    const userMessage: ChatMessageVo = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      sessionId: currentSessionId!,
      userId: currentUserId.toString(),
      createTime: new Date().toISOString(),
      files: files && files.length > 0 ? files.map(file => ({
        uid: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file)
      })) : undefined
    };

    addMessage(currentSessionId!, userMessage);
    // 立即更新侧边栏的最后一条消息（先展示用户消息）
    updateLastMessageState(currentSessionId!, userMessage.content, userMessage.createTime);

    // 创建AI消息
    const aiMessage: ChatMessageVo = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      sessionId: currentSessionId!,
      userId: currentUserId.toString(),
      createTime: new Date().toISOString()
    };
    
    addMessage(currentSessionId!, aiMessage);
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      console.log('About to send message with userId:', currentUserId, 'type:', typeof currentUserId);
      
      if (!currentUserId || isNaN(currentUserId)) {
        console.error('Invalid userId:', currentUserId);
        toast.error('用户ID无效，请刷新页面重试');
        return;
      }
      
      const selectedModelInfo = models.find(model => model.id === selectedModel);
      const modelName = selectedModelInfo?.modelName;

      const currentMessages = state.chatMap[currentSessionId!] || [];
      const historyMessages = currentMessages
        .filter((msg: ChatMessageVo) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-10)
        .map((msg: ChatMessageVo) => ({
          role: msg.role,
          content: msg.content
        }));

      const messageContent = content.trim();

      // 根据是否有文件选择不同的发送方式
      if (files && files.length > 0) {
        await streamChatSendWithFiles(
          {
            messages: [...historyMessages, { role: 'user', content: messageContent }],
            sessionId: currentSessionId!,
            userId: currentUserId,
            stream: true,
            model: modelName || undefined,
            agent: selectedAgentId || undefined,
            appId: 'mcpx-chat'
          },
          files,
          (chunk: any) => {
            const deltaContent = chunk.choices?.[0]?.delta?.content;
            if (deltaContent) {
              aggregatedContent += deltaContent;
              dispatch({
                type: 'UPDATE_MESSAGE_CONTENT',
                payload: {
                  sessionId: currentSessionId!,
                  messageId: aiMessageId,
                  deltaContent: deltaContent
                }
              });
            }
          },
          (error: any) => {
            console.error('流式请求错误:', error);
            toast.error('发送消息失败');
          },
          () => {
            console.log('流式响应完成');

            // 实时更新当前会话的最后消息数据，用于侧边栏显示
            const finalMessage = state.chatMap[currentSessionId!]?.find(msg => msg.id === aiMessageId);
            const lastMessageContent = (aggregatedContent && aggregatedContent.trim()) || finalMessage?.content || '';
            const lastMessageTime = finalMessage?.createTime || new Date().toISOString();
            updateLastMessageState(currentSessionId!, lastMessageContent, lastMessageTime);
          }
        );
      } else {
        await streamChatSend(
          {
            messages: [...historyMessages, { role: 'user', content: messageContent }],
            sessionId: currentSessionId!,
            userId: currentUserId,
            stream: true,
            model: modelName || undefined,
            agent: selectedAgentId || undefined,
            appId:"mcpx-chat"
          },
          (chunk: any) => {
            const deltaContent = chunk.choices?.[0]?.delta?.content;
            if (deltaContent) {
              aggregatedContent += deltaContent;
              dispatch({
                type: 'UPDATE_MESSAGE_CONTENT',
                payload: {
                  sessionId: currentSessionId!,
                  messageId: aiMessageId,
                  deltaContent: deltaContent
                }
              });
            }
          },
          (error: any) => {
            console.error('流式请求错误:', error);
            toast.error('发送消息失败');
          },
          () => {
            console.log('流式响应完成');

            // 实时更新当前会话的最后消息数据，用于侧边栏显示
            const finalMessage = state.chatMap[currentSessionId!]?.find(msg => msg.id === aiMessageId);
            const lastMessageContent = (aggregatedContent && aggregatedContent.trim()) || finalMessage?.content || '';
            const lastMessageTime = finalMessage?.createTime || new Date().toISOString();
            updateLastMessageState(currentSessionId!, lastMessageContent, lastMessageTime);
          }
        );
      }

      if (!sessionId && currentSessionId) {
        setCurrentSession(currentSessionId);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      toast.error('发送消息失败');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 新建对话：立即创建会话并跳转对应ID（未登录走 /web/session，已登录走 /system/session）
  const handleNewChat = async () => {
    try {
      const isLoggedIn = !!localStorage.getItem('token');
      const title = currentLanguage === 'zh' ? '新的对话' : 'New Chat';
      const payload = {
        userId: userId.toString(),
        sessionContent: title,
        sessionTitle: title,
        remark: title,
      };
      const resp = isLoggedIn
        ? await chatApi.createSession(payload)
        : await chatApi.createWebSession(payload);
      if (resp && resp.code === 200 && resp.data) {
        const newId = resp.data.toString();
        setCurrentSession(newId);
      // 新建会话后立即更新本地会话列表，侧边栏实时显示
      upsertSessionLocally(newId, title, new Date().toISOString());
        // 创建新对话后清除缓存，确保下次打开侧边栏时重新加载数据
        if (chatHistorySidebarRef.current?.clearCache) {
          chatHistorySidebarRef.current.clearCache();
        }
        navigate(`/mobile-chat/${newId}${selectedAgentId ? `?agent=${selectedAgentId}` : ''}`);
      } else {
        navigate('/mobile-chat');
      }
    } catch (e) {
      console.error('新建会话失败:', e);
      navigate('/mobile-chat');
    } finally {
      setShowChatHistory(false);
    }
  };

  // 选择会话
  const handleSelectSession = (sessionId: string) => {
    navigate(`/mobile-chat/${sessionId}${selectedAgentId ? `?agent=${selectedAgentId}` : ''}`);
  };

  // 选择智能体
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    const newSearchParams = new URLSearchParams(searchParams);
    if (agentId) {
      newSearchParams.set('agent', agentId);
      loadAgentDetail(agentId);
    } else {
      newSearchParams.delete('agent');
      setSelectedAgent(null);
    }
    setSearchParams(newSearchParams);
  };

  // 滑动手势处理
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // 左滑打开智能体选择器
      setShowAgentSelector(true);
    } else if (isRightSwipe) {
      // 右滑打开聊天记录
      setShowChatHistory(true);
    }
  };

  const currentSessionId = sessionId || state.currentSessionId;
  const currentMessages = currentSessionId ? state.chatMap[currentSessionId] || [] : [];

  return (
    <div 
      className="flex flex-col h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/70 backdrop-blur shadow-sm">
        <button
          onClick={() => setShowChatHistory(true)}
          className="p-2 text-gray-600 hover:text-gray-800"
          title={currentLanguage === 'zh' ? '聊天记录（或右滑屏幕）' : 'Chat History (or swipe right)'}
        >
          <Menu size={24} />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            {selectedAgent ? (
              <>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedAgent.avatar ? (
                    selectedAgent.avatar.startsWith('/profile/') ? (
                      <img
                        src={`${config.apiBaseUrl}${selectedAgent.avatar}`}
                        alt={selectedAgent.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const fallback = img.nextElementSibling as HTMLElement;
                          img.style.display = 'none';
                          fallback.style.display = 'block';
                        }}
                      />
                    ) : (
                      <img
                        src={selectedAgent.avatar}
                        alt={selectedAgent.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          const fallback = img.nextElementSibling as HTMLElement;
                          img.style.display = 'none';
                          fallback.style.display = 'block';
                        }}
                      />
                    )
                  ) : (
                    <span className="text-sm">{selectedAgent.avatar || '🤖'}</span>
                  )}
                  <span className="text-sm hidden">🤖</span>
                </div>
                <span className="font-medium text-gray-800 truncate">{selectedAgent.name}</span>
              </>
            ) : (
              <span className="font-medium text-gray-800">{currentLanguage === 'zh' ? 'AI助手' : 'AI Assistant'}</span>
            )}
          </div>
          <div className="text-xs text-gray-500">内容由AI生成</div>
        </div>

        <div className="flex items-center gap-1">
          {/* <LanguageToggle /> */}
          {/* 智能体选择按钮 - 开发模式下显示，否则隐藏但占位置 */}
          <button
            onClick={() => isDevMode && setShowAgentSelector(true)}
            className={`p-2 rounded-full bg-white/60 backdrop-blur border border-gray-200 shadow-sm transition-all ${
              isDevMode
                ? 'text-gray-600 hover:text-gray-800 visible cursor-pointer'
                : 'invisible cursor-default'
            }`}
            title={isDevMode ? (currentLanguage === 'zh' ? '选择智能体（或左滑屏幕）' : 'Select Agent (or swipe left)') : ''}
            disabled={!isDevMode}
          >
            <Bot size={24} />
          </button>
        </div>
      </div>

      {/* 聊天消息区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-white/40 to-blue-50/30" ref={messagesContainerRef}>
        {currentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center overflow-hidden mb-4 shadow-sm border border-blue-100">
              {selectedAgent && selectedAgent.avatar ? (
                selectedAgent.avatar.startsWith('/profile/') ? (
                  <img 
                    src={`${config.apiBaseUrl}${selectedAgent.avatar}`} 
                    alt={selectedAgent.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fallback = img.nextElementSibling as HTMLElement;
                      img.style.display = 'none';
                      fallback.style.display = 'block';
                    }}
                  />
                ) : (
                  <img 
                    src={selectedAgent.avatar}
                    alt={selectedAgent.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fallback = img.nextElementSibling as HTMLElement;
                      img.style.display = 'none';
                      fallback.style.display = 'block';
                    }}
                  />
                )
              ) : (
                <span className="text-4xl">{selectedAgent?.avatar || '💬'}</span>
              )}
              <span className="text-4xl hidden">💬</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
{selectedAgent ? selectedAgent.name : (currentLanguage === 'zh' ? '开始对话' : 'Start Conversation')}
            </h2>
            <p className="text-gray-500 mb-4 px-4">
{selectedAgent ? selectedAgent.description : (currentLanguage === 'zh' ? '与AI助手开始对话吧' : 'Start chatting with AI assistant')}
            </p>
            
            {/* 微信浏览器特殊提示 */}
            {/* {isWeChatBrowser() && (
              <div className="w-full max-w-md mx-auto px-4 mb-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span>⚠️</span>
                    <span className="font-medium">
                      {currentLanguage === 'zh' ? '微信浏览器提示' : 'WeChat Browser Notice'}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {currentLanguage === 'zh' 
                      ? '当前在微信浏览器中，语音识别功能不可用。建议使用文字输入或在其他浏览器中打开。'
                      : 'Voice recognition is not available in WeChat browser. Please use text input or open in other browsers.'
                    }
                  </p>
                </div>
              </div>
            )} */}
            
            {initialQuestions.length > 0 && (
              <div className="w-full max-w-md mx-auto px-4 mb-4">
                <div className="grid grid-cols-1 gap-2">
                  {initialQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      className="text-left px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition text-sm text-gray-700"
                      onClick={() => {
                        inputRef.current?.setMessage(q);
                        inputRef.current?.focus();
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 开发环境下显示浏览器环境信息 */}
            {process.env.NODE_ENV === 'development' && (
              <div className="w-full max-w-md mx-auto px-4 mb-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                  <div className="font-medium mb-1">浏览器环境信息（开发模式）:</div>
                  <div className="space-y-1">
                    <div>User Agent: {navigator.userAgent}</div>
                    <div>环境检测: {getBrowserEnvironmentInfo()}</div>
                    <div>语音识别支持: {speechRecognitionSupported ? '✅ 是' : '❌ 否'}</div>
                    <div>开发模式: {isDevMode ? '✅ 开启' : '❌ 关闭'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {currentMessages.map((message) => (
              <MobileChatMessage
                key={message.id}
                message={message}
                isTyping={state.loading && message.role === 'assistant' && !message.content.trim()}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 聊天输入区域 */}
      <MobileChatInput
        onSend={handleSendMessage}
        disabled={state.loading}
        placeholder={state.loading ?
          (currentLanguage === 'zh' ? "AI正在思考中..." : "AI is thinking...") :
          t('chat.typingPlaceholder')
        }
        ref={inputRef}
      />

      {/* 聊天记录侧边栏 */}
      <ChatHistorySidebar
        ref={chatHistorySidebarRef}
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        sessions={sessions}
        lastMessages={lastMessages}
      />

      {/* 智能体选择器 - 只有在开发模式下才显示 */}
      {isDevMode && (
        <AgentSelector
          isOpen={showAgentSelector}
          onClose={() => setShowAgentSelector(false)}
          onSelectAgent={handleSelectAgent}
          selectedAgentId={selectedAgentId}
        />
      )}
    </div>
  );
};

// 移动端聊天页面主组件
export const MobileChatPage: React.FC = () => {
  return (
    <ChatProvider>
      <FilesProvider>
        <MobileChatPageContent />
      </FilesProvider>
    </ChatProvider>
  );
};
