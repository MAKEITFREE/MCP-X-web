import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { CodePreview } from '../components/app/CodePreview';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown-light.css';
import { 
  getAppInfo, 
  chatToGenCode, 
  getChatHistory, 
  deployApp, 
  downloadAppCode,
  getStaticPreviewUrl,
  formatCodeGenType,
  type AppInfo,
  type ChatMessage as ChatMessageType
} from '../services/appBuildApi';
import { toast } from '../utils/toast';
import { 
  Send, 
  Cloud, 
  X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Logo } from '../components/ui/Logo';
import { DinoGame } from '../components/ui/DinoGame';
import { TankBattle } from '../components/ui/TankBattle';

// 可折叠代码块组件（用于聊天消息中的 Markdown 代码块），支持持久展开
const CollapsibleCode: React.FC<{ className?: string; children: React.ReactNode; persistKey?: string; openStore?: React.MutableRefObject<Map<string, boolean>> }> = ({ className, children, persistKey, openStore }) => {
  const content = String(children || '');
  const firstLine = content.split('\n')[0] || '';
  const initialOpen = persistKey && openStore ? (openStore.current.get(persistKey) ?? false) : false;
  const [open, setOpen] = useState(initialOpen);

  // 若存储中记录为展开（例如流式追加内容后重渲染），保持展开
  useEffect(() => {
    if (persistKey && openStore && openStore.current.get(persistKey)) {
      setOpen(true);
    }
  }, [persistKey, openStore, content]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (persistKey && openStore) {
      openStore.current.set(persistKey, next);
    }
  };

  return (
    <div className="border border-slate-200 rounded-md mb-3">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-2 py-1 text-xs flex items-center justify-between bg-slate-100 hover:bg-slate-200 rounded-t-md"
      >
        <span className="text-slate-700">{open ? '收起代码' : '展开代码'}</span>
        <span className="ml-2 text-slate-500 font-mono truncate max-w-[60%]">{firstLine}</span>
      </button>
      {open && (
        <pre className="max-h-80 overflow-auto overflow-x-auto p-2 bg-white rounded-b-md w-full max-w-full">
          <code className={`${className || ''} whitespace-pre-wrap break-words`}>{content}</code>
        </pre>
      )}
    </div>
  );
};

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  selector: string;
  pagePath?: string;
}

export const AppBuildPage: React.FC = () => {
  const { id: appId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  
  // 应用状态
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  // 网页预览自动刷新计数（每三分钟+1，驱动预览URL变更从而刷新）
  const [previewRefreshTick, setPreviewRefreshTick] = useState(0);
  
  // 部署状态
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState('');
  const [showDeployModal, setShowDeployModal] = useState(false);
  
  // 下载状态（暂不使用，但保留逻辑可随时恢复）
  // const [downloading, setDownloading] = useState(false);
  
  // 编辑模式状态
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedElementInfo, setSelectedElementInfo] = useState<ElementInfo | null>(null);
  
  // 聊天历史
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [lastCreateTime, setLastCreateTime] = useState<string>();
  
  // 权限
  const [isOwner, setIsOwner] = useState(true);
  
  // 是否已经自动发送过初始提示词
  const [hasAutoSent, setHasAutoSent] = useState(false);
  
  // 避免闭包读取到过期的自动发送标记
  const autoSentRef = useRef(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  // 代码折叠状态持久存储（会话级）
  const codeOpenMapRef = useRef<Map<string, boolean>>(new Map());

  // 获取自动发送标记的sessionStorage key
  const getAutoSentKey = (id?: string) => `app_build_auto_sent_${id || 'unknown'}`;

  // 初始化时根据sessionStorage恢复是否已自动发送
  useEffect(() => {
    if (appId) {
      const stored = sessionStorage.getItem(getAutoSentKey(appId));
      if (stored === '1') {
        setHasAutoSent(true);
        autoSentRef.current = true;
      }
    }
  }, [appId]);

  // 同步ref值，避免闭包问题
  useEffect(() => {
    autoSentRef.current = hasAutoSent;
  }, [hasAutoSent]);

  // 检查登录状态
  useEffect(() => {
    if (!token || !userId) {
      navigate('/login', { state: { from: { pathname: location.pathname } } });
      return;
    }
  }, [token, userId, navigate, location]);

  // 每三分钟自动刷新右侧网页预览（仅在已有预览URL时生效）
  useEffect(() => {
    if (!previewUrl) return;
    const timer = window.setInterval(() => {
      setPreviewRefreshTick((n) => n + 1);
    }, 180000); // 3分钟
    return () => window.clearInterval(timer);
  }, [previewUrl]);

  // 传递给 CodePreview 的实际URL，带上变化参数触发 iframe 刷新
  const effectivePreviewUrl = useMemo(() => {
    if (!previewUrl) return '';
    const sep = previewUrl.includes('?') ? '&' : '?';
    return `${previewUrl}${sep}__r=${previewRefreshTick}`;
  }, [previewUrl, previewRefreshTick]);

  // 生成期间随机选择一个小游戏（在 isGenerating 变为 true 时决定，并在本次期间保持稳定）
  const activeMiniGame = useMemo<null | 'dino' | 'tank'>(() => {
    if (!isGenerating) return null;
    return Math.random() < 0.5 ? 'dino' : 'tank';
  }, [isGenerating]);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 构造多轮对话上下文（最近N条）
  // 将当前会话历史转换为 DeepSeek /chat/completions 所需的 messages 数组
  // const buildConversationMessages = useCallback((maxTurns: number = 8) => {
  //   if (!messages || messages.length === 0) return [] as Array<{ role: 'user' | 'assistant'; content: string }>;
  //   const recent = messages.slice(-maxTurns);
  //   return recent.map((m) => ({
  //     role: (m.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
  //     content: m.content || '',
  //   }));
  // }, [messages]);

  // 加载应用信息
  const loadAppInfo = useCallback(async () => {
    if (!appId) return;
    
    setLoading(true);
    try {
      const response = await getAppInfo(appId);
      if (response.code === 200 && response.data) {
        setAppInfo(response.data);
        setIsOwner(response.data.userId === userId);
        
        // 加载聊天历史（强制一次权威拉取，避免并发早退导致误判为空）
        const chatHistory = await loadChatHistory(false);
        // 如果是第一次访问且没有聊天历史，自动发送初始提示词（仅执行一次）
        if (!autoSentRef.current && Array.isArray(chatHistory) && chatHistory.length === 0 && response.data.initPrompt) {
          autoSentRef.current = true;
          setHasAutoSent(true);
          if (appId) sessionStorage.setItem(getAutoSentKey(appId), '1');
          // 直接触发一次，无需多次节流；确保只执行一次由 initCalledRef 控制
            autoSendInitPrompt(response.data.initPrompt);
        } else if (Array.isArray(chatHistory) && chatHistory.length > 0) {
          // 如果有聊天历史，更新预览
          console.log('有聊天历史，更新预览');
          updatePreview(response.data);
        }
      } else {
        toast.error(currentLanguage === 'zh' ? '获取应用信息失败' : 'Failed to get app info');
        navigate('/');
      }
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '获取应用信息失败:' : 'Failed to get app info:', error);
      toast.error(currentLanguage === 'zh' ? '获取应用信息失败' : 'Failed to get app info');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [appId, userId, navigate, hasAutoSent]);

  // 加载聊天历史
  const loadChatHistory = async (isLoadMore = false) => {
    if (!appId) return [];
    if (loadingHistory && isLoadMore) return [];
    
    setLoadingHistory(true);
    try {
      const params: any = {
        appId,
        pageSize: 10,
      };
      
      if (isLoadMore && lastCreateTime) {
        params.lastCreateTime = lastCreateTime;
      }
      
      const response = await getChatHistory(params);
      if (response.code === 200 && response.data) {
        const chatHistories = response.data.rows || response.data.records || [];
        if (chatHistories.length > 0) {
          const historyMessages: ChatMessageType[] = chatHistories
            .map((chat: any) => ({
              type: (chat.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
              content: chat.content || chat.message || '',
              createTime: chat.createTime,
              id: chat.id,
            }))
            // 升序排列：最老在上，最新在下
            .sort((a: ChatMessageType, b: ChatMessageType) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime());
            
          if (isLoadMore) {
            // 加载更早的历史：追加到现有消息顶部
            setMessages(prev => [...historyMessages, ...prev]);
          } else {
            // 首次加载：直接按时间正序展示（老->新）
            setMessages(historyMessages);
          }
          
          // 记录当前批次中最早的时间，便于继续向更早加载
          setLastCreateTime(historyMessages[0]?.createTime);
          setHasMoreHistory(chatHistories.length === 10);
          
          return historyMessages;
        } else {
          setHasMoreHistory(false);
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      toast.error('加载聊天历史失败');
      return [];
    } finally {
      setLoadingHistory(false);
    }
  };

  // 更新预览
  const updatePreview = (app?: AppInfo) => {
    const currentApp = app || appInfo;
    console.log('updatePreview 被调用', { currentApp, appId });
    if (currentApp && appId) {
      const newPreviewUrl = getStaticPreviewUrl(currentApp.codeGenType, appId);
      console.log('生成预览URL:', newPreviewUrl);
      setPreviewUrl(newPreviewUrl);
    }
  };

  // 自动发送初始提示词
  const autoSendInitPrompt = async (initPrompt: string) => {
    if (!initPrompt.trim() || isGenerating || !appId) return;
    
    // 双重检查：确保当前没有消息且没有正在生成
    if (messages.length > 0 || isGenerating) {
      console.log('已有消息或正在生成，跳过自动发送');
      return;
    }
    
    console.log('自动发送初始提示词:', initPrompt);
    
    // 生成唯一ID，确保不重复
    const timestamp = Date.now();
    const userMessageId = `user-${timestamp}`;
    const aiMessageId = `ai-${timestamp}`;
    
    // 添加用户消息
    const userMessage: ChatMessageType = {
      type: 'user',
      content: initPrompt.trim(),
      id: userMessageId,
    };
    
    // 添加AI消息占位符
    const aiMessage: ChatMessageType = {
      type: 'ai',
      content: '',
      loading: true,
      id: aiMessageId,
    };
    
    // 一次性添加两个消息，避免多次渲染
    setMessages(prev => [...prev, userMessage, aiMessage]);
    
    setIsGenerating(true);
    
    try {
      // 加入上下文模板（首次只有系统提示词，不含历史）
      const contextWrapped = `${initPrompt.trim()}`;
      await generateCode(contextWrapped, 1); // AI消息在第2个位置（索引1）
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '自动发送初始提示词失败:' : 'Auto send init prompt failed:', error);
      toast.error(currentLanguage === 'zh' ? '自动发送初始提示词失败' : 'Auto send init prompt failed');
      setIsGenerating(false);
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating || !appId) return;
    
    let message = userInput.trim();
    // const contextMessages = buildConversationMessages(8);
    
    // 如果有选中的元素，将元素信息添加到提示词
    if (selectedElementInfo) {
      let elementContext = `\n\n选中元素信息：`;
      if (selectedElementInfo.pagePath) {
        elementContext += `\n- 页面路径: ${selectedElementInfo.pagePath}`;
      }
      elementContext += `\n- 标签: ${selectedElementInfo.tagName.toLowerCase()}\n- 选择器: ${selectedElementInfo.selector}`;
      if (selectedElementInfo.textContent) {
        elementContext += `\n- 当前内容: ${selectedElementInfo.textContent.substring(0, 100)}`;
      }
      message += elementContext;
    }
    
    setUserInput('');
    
    // 生成唯一ID，确保不重复
    const timestamp = Date.now();
    const userMessageId = `user-${timestamp}`;
    const aiMessageId = `ai-${timestamp}`;
    
    // 添加用户消息
    const userMessage: ChatMessageType = {
      type: 'user',
      content: message,
      id: userMessageId,
    };
    
    // 添加AI消息占位符
    const aiMessage: ChatMessageType = {
      type: 'ai',
      content: '',
      loading: true,
      id: aiMessageId,
    };
    
    // 一次性添加两个消息，避免多次渲染
    setMessages(prev => [...prev, userMessage, aiMessage]);
    const aiMessageIndex = messages.length + 1;
    
    // 发送消息后清除选中元素并退出编辑模式
    if (selectedElementInfo) {
      clearSelectedElement();
      if (isEditMode) {
        setIsEditMode(false);
      }
    }
    
    setIsGenerating(true);
    
    try {
      await generateCode(message, aiMessageIndex);
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '发送消息失败:' : 'Send message failed:', error);
      toast.error(currentLanguage === 'zh' ? '发送消息失败' : 'Failed to send');
      setIsGenerating(false);
    }
  };

  // 生成代码
  const generateCode = async (
    userMessage: string,
    aiMessageIndex: number,
  ) => {
    if (!appId) return;
    
    let fullContent = '';

    try {
      await chatToGenCode(
        appId,
        userMessage,
        // onChunk
        (chunk: any) => {
          try {
            console.log('🔄 AppBuildPage收到数据块:', chunk);
            
            // 尝试多种方式提取内容
            let deltaContent = '';
            
            if (chunk.choices?.[0]?.delta?.content) {
              deltaContent = chunk.choices[0].delta.content;
            } else if (chunk.d) {
              deltaContent = chunk.d;
            } else if (typeof chunk === 'string') {
              deltaContent = chunk;
            } else if (chunk.content) {
              deltaContent = chunk.content;
            } else {
              console.log('⚠️ 未识别的数据格式:', chunk);
              // 尝试直接转换为字符串
              deltaContent = JSON.stringify(chunk);
            }
            
            if (deltaContent !== undefined && deltaContent !== null && deltaContent !== '') {
              console.log('✅ 提取到内容:', deltaContent);
              fullContent += deltaContent;
              setMessages(prev => 
                prev.map((msg, index) => 
                  index === aiMessageIndex 
                    ? { ...msg, content: fullContent, loading: false }
                    : msg
                )
              );
              scrollToBottom();
            }
          } catch (error) {
            console.error('处理数据块失败:', error);
          }
        },
        // onError
        (error: any) => {
          console.error('应用构建流式请求错误:', error);
          handleError(error, aiMessageIndex);
        },
        // onComplete
        () => {
          console.log('应用构建流式响应完成');
          setIsGenerating(false);
          
          // 延迟更新预览
          setTimeout(() => {
            loadAppInfo();
            updatePreview();
          }, 1000);
        },
        // 传递上下文
        // { messages: contextMessages as any }
      );
    } catch (error) {
      console.error('应用构建生成代码失败:', error);
      handleError(error, aiMessageIndex);
    }
  };

  // 错误处理
  const handleError = (error: unknown, aiMessageIndex: number) => {
    console.error(currentLanguage === 'zh' ? '生成代码失败:' : 'Generate code failed:', error);
    setMessages(prev => 
      prev.map((msg, index) => 
        index === aiMessageIndex 
          ? { ...msg, content: '抱歉，生成过程中出现了错误，请重试。', loading: false }
          : msg
      )
    );
    toast.error(currentLanguage === 'zh' ? '生成失败，请重试' : 'Generation failed, please retry');
    setIsGenerating(false);
  };

  // 部署应用
  const handleDeploy = async () => {
    if (!appId) {
      toast.error(currentLanguage === 'zh' ? '请先生成网站后再部署' : 'Please generate the app before deploying');
      return;
    }
    if (!previewUrl) {
      toast.error(currentLanguage === 'zh' ? '网站尚未生成，无法部署' : 'Site not generated yet, cannot deploy');
      return;
    }
    
    setDeploying(true);
    try {
      const response = await deployApp(appId as string);
      if (response.code === 200 && response.data) {
        setDeployUrl(response.data);
        setShowDeployModal(true);
        toast.success(currentLanguage === 'zh' ? '部署成功' : 'Deployed successfully');
      } else {
        toast.error((currentLanguage === 'zh' ? '部署失败: ' : 'Deploy failed: ') + response.message);
      }
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '部署失败:' : 'Deploy failed:', error);
      toast.error(currentLanguage === 'zh' ? '部署失败，请重试' : 'Deploy failed, please retry');
    } finally {
      setDeploying(false);
    }
  };

  // 下载代码（暂未在头部显示按钮，如需恢复可将按钮解注释）
  const handleDownload = async () => {
    if (!appId) return;
    try {
      const response = await downloadAppCode(appId);
      const contentDisposition = response.headers['content-disposition'];
      const fileName = contentDisposition?.match(/filename=\"(.+)\"/)?.[1] || `app-${appId}.zip`;
      const blob = response.data;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success(currentLanguage === 'zh' ? '代码下载成功' : 'Code downloaded');
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '下载失败:' : 'Download failed:', error);
      toast.error(currentLanguage === 'zh' ? '下载失败，请重试' : 'Download failed, please retry');
    }
  };


  // 切换编辑模式
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // 清除选中元素
  const clearSelectedElement = () => {
    setSelectedElementInfo(null);
  };

  // 处理元素选择
  const handleElementSelected = (elementInfo: ElementInfo) => {
    setSelectedElementInfo(elementInfo);
  };

  // 获取输入框占位符
  const getInputPlaceholder = () => {
    if (selectedElementInfo) {
      return `正在编辑 ${selectedElementInfo.tagName.toLowerCase()} 元素，描述您想要的修改...`;
    }
    return '请描述你想生成的网站，越详细效果越好哦';
  };

  // 初始化（避免重复调用）：仅在 appId 变化时触发一次
  const initCalledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!appId) return;
    if (initCalledRef.current === appId) return; // 已调用过
    initCalledRef.current = appId;
      loadAppInfo();
  }, [appId, loadAppInfo]);

  if (loading && !appInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/new')}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
            title="返回"
          >
            {currentLanguage === 'zh' ? '返回' : 'Back'}
          </button>
          <h1 className="text-xl font-semibold">
            {appInfo?.appName || (currentLanguage === 'zh' ? '网站生成器' : 'Website Builder')}
          </h1>
          {appInfo?.codeGenType && (
            <span className="px-2 py-1 text-xs bg-blue-600/10 text-blue-700 rounded-full border border-blue-600/20">
              {formatCodeGenType(appInfo.codeGenType)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isGenerating && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md border border-blue-200">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
              <span>{currentLanguage === 'zh' ? '正在生成…' : 'Generating…'}</span>
            </div>
          )}
          <button
            onClick={() => window.open('/my-apps', '_blank')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            {currentLanguage === 'zh' ? '我的应用' : 'My Apps'}
          </button>
          {/* <button
            onClick={() => {}}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Info size={16} />
            应用详情
          </button> */}
          {isOwner && (
            <>
              {/* <button
                onClick={handleDownload}
                disabled={downloading || !isOwner}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
              >
                <Download size={16} />
                {downloading ? '下载中...' : '下载代码'}
              </button> */}
              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                <Cloud size={16} />
                {deploying ? '部署中...' : '部署'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex flex-1 gap-6 p-4 md:p-6 overflow-hidden">
        {/* 左侧聊天区域 */}
        <div className="flex flex-col w-2/5 bg-white rounded-lg shadow-sm border border-slate-200">
          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* 加载更多历史 */}
            {hasMoreHistory && (
              <div className="text-center mb-4">
                <button
                  onClick={() => loadChatHistory(true)}
                  disabled={loadingHistory}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {loadingHistory ? '加载中...' : '加载更多历史消息'}
                </button>
              </div>
            )}
            
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-sm text-center">
                  开始与AI对话来生成你的网站<br/>
                  描述越详细，效果越好
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={message.id || index} className="message-item">
                    {message.type === 'user' ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] px-4 py-2 bg-blue-600 text-white rounded-2xl shadow-sm">
                          <div className="markdown-body user-message-markdown">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                code({ node, className, children }) {
                                  const isBlock = String(children).includes('\n');
                                  if (isBlock) {
                                    const text = String(children);
                                    const first = text.split('\n')[0] || '';
                                    const pos: any = (node as any)?.position?.start || {};
                                    const key = `user:${pos.line || ''}:${pos.column || ''}:${first}`;
                                    return (
                                      <CollapsibleCode className={className} persistKey={key} openStore={codeOpenMapRef}>
                                        {String(children)}
                                      </CollapsibleCode>
                                    );
                                  }
                                  return <code className={className}>{children}</code>;
                                },
                                pre({ children }) {
                                  return <div>{children}</div>;
                                }
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="flex flex-col items-start">
                        <div className="max-w-[80%] px-4 py-2 bg-slate-50 text-slate-800 rounded-2xl border border-slate-200 shadow-sm">
                          {message.loading ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                              <span className="text-sm">AI 正在思考...</span>
                            </div>
                          ) : (
                            <div className="prose prose-sm max-w-none markdown-body ai-message-markdown">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                  code({ node, className, children }) {
                                    const isBlock = String(children).includes('\n');
                                    if (isBlock) {
                                      const text = String(children);
                                      const first = text.split('\n')[0] || '';
                                      const pos: any = (node as any)?.position?.start || {};
                                      const key = `ai:${pos.line || ''}:${pos.column || ''}:${first}`;
                                      return (
                                        <CollapsibleCode className={className} persistKey={key} openStore={codeOpenMapRef}>
                                          {String(children)}
                                        </CollapsibleCode>
                                      );
                                    }
                                    return <code className={className}>{children}</code>;
                                  },
                                  pre({ children }) {
                                    return <div>{children}</div>;
                                  }
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                          {index === messages.length - 1 && isGenerating && (
                            <div className="mt-1 ml-1 text-xs text-slate-500 animate-pulse">
                              {currentLanguage === 'zh' ? 'AI正在生成' : 'AI is generating'}
                      </div>
                    )}
                  </div>
              </div>
            )}
          </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* 选中元素信息展示 */}
          {selectedElementInfo && (
            <div className="mx-4 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-800">选中的元素</h4>
                <button
                  onClick={clearSelectedElement}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-700 font-mono">
                    {selectedElementInfo.tagName.toLowerCase()}
                  </span>
                  {selectedElementInfo.id && (
                    <span className="text-green-600 font-mono">
                      #{selectedElementInfo.id}
                    </span>
                  )}
                  {selectedElementInfo.className && (
                    <span className="text-orange-600 font-mono">
                      .{selectedElementInfo.className.split(' ').join('.')}
                    </span>
                  )}
                </div>
                {selectedElementInfo.textContent && (
                  <div className="text-slate-600">
                    <span className="font-medium">内容:</span> {selectedElementInfo.textContent.substring(0, 50)}
                    {selectedElementInfo.textContent.length > 50 ? '...' : ''}
                  </div>
                )}
                {selectedElementInfo.pagePath && (
                  <div className="text-slate-600">
                    <span className="font-medium">页面路径:</span> {selectedElementInfo.pagePath}
                  </div>
                )}
                <div className="text-slate-600">
                  <span className="font-medium">选择器:</span> 
                  <code className="ml-1 px-1 py-0.5 bg-slate-100 rounded text-xs font-mono text-red-600 border">
                    {selectedElementInfo.selector}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* 输入区域 */}
          <div className="border-t border-slate-200 p-4 bg-white/80 backdrop-blur rounded-b-lg">
            <div className="flex gap-3">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={getInputPlaceholder()}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                rows={3}
                maxLength={1000}
                disabled={isGenerating || !isOwner}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isGenerating || !userInput.trim() || !isOwner}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send size={16} />
              </button>
            </div>
            {!isOwner && (
              <p className="text-xs text-slate-500 mt-2">
                无法在别人的作品下对话哦~
              </p>
            )}
          </div>
        </div>

        {/* 右侧预览区域 */}
        <div className="flex-1 relative">
          <CodePreview
            previewUrl={effectivePreviewUrl}
            isGenerating={isGenerating}
            isEditMode={isEditMode}
            selectedElementInfo={selectedElementInfo}
            onToggleEditMode={toggleEditMode}
            onClearSelection={clearSelectedElement}
            onElementSelected={handleElementSelected}
            onDownloadCode={handleDownload}
            isOwner={isOwner}
            appId={appId || ''}
            codeGenType={appInfo?.codeGenType}
          />
          {isGenerating && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex items-center justify-center">
              <div className="w-full max-w-2xl px-4"> {/* DinoGame */}
                {activeMiniGame === 'dino' ? <DinoGame /> : <DinoGame />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 部署成功弹窗 */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">部署成功！</h3>
            <p className="text-slate-600 mb-4">
              您的网站已成功部署，现在可以通过以下链接访问：
            </p>
            <div className="bg-slate-50 p-3 rounded-md mb-4 border border-slate-200">
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 break-all"
              >
                {deployUrl}
              </a>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.open(deployUrl, '_blank')}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
              >
                打开网站
              </button>
              <button
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-blue-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加markdown样式 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .user-message-markdown {
            color: white !important;
            background: transparent !important;
          }
          .user-message-markdown * {
            color: white !important;
          }
          .user-message-markdown code {
            background: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
          }
          .user-message-markdown pre {
            background: rgba(255, 255, 255, 0.1) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
          }
          .user-message-markdown pre code {
            background: transparent !important;
            border: none !important;
          }
          .ai-message-markdown {
            background: transparent !important;
            color: #0f172a !important; /* slate-900 深色，提高可读性 */
          }
          .ai-message-markdown * {
            color: #0f172a !important;
          }
          .ai-message-markdown pre {
            background: #f8fafc !important; /* 更浅的背景 */
            border: 1px solid #e2e8f0 !important; /* slate-200 */
          }
          .ai-message-markdown code {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            color: #0f172a !important;
          }
          .ai-message-markdown pre code {
            background: transparent !important;
            border: none !important;
          }
          .ai-message-markdown a {
            color: #2563eb !important; /* 蓝色链接 */
            text-decoration: underline;
          }
          .ai-message-markdown blockquote {
            color: #334155 !important; /* slate-700 */
            border-left: 4px solid #cbd5e1 !important; /* slate-300 */
          }
        `
      }} />
      {deploying && (
        <div className="fixed inset-0 z-[40] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-3 px-5 py-4 bg-white/90 rounded-xl shadow-lg border border-slate-200">
            <Logo className="h-6 w-6" />
            <span className="text-sm text-slate-800 animate-pulse">{currentLanguage === 'zh' ? '正在部署，请稍候…' : 'Deploying, please wait…'}</span>
    </div>
        </div>
      )}
    </div>
  );
};