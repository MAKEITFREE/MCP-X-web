import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { MessageSquare, Plus, Trash2, MoreVertical, ChevronLeft, ChevronRight, Image, Globe, User, Home, PanelLeft } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { chatApi, SessionInfo } from '../../services/chatApi';
import { toast } from '../../utils/toast';

interface ChatSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLoadSessionList?: () => void;
  autoCollapsed?: boolean;
  lastMessages?: Record<string, { content: string; time: string }>;
  onRefreshSessionList?: () => void; // 新增：刷新会话列表的回调
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  isCollapsed = false,
  onToggleCollapse,
  onLoadSessionList,
  autoCollapsed = false,
  lastMessages = {},
  onRefreshSessionList
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id: currentSessionId } = useParams<{ id?: string }>();
  const { state, dispatch } = useChat();
  const { currentLanguage } = useLanguage();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showActions, setShowActions] = useState<string | null>(null);
  const actionsMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 辅助函数：保留agent参数进行跳转
  const navigateWithAgent = (path: string) => {
    const agentId = searchParams.get('agent');
    if (agentId) {
      navigate(`${path}?agent=${agentId}`);
    } else {
      navigate(path);
    }
  };

  // 注意：不再在这里加载会话列表，由ChatPage统一管理

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showActions) {
        const currentMenuRef = actionsMenuRefs.current[showActions];
        if (currentMenuRef && !currentMenuRef.contains(event.target as Node)) {
          setShowActions(null);
        }
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  // 清理 refs
  useEffect(() => {
    return () => {
      actionsMenuRefs.current = {};
    };
  }, []);

  const handleCreateNewChat = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      toast.error(currentLanguage === 'zh' ? '请先登录' : 'Please login first');
      navigate('/login', { state: { from: location } });
      return;
    }

    try {
      // 创建新的会话
      const sessionResponse = await chatApi.createSession({
        userId: userId,
        sessionContent: currentLanguage === 'zh' ? '新对话' : 'New Chat',
        sessionTitle: currentLanguage === 'zh' ? '新对话' : 'New Chat',
        remark: currentLanguage === 'zh' ? '新对话' : 'New Chat',
        appId: 'mcpx-chat'
      });

      if (sessionResponse.code === 200 && sessionResponse.data) {
        const newSessionId = sessionResponse.data.toString();
        // 跳转到新的会话页面，保留agent参数
        navigateWithAgent(`/chat/${newSessionId}`);
        // 刷新会话列表缓存，确保下次打开时显示最新数据
        if (onRefreshSessionList) {
          onRefreshSessionList();
        }
        // 重新加载会话列表
        if (onLoadSessionList) {
          onLoadSessionList();
        }
        toast.success(currentLanguage === 'zh' ? '创建新对话成功' : 'New chat created successfully');
      } else {
        toast.error(currentLanguage === 'zh' ? '创建会话失败' : 'Failed to create chat');
      }
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '创建会话失败' : 'Failed to create chat', error);
      toast.error(currentLanguage === 'zh' ? '创建会话失败' : 'Failed to create chat');
    }
  };

  const handleSelectSession = (session: SessionInfo) => {
    navigateWithAgent(`/chat/${session.id}`);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(currentLanguage === 'zh' ? '确定要删除这个会话吗？' : 'Are you sure you want to delete this chat?')) return;

    try {
      const response = await chatApi.deleteSession(sessionId);
      if (response.code === 200) {
        dispatch({ type: 'REMOVE_SESSION', payload: sessionId });
        toast.success(currentLanguage === 'zh' ? '删除成功' : 'Deleted successfully');

        // 如果删除的是当前会话，跳转到聊天首页，保留agent参数
        if (currentSessionId === sessionId) {
          navigateWithAgent('/chat');
        }
      } else {
        toast.error(response.msg || (currentLanguage === 'zh' ? '删除失败' : 'Delete failed'));
      }
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '删除会话失败' : 'Failed to delete chat', error);
      toast.error(currentLanguage === 'zh' ? '删除失败' : 'Delete failed');
    }
  };



  const handleSaveEdit = async (sessionId: string) => {
    if (!editingTitle.trim()) return;

    try {
      const response = await chatApi.updateSession({
        sessionTitle: editingTitle.trim(),
        sessionId: sessionId
      });

      if (response.code === 200) {
        // 更新本地状态
        const updatedSessions = state.sessionList.map(session =>
          session.id === sessionId
            ? { ...session, sessionTitle: editingTitle.trim() }
            : session
        );
        dispatch({ type: 'SET_SESSION_LIST', payload: updatedSessions });
        setEditingSessionId(null);
        setEditingTitle('');
        toast.success(currentLanguage === 'zh' ? '修改成功' : 'Modified successfully');
      } else {
        toast.error(response.msg || (currentLanguage === 'zh' ? '修改失败' : 'Modification failed'));
      }
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '修改会话失败' : 'Failed to modify chat', error);
      toast.error(currentLanguage === 'zh' ? '修改失败' : 'Modification failed');
    }
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(sessionId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // 对会话列表进行实时排序
  const sortedSessions = React.useMemo(() => {
    return [...state.sessionList].sort((a, b) => {
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
  }, [state.sessionList, lastMessages]);

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      let date: Date;

      // 处理中文时间格式 "2025/7/29 下午12:22"
      if (timeStr.includes('下午') || timeStr.includes('上午')) {
        const match = timeStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)(\d{1,2}):(\d{2})/);
        if (match) {
          const [, year, month, day, period, hour, minute] = match;
          let hourNum = parseInt(hour);
          if (period === '下午' && hourNum !== 12) {
            hourNum += 12;
          } else if (period === '上午' && hourNum === 12) {
            hourNum = 0;
          }
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hourNum, parseInt(minute));
        } else {
          date = new Date(timeStr);
        }
      } else {
        // 处理标准日期格式
        date = new Date(timeStr);
      }

      if (isNaN(date.getTime())) {
        return timeStr;
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffTime = today.getTime() - messageDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // 当天对话：只显示时间 HH:MM
      if (diffDays === 0) {
        return date.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }

      // 昨天对话：显示"昨天"
      if (diffDays === 1) {
        return currentLanguage === 'zh' ? '昨天' : 'Yesterday';
      }

      // 本周对话：显示星期数
      const messageDay = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
      if (diffDays > 1 && diffDays <= 7) {
        const weekdays = currentLanguage === 'zh'
          ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return weekdays[messageDay];
      }

      // 本周之前：只显示 YY/MM/DD
      const year = date.getFullYear().toString().slice(-2); // 取后两位
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      return `${year}/${month}/${day}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300`}>
      {/* 头部 */}
      <div className="p-2 border-b border-gray-200 flex items-center gap-1">
        {isCollapsed ? (
          <button
            onClick={onToggleCollapse}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors mx-auto"
            title={currentLanguage === 'zh' ? '展开侧边栏' : 'Expand Sidebar'}
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title={currentLanguage === 'zh' ? '返回创作者中心' : 'Back to Creator Hub'}
          >
            <Home className="w-5 h-5" />
          </button>
        )}

        {!isCollapsed && (
          <>
            <button
              onClick={onToggleCollapse}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title={currentLanguage === 'zh' ? '收起侧边栏' : 'Collapse Sidebar'}
            >
              <PanelLeft className="w-5 h-5" />
            </button>

            <button
              onClick={handleCreateNewChat}
              className="flex-1 flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              {currentLanguage === 'zh' ? '新建聊天' : 'New Chat'}
            </button>
          </>
        )}
      </div>

      {/* 缩进状态下只显示一个聊天气泡图标，点击展开侧边栏 */}
      {isCollapsed && (
        <div className="p-2 border-b border-gray-200 flex flex-col items-center">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={currentLanguage === 'zh' ? '展开聊天记录' : 'Expand Chat History'}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {isCollapsed ? null : (
          sortedSessions.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{currentLanguage === 'zh' ? '暂无聊天记录' : 'No chat history'}</p>
            </div>
          ) : (
            <div className="p-2">
              {sortedSessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative p-3 mb-2 rounded-lg cursor-pointer transition-colors ${currentSessionId === session.id
                    ? 'bg-blue-100 text-blue-800'
                    : 'hover:bg-gray-100 text-gray-800'
                    }`}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      {editingSessionId === session.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="w-full bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm"
                          onBlur={() => handleSaveEdit(session.id)}
                          onKeyDown={(e) => handleKeyDown(e, session.id)}
                          autoFocus
                        />
                      ) : (
                        <>
                          {/* 第一行：标题（左）+ 时间（右） */}
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-sm truncate flex-1 mr-2">
                              {session.sessionTitle}
                            </h3>
                            <p className={`text-xs flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-500' : 'text-gray-500'
                              }`}>
                              {(() => {
                                const lastMessageData = lastMessages[session.id.toString()];
                                const displayTime = lastMessageData?.time
                                  ? formatTime(lastMessageData.time)
                                  : formatTime(session.createTime);
                                return displayTime;
                              })()}
                            </p>
                          </div>
                          {/* 第二行：最后一条消息内容的前20字 */}
                          {(() => {
                            const lastMessageData = lastMessages[session.id.toString()];
                            const lastMessageContent = lastMessageData?.content || '';
                            return lastMessageContent ? (
                              <p className={`text-xs truncate ${currentSessionId === session.id ? 'text-blue-400' : 'text-gray-400'
                                }`}>
                                {lastMessageContent}
                              </p>
                            ) : null;
                          })()}
                        </>
                      )}
                    </div>
                    {/* 操作按钮 */}
                    {editingSessionId !== session.id && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowActions(showActions === session.id ? null : session.id);
                          }}
                          className={`p-1 rounded transition-colors ${currentSessionId === session.id
                            ? 'hover:bg-blue-200 text-blue-800'
                            : 'hover:bg-gray-200 text-gray-500'
                            }`}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {showActions === session.id && (
                          <div
                            ref={(el) => {
                              actionsMenuRefs.current[session.id] = el;
                            }}
                            className="absolute z-10 right-4 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg"
                          >
                            <button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              {currentLanguage === 'zh' ? '删除' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 底部固定入口 - 仅在展开时显示 */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-2 space-y-1">
          {/* 文生图工作台 */}
          <button
            onClick={() => navigate('/image-editor')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
          >
            <Image className="w-5 h-5" />
            <span className="text-sm font-medium">{currentLanguage === 'zh' ? '文生图工作台' : 'AI Image Studio'}</span>
          </button>

          {/* 一句话建站 */}
          <button
            onClick={() => navigate('/app/new')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <Globe className="w-5 h-5" />
            <span className="text-sm font-medium">{currentLanguage === 'zh' ? '一句话建站' : 'One-Click Website'}</span>
          </button>

          {/* 我的 */}
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">{currentLanguage === 'zh' ? '我的' : 'My Account'}</span>
          </button>
        </div>
      )}

      {/* 底部固定入口 - 缩进状态下显示图标 */}
      {isCollapsed && (
        <div className="border-t border-gray-200 p-2 flex flex-col items-center gap-1">
          {/* 文生图工作台 */}
          <button
            onClick={() => navigate('/image-editor')}
            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title={currentLanguage === 'zh' ? '文生图工作台' : 'AI Image Studio'}
          >
            <Image className="w-5 h-5" />
          </button>

          {/* 一句话建站 */}
          <button
            onClick={() => navigate('/app/new')}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={currentLanguage === 'zh' ? '一句话建站' : 'One-Click Website'}
          >
            <Globe className="w-5 h-5" />
          </button>

          {/* 我的 */}
          <button
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title={currentLanguage === 'zh' ? '我的' : 'My Account'}
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
