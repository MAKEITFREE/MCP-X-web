import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { SessionInfo, ChatMessageVo } from '../services/chatApi';

// 聊天状态接口
interface ChatState {
  currentSessionId: string | null;
  sessionList: SessionInfo[];
  chatMap: Record<string, ChatMessageVo[]>;
  isDeepThinking: boolean;
  loading: boolean;
  error: string | null;
}

// 聊天动作类型
type ChatAction =
  | { type: 'SET_CURRENT_SESSION'; payload: string }
  | { type: 'SET_SESSION_LIST'; payload: SessionInfo[] }
  | { type: 'ADD_SESSION'; payload: SessionInfo }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'SET_CHAT_MAP'; payload: { sessionId: string; messages: ChatMessageVo[] } }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: ChatMessageVo } }
  | { type: 'UPDATE_MESSAGE_CONTENT'; payload: { sessionId: string; messageId: string; deltaContent: string } }
  | { type: 'SET_DEEP_THINKING'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' };

// 初始状态
const initialState: ChatState = {
  currentSessionId: null,
  sessionList: [],
  chatMap: {},
  isDeepThinking: false,
  loading: false,
  error: null,
};

// 聊天Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_CURRENT_SESSION':
      return { ...state, currentSessionId: action.payload };
    
    case 'SET_SESSION_LIST':
      // 按照最近对话时间倒序排序
      const sortedSessionList = [...action.payload].sort((a, b) => {
        const timeA = a.updateTime || a.createTime || '';
        const timeB = b.updateTime || b.createTime || '';
        
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;  // 没有时间的排在后面
        if (!timeB) return -1;
        
        // 处理中文时间格式 "2025/7/29 下午6:00"
        const parseTime = (timeStr: string) => {
          try {
            // 如果是中文格式，先转换
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
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hourNum, parseInt(minute)).getTime();
              }
            }
            // 尝试标准格式
            return new Date(timeStr).getTime();
          } catch (error) {
            console.warn('时间解析失败:', timeStr, error);
            return 0;
          }
        };
        
        const timeAValue = parseTime(timeA);
        const timeBValue = parseTime(timeB);
        
        return timeBValue - timeAValue;
      });
      
      return { ...state, sessionList: sortedSessionList };
    
    case 'ADD_SESSION':
      // 添加新会话并重新排序
      const newSessionList = [...state.sessionList, action.payload].sort((a, b) => {
        const timeA = a.updateTime || a.createTime || '';
        const timeB = b.updateTime || b.createTime || '';
        
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;
        
        // 处理中文时间格式 "2025/7/29 下午6:00"
        const parseTime = (timeStr: string) => {
          try {
            // 如果是中文格式，先转换
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
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hourNum, parseInt(minute)).getTime();
              }
            }
            // 尝试标准格式
            return new Date(timeStr).getTime();
          } catch (error) {
            console.warn('时间解析失败:', timeStr, error);
            return 0;
          }
        };
        
        const timeAValue = parseTime(timeA);
        const timeBValue = parseTime(timeB);
        
        return timeBValue - timeAValue;
      });
      
      return { 
        ...state, 
        sessionList: newSessionList
      };
    
    case 'REMOVE_SESSION':
      const newChatMap = { ...state.chatMap };
      delete newChatMap[action.payload];
      return {
        ...state,
        sessionList: state.sessionList.filter(session => session.id !== action.payload),
        chatMap: newChatMap
      };
    
    case 'SET_CHAT_MAP':
      return {
        ...state,
        chatMap: {
          ...state.chatMap,
          [action.payload.sessionId]: action.payload.messages
        }
      };
    
    case 'ADD_MESSAGE':
      const currentMessages = state.chatMap[action.payload.sessionId] || [];
      return {
        ...state,
        chatMap: {
          ...state.chatMap,
          [action.payload.sessionId]: [...currentMessages, action.payload.message]
        }
      };
    
    case 'UPDATE_MESSAGE_CONTENT':
      console.log('UPDATE_MESSAGE_CONTENT action:', action.payload);
      const sessionMessages = state.chatMap[action.payload.sessionId] || [];
      console.log('当前会话消息数量:', sessionMessages.length);
      const messageIndex = sessionMessages.findIndex(msg => msg.id === action.payload.messageId);
      console.log('找到消息索引:', messageIndex, '消息ID:', action.payload.messageId);
      
      if (messageIndex !== -1) {
        const updatedMessages = [...sessionMessages];
        const oldContent = updatedMessages[messageIndex].content;
        const newContent = oldContent + action.payload.deltaContent;
        console.log(`消息内容更新: 原长度=${oldContent.length}, 新增长度=${action.payload.deltaContent.length}, 新长度=${newContent.length}`);
        console.log(`内容预览: "${oldContent.slice(-50)}" + "${action.payload.deltaContent}" -> "${newContent.slice(-50)}"`);
        
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: newContent
        };
        
        const newState = {
          ...state,
          chatMap: {
            ...state.chatMap,
            [action.payload.sessionId]: updatedMessages
          }
        };
        
        console.log('更新后的状态:', {
          sessionId: action.payload.sessionId,
          messageId: action.payload.messageId,
          contentLength: newContent.length
        });
        
        return newState;
      } else {
        console.warn('未找到要更新的消息:', {
          messageId: action.payload.messageId,
          availableIds: sessionMessages.map(msg => msg.id)
        });
      }
      return state;
    
    case 'SET_DEEP_THINKING':
      return { ...state, isDeepThinking: action.payload };
    
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

// 聊天Context
interface ChatContextType {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: ChatMessageVo) => void;
  setDeepThinking: (enabled: boolean) => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// 聊天Provider组件
interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // 便捷方法
  const setCurrentSession = (sessionId: string) => {
    dispatch({ type: 'SET_CURRENT_SESSION', payload: sessionId });
  };

  const addMessage = (sessionId: string, message: ChatMessageVo) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message } });
  };

  const setDeepThinking = (enabled: boolean) => {
    dispatch({ type: 'SET_DEEP_THINKING', payload: enabled });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: ChatContextType = {
    state,
    dispatch,
    setCurrentSession,
    addMessage,
    setDeepThinking,
    clearError,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

// 使用聊天Context的Hook
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}; 