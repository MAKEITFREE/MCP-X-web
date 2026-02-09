import React from 'react';
import { Agent } from '../../types';
import { VerifiedBadge } from './VerifiedBadge';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import config from '../../config';
import { useLanguage } from '../../contexts/LanguageContext';

interface AgentCardProps {
  agent: Agent;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const { currentLanguage } = useLanguage();

  // 获取Agent名称（支持多语言）
  const getAgentName = (agent: Agent) => {
    return currentLanguage === 'en' && agent.nameEn ? agent.nameEn : agent.name;
  };

  // 获取Agent描述（支持多语言）
  const getAgentDescription = (agent: Agent) => {
    return currentLanguage === 'en' && agent.descriptionEn ? agent.descriptionEn : agent.description;
  };
  // 格式化使用次数
  const formatUsage = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // 格式化发布日期
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  // 处理头像URL
  const getAvatarUrl = (avatar: string) => {
    if (!avatar || typeof avatar !== 'string') return '';
    
    // 如果以http或https开头，直接返回
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    
    // 如果有值但不是http开头，在前面加上当前页面URL
    // if (avatar.trim()) {//window.location.origin;
    //   const currentUrl = window.location.origin; // 获取当前页面的origin（包含协议、域名、端口）
    //   // 确保avatar以/开头，避免重复的斜杠
    //   const path = avatar.startsWith('/') ? avatar : `/${avatar}`;
    //   return `${currentUrl}${path}`;
    // }

    if (avatar.startsWith('/')) {
      return `${config.apiBaseUrl}${avatar}`;
    }
    
    return '';
  };

  return (
    <Link 
      to={`/agent/${agent.id}`}
      className="block w-full rounded-lg transition-all duration-200 p-4 h-[180px] flex flex-col border backdrop-blur-md bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30 shadow-sm"
    >
      <div className="flex items-start mb-2">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {getAvatarUrl(agent.avatar) ? (
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <img 
                src={getAvatarUrl(agent.avatar)} 
                alt={getAgentName(agent)}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // 如果图片加载失败，替换为首字母显示
                  const imgElement = e.target as HTMLImageElement;
                  const container = imgElement.parentElement;
                  if (container) {
                    container.innerHTML = `
                      <div class="w-full h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-lg font-bold text-black">
                        ${getAgentName(agent).charAt(0).toUpperCase()}
                      </div>
                    `;
                  }
                }}
              />
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-lg font-bold text-black flex-shrink-0">
              {getAgentName(agent).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white flex items-center group-hover:text-orange-500">
              <span className="truncate">{getAgentName(agent)}</span>
              {agent.verified && <span className="ml-1 flex-shrink-0"><VerifiedBadge /></span>}
              {agent.new && <span className="ml-2 text-xs bg-orange-500 text-black px-1.5 py-0.5 rounded-full flex-shrink-0">NEW</span>}
            </h3>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span className="truncate">{agent.author}</span>
              {agent.githubUrl && (
                <a 
                  href={agent.githubUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Github size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-gray-300 mb-3 line-clamp-2 flex-grow text-sm">
        {getAgentDescription(agent)}
      </p>
      
      <div className="flex justify-between items-center mt-auto pt-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">
            {agent.categoryName || '未分类'}
          </span>
          <span className="text-xs text-gray-400">
            {agent.likeCount || formatUsage(agent.likeCount)}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          发布于 {formatDate(agent.publishTime)}
        </div>
      </div>
    </Link>
  );
}; 