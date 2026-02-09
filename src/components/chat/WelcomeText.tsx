import React, { useEffect, useState } from 'react';
import { Sparkles, User } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Agent } from '../../types';
import api from '../../services/api';

interface WelcomeTextProps {
  onSuggestionClick?: (suggestion: string) => void;
}

export const WelcomeText: React.FC<WelcomeTextProps> = ({ onSuggestionClick }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentNotFound, setAgentNotFound] = useState(false);

  // 默认内容
  const defaultContent = {
    title: '欢迎使用 MCP-X AI 助手',
    description: '我是您的智能AI助手，可以帮助您解答问题、分析数据、编写代码等。请告诉我您需要什么帮助？',
    avatar: <Sparkles size={32} className="text-white" />,
    suggestions: [
      '帮我写一个React组件',
      '解释一下什么是MCP',
      '如何优化网站性能',
      '分析这段代码的问题'
    ]
  };

  // 处理建议点击，保留agent参数
  const handleSuggestionClick = (suggestion: string) => {
    const agentId = searchParams.get('agent');
    
    if (onSuggestionClick) {
      // 如果有agent参数，需要保留在URL中
      if (agentId) {
        // 获取当前路径
        const currentPath = window.location.pathname;
        const newUrl = `${currentPath}?agent=${agentId}`;
        
        // 更新URL但不刷新页面
        navigate(newUrl, { replace: true });
      }
      
      // 调用父组件的处理函数
      onSuggestionClick(suggestion);
    }
  };

  // 获取 agent 信息
  useEffect(() => {
    const agentId = searchParams.get('agent');
    
    if (agentId) {
      console.log('检测到agent参数:', agentId);
      setLoading(true);
      setError(null);
      setAgentNotFound(false);
      
      api.agent.getDetail(agentId)
        .then(response => {
          console.log('Agent详情响应:', response);
          if (response.code === 200 && response.data) {
            setAgent(response.data);
          } else if (response.code === 500 && response.msg === 'Agent不存在') {
            // Agent不存在，使用默认内容
            setAgentNotFound(true);
            setAgent(null);
          } else {
            // 其他错误
            setError(response.msg || '获取Agent信息失败');
          }
        })
        .catch(err => {
          console.error('获取Agent详情失败:', err);
          // 检查是否是网络错误还是API错误
          if (err.response?.data?.code === 500 && err.response?.data?.msg === 'Agent不存在') {
            setAgentNotFound(true);
            setAgent(null);
          } else {
            setError('获取Agent信息失败');
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      console.log('未检测到agent参数，使用默认内容');
      setAgent(null);
      setError(null);
      setAgentNotFound(false);
    }
  }, [searchParams]);

  // 根据 agent 信息或默认内容渲染
  const content = agent ? {
    title: agent.name,
    description: agent.description || agent.openSay || defaultContent.description,
    suggestions: agent.questions ? 
      agent.questions.split('\n').filter(q => q.trim()) : 
      defaultContent.suggestions
  } : defaultContent;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mb-4 mx-auto animate-pulse">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            加载中...
          </h1>
          <p className="text-gray-600 text-lg">
            正在获取AI助手信息
          </p>
        </div>
      </div>
    );
  }

  // 只有在非Agent不存在的情况下才显示错误
  if (error && !agentNotFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mb-4 mx-auto">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            加载失败
          </h1>
          <p className="text-gray-600 text-lg mb-4">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="mb-8">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mb-4 mx-auto overflow-hidden">
          {agent && agent.avatar ? (
            <>
              <img 
                src={agent.avatar} 
                alt={agent.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 如果头像加载失败，隐藏图片并显示默认图标
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const container = target.parentElement;
                  if (container) {
                    container.innerHTML = '<svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
                  }
                }}
              />
            </>
          ) : (
            <Sparkles size={32} className="text-white" />
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {content.title}
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          {content.description}
        </p>
        {agent && agent.author && (
          <p className="text-gray-500 text-sm mt-2">
            作者：{agent.author}
          </p>
        )}
      </div>

      <div className="mt-8 text-gray-600 text-sm">
        <p>💡 提示：您可以尝试以下问题</p>
        <div className="flex flex-wrap justify-center gap-3 mt-3">
          {content.suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-200 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}; 