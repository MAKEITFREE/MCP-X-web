import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { getAgentDetail } from '../data/agents';
import { DetailedAgent } from '../types';
import { VerifiedBadge } from '../components/ui/VerifiedBadge';
import { AgentCard } from '../components/ui/AgentCard';
import { Github, Share2, HelpCircle, Eye, Settings, Zap, Heart, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import '../styles/markdown.css';
import config from '../config';
import { Dropdown, Menu, Modal } from 'antd';
import * as qrcode from 'qrcode.react';
import { useLanguage } from '../contexts/LanguageContext';

const QRCode = (qrcode as any).default || qrcode;

export const AgentDetailPage: React.FC = () => {
  const { t, currentLanguage } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<DetailedAgent | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'capabilities' | 'related'>('overview');
  const [loading, setLoading] = useState(true);
  const [isOpeningClient, setIsOpeningClient] = useState(false);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [matchedCategory, setMatchedCategory] = useState<any | null>(null);

  // 获取Agent名称（支持多语言）
  const getAgentName = (agent: DetailedAgent) => {
    return currentLanguage === 'en' && agent.nameEn ? agent.nameEn : agent.name;
  };

  // 获取Agent问题列表（按行拆分，已适配多语言）
  const getQuestionsList = (agent: DetailedAgent): string[] => {
    const qs = getAgentQuestions(agent);
    if (!qs) return [];
    return qs.split('\n').map(q => q.trim()).filter(Boolean);
  };

  // 获取Agent的系统角色（支持多语言）
  const getAgentSystemRole = (agent: DetailedAgent) => {
    return currentLanguage === 'en' && agent.systemRoleEn ? agent.systemRoleEn : agent.systemRole;
  };

  // 获取Agent的系统提示（支持多语言）
  const getAgentSystemPromote = (agent: DetailedAgent) => {
    return currentLanguage === 'en' && agent.systemPromoteEn ? agent.systemPromoteEn : agent.systemPromote;
  };

  // 获取Agent的开场白（支持多语言）
  const getAgentOpenSay = (agent: DetailedAgent) => {
    return currentLanguage === 'en' && agent.openSayEn ? agent.openSayEn : agent.openSay;
  };

  // 获取Agent的问题（支持多语言）
  const getAgentQuestions = (agent: DetailedAgent) => {
    return currentLanguage === 'en' && agent.questionsEn ? agent.questionsEn : agent.questions;
  };

  // 获取分类显示名（支持多语言）
  const getCategoryDisplayName = (): string => {
    if (matchedCategory) {
      return currentLanguage === 'en' && matchedCategory.nameEn ? matchedCategory.nameEn : matchedCategory.name;
    }
    return agent?.categoryName || t('agentDetail.uncategorized');
  };

  // 获取Agent能力列表（支持多语言，英文优先展示英文系统角色）
  const getAgentCapabilities = (agent: DetailedAgent): string[] => {
    if (currentLanguage === 'en') {
      const roleEn = getAgentSystemRole(agent);
      if (roleEn) return [roleEn];
      const capEn = (agent as any).capabilitiesEn;
      if (Array.isArray(capEn) && capEn.length > 0) return capEn;
      // 最后兜底英文无内容时，用中文能力
      if (Array.isArray(agent.capabilities) && agent.capabilities.length > 0) return agent.capabilities;
      return [];
    }

    // 中文
    if (Array.isArray(agent.capabilities) && agent.capabilities.length > 0) return agent.capabilities;
    if (agent.systemRole) return [agent.systemRole];
    return [];
  };

  const handleShare = (platform: string) => {
    const shareUrl = window.location.href;
    
    let description = agent?.overview || '';
    let tags = '';

    // 使用正则表达式查找最后一个中英文句点/句号，并考虑末尾的空格
    const separatorRegex = /[.。]\s*$/;
    const match = description.match(separatorRegex);
    let lastDotIndex = -1;

    if (match && match.index !== undefined) {
      // 如果匹配到末尾的句号，以此为准
      lastDotIndex = match.index;
    } else {
      // 否则，查找最后一个出现的中英文句号
      const lastEnDot = description.lastIndexOf('.');
      const lastCnDot = description.lastIndexOf('。');
      lastDotIndex = Math.max(lastEnDot, lastCnDot);
    }
    
    if (lastDotIndex !== -1 && lastDotIndex < description.length - 1) {
      // 句点后的内容作为潜在的标签字符串
      const potentialTags = description.substring(lastDotIndex + 1).trim();
      
      // 句点前的内容作为描述
      description = description.substring(0, lastDotIndex + 1);
      
      // 解析逗号分隔的标签
      tags = potentialTags.split(',')
        .map(t => `#${t.trim()}`)
        .filter(t => t.length > 1) // 过滤掉只有'#'的空标签
        .join(' ');
    }
    
    // Updated share text format
    const shareText = `${agent?.name || ''} - ${description} ${tags} #MCP-X`;
    const shareTitle = `分享: ${agent?.name || 'MCP-X Agent'}`;

    const socialLinks: { [key: string]: string } = {
      weibo: `http://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      reddit: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}&summary=${encodeURIComponent(shareText)}`,
    };

    if (socialLinks[platform]) {
      window.open(socialLinks[platform], '_blank', 'noopener,noreferrer');
    }
  };

  const shareMenu = (
    <Menu className="bg-gray-800 border-gray-700 text-gray-300">
      {/* <Menu.Item key="wechat" onClick={() => setIsQrModalVisible(true)} className="hover:bg-gray-700">微信</Menu.Item> */}
      <Menu.Item key="weibo" onClick={() => handleShare('weibo')} className="hover:bg-gray-700">微博</Menu.Item>
      <Menu.Item key="x" onClick={() => handleShare('x')} className="hover:bg-gray-700">X (Twitter)</Menu.Item>
      <Menu.Item key="reddit" onClick={() => handleShare('reddit')} className="hover:bg-gray-700">Reddit</Menu.Item>
      <Menu.Item key="telegram" onClick={() => handleShare('telegram')} className="hover:bg-gray-700">Telegram</Menu.Item>
      <Menu.Item key="linkedin" onClick={() => handleShare('linkedin')} className="hover:bg-gray-700">LinkedIn</Menu.Item>
    </Menu>
  );

  const isAvatarUrl = (avatar: string | undefined | null): boolean => {
    if (!avatar) return false;
    const trimmedAvatar = avatar.trim();
    return (
      trimmedAvatar.startsWith('http://') ||
      trimmedAvatar.startsWith('https://') ||
      trimmedAvatar.startsWith('/') ||
      trimmedAvatar.startsWith('data:image')
    );
  };

  const getFullAvatarUrl = (avatar: string | undefined | null): string => {
    if (!avatar) return '';
    const trimmedAvatar = avatar.trim();
    if (trimmedAvatar.startsWith('/')) {
      return `${config.apiBaseUrl}${trimmedAvatar}`;
    }
    return trimmedAvatar;
  };

  const handleOpenInClient = () => {
    if (!agent?.id || isOpeningClient) {
      return;
    }

    // 立即调用API记录点击，不阻塞后续操作
    api.agent.trackActivity(String(agent.id));

    setIsOpeningClient(true);

    // 安全定时器，确保按钮状态在3秒后恢复
    setTimeout(() => {
      setIsOpeningClient(false);
    }, 3000);

    const customUrl = `mcp-x://agent/${agent.id}`;

    const fallbackTimeout = setTimeout(() => {
      window.location.href = '/download';
    }, 1500);

    const handleBlur = () => {
      clearTimeout(fallbackTimeout);
      window.removeEventListener('blur', handleBlur);
    };
    window.addEventListener('blur', handleBlur);

    window.location.href = customUrl;
  };

  useEffect(() => {
    if (id) {
      const loadAgentDetail = async () => {
        try {
          setLoading(true);
          
          // 尝试从API获取详情
          const response = await api.agent.getDetail(id);
          if (response.code === 200) {
            // 将API数据转换为DetailedAgent格式
            const apiData = response.data;
            
            // 处理tags字段，确保是数组格式
            let tags = [];
            try {
              if (Array.isArray(apiData.tags)) {
                tags = apiData.tags;
              } else if (typeof apiData.tags === 'string') {
                // 处理逗号分隔的tags字符串 "教育, GitHub" -> ["教育", "GitHub"]
                tags = apiData.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
              } else {
                tags = [];
              }
            } catch (e) {
              console.warn('解析tags失败:', apiData.tags);
              tags = [];
            }
            
            // 解析分类名称（兼容无 categoryName 的情况）
            let categoryNameResolved = apiData.categoryName;
            try {
              if (!categoryNameResolved && apiData.categoryId) {
                const categoriesRes = await api.agent.getCategories();
                let categoriesData: any[] = [];
                if (categoriesRes?.data && (categoriesRes.data as any).categories) {
                  categoriesData = (categoriesRes.data as any).categories;
                } else if (Array.isArray(categoriesRes?.data)) {
                  categoriesData = categoriesRes.data as any[];
                }
                const matched = Array.isArray(categoriesData)
                  ? categoriesData.find((c: any) => c.id === apiData.categoryId)
                  : null;
                if (matched) {
                  setMatchedCategory(matched);
                  categoryNameResolved = matched.name;
                }
              }
            } catch (e) {
              console.warn('解析分类名称失败:', e);
            }

            const agent: DetailedAgent = {
              ...apiData,
              tags: tags, // 使用处理后的tags数组
              categoryName: categoryNameResolved || t('agentDetail.uncategorized'),
              usageLabel: apiData.usageLabel || `${apiData.usageCount || 0}`,
              verified: apiData.status === 1,
              new: apiData.isFeatured === 1,
              overview: apiData.description || '',
              capabilities: apiData.systemRole ? [apiData.systemRole] : [],
              prompt: apiData.systemPromote || '',
              demoMessages: apiData.questions ? [
                {
                  user: currentLanguage === 'en' && apiData.questionsEn ? apiData.questionsEn : apiData.questions,
                  assistant: currentLanguage === 'en'
                    ? (apiData.openSayEn || (apiData.nameEn ? `I'm ${apiData.nameEn}, how can I help you?` : `I'm ${apiData.name || 'Agent'}, how can I help you?`))
                    : (apiData.openSay || ('我是' + (apiData.name || '智能助手') + '，有什么可以帮助您的吗？'))
                }
              ] : [],
              relatedAgents: []
            };
            setAgent(agent);
          } else {
            throw new Error('API返回错误');
          }
        } catch (error) {
          console.error('获取Agent详情失败:', error);
          // 使用模拟数据作为回退
          const agentDetail = getAgentDetail(id);
          setAgent(agentDetail);
        } finally {
          setLoading(false);
        }
      };
      
      loadAgentDetail();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{t('agentDetail.agentNotFound')}</h1>
            <Link to="/agent" className="text-orange-500 hover:text-orange-400">
              {t('agentDetail.backToAgentList')}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-gray-400">
          <Link to="/" className="hover:text-white">MCP-X</Link>
          <span className="mx-2">/</span>
          <Link to="/agent" className="hover:text-white">Agent</Link>
          <span className="mx-2">/</span>
          <span>{getAgentName(agent)}</span>
        </div>

        {/* Header */}
        <div className="rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-4">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                {isAvatarUrl(agent.avatar) ? (
                  <img 
                    src={getFullAvatarUrl(agent.avatar)} 
                    alt={getAgentName(agent)}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      const fallback = img.nextElementSibling as HTMLElement;
                      if (fallback) {
                        img.style.display = 'none';
                        fallback.className = 'flex items-center justify-center w-full h-full';
                      }
                    }}
                  />
                ) : null}
                <span className={isAvatarUrl(agent.avatar) ? 'hidden' : 'flex items-center justify-center w-full h-full'}>
                  {agent.avatar || getAgentName(agent)?.charAt(0) || 'A'}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center">
                  {getAgentName(agent)}
                  {agent.verified && <span className="ml-2"><VerifiedBadge /></span>}
                </h1>
                <div className="flex items-center space-x-4 text-gray-400 mb-2">
                  <span>{agent.author}</span>
                  <span>•</span>
                  <span>{t('agentDetail.publishedOn')} {new Date(agent.publishTime).toLocaleDateString('zh-CN')}</span>
                  {agent.githubUrl && (
                    <>
                      <span>•</span>
                      <a 
                        href={agent.githubUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 hover:text-white transition-colors"
                      >
                        <Github size={16} />
                        <span>{t('agentDetail.github')}</span>
                      </a>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm">
                    {getCategoryDisplayName()}
                  </span>
                  <span className="text-gray-400 text-sm">{agent.usageLabel || `${agent.usageCount} ${t('agentDetail.usageCount')}`}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Dropdown overlay={shareMenu} trigger={['click']}>
              <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <Share2 size={20} />
              </button>
              </Dropdown>
              <a
                href="https://github.com/TimeCyber/MCP-X/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1"
              >
                <span className="text-sm">{t('agentDetail.needHelp')}</span>
                <HelpCircle size={16} />
              </a>
            </div>
          </div>
        </div>

        <Modal
          title={t('agentDetail.shareToWechat')}
          visible={isQrModalVisible}
          onOk={() => setIsQrModalVisible(false)}
          onCancel={() => setIsQrModalVisible(false)}
          footer={null}
          centered
        >
          <div className="flex flex-col items-center justify-center py-4">
            <QRCode value={window.location.href} size={200} />
            <p className="mt-4 text-gray-400">{t('agentDetail.wechatShareDesc')}</p>
          </div>
        </Modal>

        {/* Tabs */}
        <div className="border-b border-gray-800 mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-2 border-b-2 font-medium text-base flex items-center space-x-2 ${
                activeTab === 'overview'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Eye size={18} className={activeTab === 'overview' ? 'text-orange-500' : 'text-gray-400'} />
              <span>{t('agentDetail.overview')}</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 px-2 border-b-2 font-medium text-base flex items-center space-x-2 ${
                activeTab === 'settings'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Settings size={18} className={activeTab === 'settings' ? 'text-orange-500' : 'text-gray-400'} />
              <span>{t('agentDetail.agentSettings')}</span>
            </button>
            <button
              onClick={() => setActiveTab('capabilities')}
              className={`py-3 px-2 border-b-2 font-medium text-base flex items-center space-x-2 ${
                activeTab === 'capabilities'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Zap size={18} className={activeTab === 'capabilities' ? 'text-orange-500' : 'text-gray-400'} />
              <span>{t('agentDetail.agentCapabilities')}</span>
            </button>
            <button
              onClick={() => setActiveTab('related')}
              className={`py-3 px-2 border-b-2 font-medium text-base flex items-center space-x-2 ${
                activeTab === 'related'
                  ? 'border-orange-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Heart size={18} className={activeTab === 'related' ? 'text-orange-500' : 'text-gray-400'} />
              <span>{t('agentDetail.relatedRecommendations')}</span>
            </button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* What can you do with this Agent */}
                <section>
                  <h2 className="text-xl font-bold mb-4">{t('agentDetail.whatCanDo')}</h2>
                  <div className="bg-gray-900 rounded-lg p-6">
                    <p className="text-gray-300 leading-relaxed">{getAgentSystemRole(agent)}</p>
                  </div>
                </section>

                {/* Agent Demo */}
                <section>
                  <h2 className="text-xl font-bold mb-4">{t('agentDetail.agentDemo')}</h2>
                  <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                    {agent.demoMessages?.map((message, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden">
                            {isAvatarUrl(agent.avatar) ? (
                              <img 
                                src={getFullAvatarUrl(agent.avatar)} 
                                alt={getAgentName(agent)}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  const fallback = img.nextElementSibling as HTMLElement;
                                  if (fallback) {
                                    img.style.display = 'none';
                                    fallback.className = 'flex items-center justify-center w-full h-full';
                                  }
                                }}
                              />
                            ) : null}
                            <span className={isAvatarUrl(agent.avatar) ? 'hidden' : 'flex items-center justify-center w-full h-full'}>
                              {agent.avatar || getAgentName(agent)?.charAt(0) || 'A'}
                            </span>
                          </div>
                          <div className="flex-1 bg-gray-800 rounded-lg p-3">
                            <p className="text-white">{getAgentOpenSay(agent) || message.assistant}</p>
                          </div>
                        </div>
                        {index < (agent.demoMessages?.length || 0) - 1 && (
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                              U
                            </div>
                            <div className="flex-1 bg-blue-900 bg-opacity-50 rounded-lg p-3">
                              <p className="text-blue-200">{message.user}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )) || <p className="text-gray-400">{t('agentDetail.noDemo')}</p>}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-xl font-bold mb-4">{t('agentDetail.agentSettings')}</h2>
                  <div className="bg-gray-900 rounded-lg p-6">
                    <h3 className="font-medium mb-3">{t('agentDetail.systemPrompt')}</h3>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="prose prose-invert prose-sm max-w-none markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {getAgentSystemPromote(agent) || t('agentDetail.noSystemPrompt')}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-bold mb-4">{t('agentDetail.openingMessage')}</h2>
                  <div className="bg-gray-900 rounded-lg p-6">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-sm font-bold text-white overflow-hidden">
                          {isAvatarUrl(agent.avatar) ? (
                            <img 
                              src={getFullAvatarUrl(agent.avatar)} 
                              alt={getAgentName(agent)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  img.style.display = 'none';
                                  fallback.className = 'flex items-center justify-center w-full h-full';
                                }
                              }}
                            />
                          ) : null}
                          <span className={isAvatarUrl(agent.avatar) ? 'hidden' : 'flex items-center justify-center w-full h-full'}>
                            {agent.avatar || getAgentName(agent)?.charAt(0) || 'A'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-300 leading-relaxed">
                            {getAgentOpenSay(agent) || agent.demoMessages?.[0]?.assistant || (currentLanguage === 'en' ? `I'm ${getAgentName(agent)}, how can I help you?` : '我是' + getAgentName(agent) + '，有什么可以帮助您的吗？')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-bold mb-4 flex items-center">
                    <span>{t('agentDetail.openingQuestions')}</span>
                    <span className="ml-2 bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm">
                      {getQuestionsList(agent).length}
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {getQuestionsList(agent).length > 0 ? (
                      getQuestionsList(agent).map((question, index) => (
                        <div key={index} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                          <div className="flex items-start space-x-3">
                            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              ?
                            </div>
                            <p className="text-gray-300 leading-relaxed flex-1">
                              {question}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-gray-900 rounded-lg p-6 text-center">
                        <p className="text-gray-400">{t('agentDetail.noQuestions')}</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'capabilities' && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-xl font-bold mb-4">{t('agentDetail.capabilities')}</h2>
                  <div className="bg-gray-900 rounded-lg p-6">
                    <ul className="space-y-3">
                      {getAgentCapabilities(agent).length > 0 ? (
                        getAgentCapabilities(agent).map((capability, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                            <span className="text-gray-300">{capability}</span>
                          </li>
                        ))
                      ) : (
                        <p className="text-gray-400">{t('agentDetail.noCapabilities')}</p>
                      )}
                    </ul>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'related' && (
              <div className="space-y-6">
                <section>
                  <h2 className="text-xl font-bold mb-4">{t('agentDetail.relatedAgents')}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {agent.relatedAgents?.map((relatedAgent) => (
                      <AgentCard key={relatedAgent.id} agent={relatedAgent} />
                    )) || <p className="text-gray-400">{t('agentDetail.noRelatedAgents')}</p>}
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="font-bold mb-4">{t('agentDetail.useAgent')}</h3>
              <button 
                onClick={handleOpenInClient}
                disabled={isOpeningClient}
                className="w-full bg-orange-500 text-black py-3 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors mb-4 flex items-center justify-center disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isOpeningClient ? (
                  <>
                    <Loader2 size={20} className="animate-spin mr-2" />
                    {t('agentDetail.opening')}
                  </>
                ) : (
                  t('agentDetail.useInMcpx')
                )}
              </button>
              <Link
                to={`/chat?agent=${agent.id}`}
                target='_blank'
                onClick={() => {
                  // 调用API记录点击，增加使用次数
                  if (agent?.id) {
                    api.agent.trackActivity(String(agent.id));
                  }
                }}
                className="w-full inline-flex items-center justify-center py-3 px-4 rounded-lg font-medium border border-orange-500 text-orange-500 hover:bg-orange-500/10 transition-colors mb-4"
              >
                {t('agentDetail.useInMcpxWeb')}
              </Link>
              <p className="text-sm text-gray-400">
                {t('agentDetail.useAgentDesc')}
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="font-bold mb-4">{t('agentDetail.tags')}</h3>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(agent.tags) && agent.tags.length > 0 ? (
                  agent.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm">{t('agentDetail.noTags')}</span>
                )}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h3 className="font-bold mb-4">{t('agentDetail.statistics')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('agentDetail.usageCount')}</span>
                  <span className="text-white">{agent.usageLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('agentDetail.category')}</span>
                  <span className="text-white">{getCategoryDisplayName()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('agentDetail.publishTime')}</span>
                  <span className="text-white">{new Date(agent.publishTime).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}; 