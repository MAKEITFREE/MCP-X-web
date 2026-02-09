import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { SearchBar } from '../components/ui/SearchBar';
import { AgentCard } from '../components/ui/AgentCard';
import { mockAgents } from '../data/agents';
import { Agent, AgentCategory } from '../types';
import { api } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  List, 
  Code, 
  Briefcase, 
  FileText, 
  GraduationCap, 
  BookOpen, 
  Languages, 
  Heart, 
  Building2, 
  Palette, 
  Gamepad2, 
  Home, 
  Music, 
  FolderOpen,
  Wrench,
  Building
} from 'lucide-react';

export const AgentPage: React.FC = () => {
  const { t, currentLanguage } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL_CATEGORIES');
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [allAgentsTotalCount, setAllAgentsTotalCount] = useState(0); // 存储所有agents的总数
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [categoryCounts, setCategoryCounts] = useState<Record<number, number>>({});
  
  const navigate = useNavigate();
  const location = useLocation();

  // 获取分类名称（支持多语言）
  const getCategoryName = (category: AgentCategory) => {
    return currentLanguage === 'en' && category.nameEn ? category.nameEn : category.name;
  };

  // 获取当前选中分类的显示名称（根据语言）
  const getSelectedCategoryDisplayName = (): string => {
    if (selectedCategory === 'ALL_CATEGORIES') return t('agentPage.allCategories');
    const matched = categories.find((c) => c.name === selectedCategory);
    return matched ? getCategoryName(matched) : selectedCategory;
  };



  // 获取分类图标的函数 - 使用Lucide React图标
  const getCategoryIcon = (category: AgentCategory) => {
    console.log('分类图标数据:', { name: category.name, category });
    
    // 根据分类名称映射Lucide React图标组件
    const iconMap: Record<string, React.ComponentType<any>> = {
      '全部': List,
      '编程': Code,
      '职业': Briefcase,
      '文案': FileText,
      '教育': GraduationCap,
      '学术': BookOpen,
      '翻译': Languages,
      '情感': Heart,
      '商业': Building2,
      '设计': Palette,
      '游戏': Gamepad2,
      '生活': Home,
      '娱乐': Music,
      '通用': FolderOpen,
      '专业服务': Wrench,
      '办公': Building
    };
    
    // 返回对应的图标组件，如果没找到则返回默认图标
    const IconComponent = iconMap[category.name] || FolderOpen;
    return <IconComponent size={16} className="text-current" />;
  };

  // 初始化数据
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        
        // 先获取分类列表
        const categoriesRes = await api.agent.getCategories();
        let loadedCategories: AgentCategory[] = [];
        
        if (categoriesRes.code === 200) {
          // 适配新的API结构: { code: 200, data: { total: 5, categories: [...] } }
          let categoriesData = [];
          if (categoriesRes.data && (categoriesRes.data as any).categories) {
            // 新格式: { data: { total: 5, categories: [...] } }
            categoriesData = (categoriesRes.data as any).categories;
          } else if (Array.isArray(categoriesRes.data)) {
            // 旧格式: { data: [...] }
            categoriesData = categoriesRes.data;
          }
          console.log('分类API返回数据:', categoriesRes.data);
          
          // 确保是数组并且只取状态为1的分类
          if (Array.isArray(categoriesData)) {
            const activeCategories = categoriesData.filter(cat => cat.status === 1);
            loadedCategories = activeCategories;
            setCategories(activeCategories);
            console.log('加载的分类:', activeCategories);
          } else {
            console.warn('API返回的categories数据不是数组:', categoriesData);
            setCategories([]);
          }
        }
        
        // 获取当前页的Agent列表（用于显示）
        const categoryInfo = selectedCategory !== 'ALL_CATEGORIES' ? loadedCategories.find(c => c.name === selectedCategory) : null;
        const agentsRes = await api.agent.getList({ 
          pageNum: currentPage, 
          pageSize,
          ...(categoryInfo && { categoryId: categoryInfo.id })
        });
        
        // 如果API返回了每个分类的agentCount，直接计算总数
        if (loadedCategories.length > 0 && loadedCategories.every(cat => cat.agentCount !== undefined)) {
          const calculatedTotal = loadedCategories.reduce((sum, cat) => sum + (cat.agentCount || 0), 0);
          setAllAgentsTotalCount(calculatedTotal);
          console.log('从分类agentCount计算的总数:', calculatedTotal);
        } else {
          // 否则通过API获取所有Agent数据的总数
          const allAgentsCountRes = await api.agent.getList({ 
            pageNum: 1, 
            pageSize: 1 // 只需要获取总数，不需要具体数据
          });
          
          if (allAgentsCountRes.code === 200) {
            let allTotal = 0;
            try {
              if (allAgentsCountRes.data && (allAgentsCountRes.data as any).total) {
                allTotal = (allAgentsCountRes.data as any).total;
              } else if ((allAgentsCountRes as any).total) {
                allTotal = (allAgentsCountRes as any).total;
              }
            } catch (e) {
              console.error('解析总数失败:', e);
            }
            setAllAgentsTotalCount(allTotal);
            console.log('从API获取的总数:', allTotal);
          }
        }
        
        // 如果API没有返回agentCount，才需要获取所有Agent数据来计算分类数量
        let shouldCalculateCounts = false;
        if (loadedCategories.length > 0) {
          shouldCalculateCounts = loadedCategories.some(cat => cat.agentCount === undefined);
        }
        
        let allAgentsRes = null;
        if (shouldCalculateCounts) {
          allAgentsRes = await api.agent.getList({ 
            pageNum: 1, 
            pageSize: 1000 // 获取大量数据来计算分类数量
          });
        }
        
        console.log('Agent API返回数据:', agentsRes);
        if (agentsRes.code === 200) {
          // 根据真实API数据结构，安全地访问数据
          // 可能的数据结构：agentsRes.data.rows 或 agentsRes.data 或直接 agentsRes.rows
          let agents = [];
          let total = 0;
          
                     try {
             if (agentsRes.data && (agentsRes.data as any).rows) {
               // 标准格式：{ code: 200, data: { rows: [...], total: 506 } }
               agents = (agentsRes.data as any).rows;
               total = (agentsRes.data as any).total || 0;
             } else if (agentsRes.data && Array.isArray(agentsRes.data)) {
               // 简单格式：{ code: 200, data: [...] }
               agents = agentsRes.data;
               total = agents.length;
             } else if ((agentsRes as any).rows) {
               // 直接格式：{ code: 200, rows: [...], total: 506 }
               agents = (agentsRes as any).rows;
               total = (agentsRes as any).total || 0;
             } else {
               console.warn('未识别的API数据结构:', agentsRes);
               agents = [];
               total = 0;
             }
           } catch (e) {
             console.error('解析API数据失败:', e);
             agents = [];
             total = 0;
           }
          
          console.log('处理后的agents数据:', agents, '总数:', total);
          console.log('agents类型检查:', typeof agents, Array.isArray(agents));
          
          setTotalCount(total);
          
          // 确保是数组
          if (Array.isArray(agents)) {
            console.log('第一个agent数据示例:', agents[0]);
            // 为Agent添加分类名称
            const agentsWithCategoryNames = agents.map((agent: any) => {
              // 确保tags是数组，处理字符串格式的tags
              let tags = [];
              try {
                if (Array.isArray(agent.tags)) {
                  tags = agent.tags;
                } else if (typeof agent.tags === 'string') {
                  // 处理逗号分隔的tags字符串 "游戏, GitHub" -> ["游戏, GitHub"]
                  tags = agent.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
                } else {
                  tags = [];
                }
              } catch (e) {
                console.warn('解析tags失败:', agent.tags);
                tags = [];
              }
              
              return {
                ...agent,
                tags: tags,
                categoryName: loadedCategories.find(cat => cat.id === agent.categoryId)?.name || '未分类',
                usageLabel: agent.usageLabel || `${agent.usageCount || 0}`,
                verified: agent.status === 1,
                new: agent.isFeatured === 1
              };
            });
            console.log('处理后的agentsWithCategoryNames:', agentsWithCategoryNames[0]);
            setAllAgents(agentsWithCategoryNames);
          } else {
            console.warn('API返回的agents数据不是数组:', agents);
            setAllAgents([]);
          }
        }
        
        // 计算分类数量（仅在API没有返回agentCount时）
        if (allAgentsRes && allAgentsRes.code === 200) {
          let allAgentsData = [];
          try {
            if (allAgentsRes.data && (allAgentsRes.data as any).rows) {
              allAgentsData = (allAgentsRes.data as any).rows;
            } else if (allAgentsRes.data && Array.isArray(allAgentsRes.data)) {
              allAgentsData = allAgentsRes.data;
            } else if ((allAgentsRes as any).rows) {
              allAgentsData = (allAgentsRes as any).rows;
            }
          } catch (e) {
            console.error('解析全部agents数据失败:', e);
          }
          
          if (Array.isArray(allAgentsData)) {
            const counts: Record<number, number> = {};
            allAgentsData.forEach((agent: any) => {
              counts[agent.categoryId] = (counts[agent.categoryId] || 0) + 1;
            });
            setCategoryCounts(counts);
          }
        }
        
      } catch (error) {
        console.error('获取数据失败:', error);
        // 使用模拟数据作为回退
        setAllAgents(mockAgents);
      } finally {
        setLoading(false);
      }
    };
    
    initData();
  }, [currentPage, pageSize, selectedCategory]);

  // 根据URL参数恢复搜索状态
  useEffect(() => {
    const handleURLChange = async () => {
      if (allAgents.length > 0) {
        const params = new URLSearchParams(location.search);
        const q = params.get('q') || '';
        const category = params.get('category') || 'ALL_CATEGORIES';
        
        setSearchQuery(q);
        setSelectedCategory(category);
        
        await filterAgents(q, category);
      }
    };
    handleURLChange();
  }, [location.search, allAgents]);

  // 筛选Agent
  const filterAgents = async (query: string, category: string) => {
    console.log('filterAgents 调用:', { query, category });
    
    try {
      setLoading(true);
      let agents = [];
      let total = 0;
      
      // 获取分类信息
      const categoryInfo = category !== 'ALL_CATEGORIES' ? categories.find(c => c.name === category) : null;
      
      if (query.trim()) {
        // 有关键词时，调用search接口
        const params: any = {
          pageNum: currentPage,
          pageSize,
        };
        if (categoryInfo) params.categoryId = categoryInfo.id;
        
        const res = await api.agent.search(query, params);
        if (res && (res as any).rows) {
          agents = (res as any).rows;
          total = (res as any).total || 0;
        } else if (Array.isArray(res)) {
          agents = res;
          total = agents.length;
        }
        console.log(`搜索关键词 ${query} 结果数量:`, agents.length);
      } else {
        // 没有关键词时，按分类筛选本地数据
        if (!Array.isArray(allAgents) || allAgents.length === 0) {
          console.warn('allAgents 不是数组或为空:', allAgents);
          setFilteredAgents([]);
          return;
        }
        
        agents = [...allAgents];
        if (categoryInfo) {
          agents = agents.filter(agent => agent.categoryId === categoryInfo.id);
          console.log(`按分类 ${category} 筛选后数量:`, agents.length);
        }
        total = agents.length;
      }
      
      // 处理tags和categoryName
      const agentsWithCategoryNames = agents.map((agent: any) => {
        let tags = [];
        try {
          if (Array.isArray(agent.tags)) {
            tags = agent.tags;
          } else if (typeof agent.tags === 'string') {
            tags = agent.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
          }
        } catch {
          tags = [];
        }
        return {
          ...agent,
          tags,
          categoryName: categories.find(cat => cat.id === agent.categoryId)?.name || '未分类',
          usageLabel: agent.usageLabel || `${agent.usageCount || 0}`,
          verified: agent.status === 1,
          new: agent.isFeatured === 1
        };
      });
      
      console.log('最终筛选结果数量:', agentsWithCategoryNames.length);
      setFilteredAgents(agentsWithCategoryNames);
      if (query.trim()) {
        setTotalCount(total); // 只有搜索时才更新总数
      }
    } catch (error) {
      console.error('筛选Agent失败:', error);
      setFilteredAgents([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedCategory !== 'ALL_CATEGORIES') params.set('category', selectedCategory);
    navigate(`/agent?${params.toString()}`);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1); // 重置页码到第一页
    setTotalCount(allAgentsTotalCount); // 重置总数为全部agents的总数
    const params = new URLSearchParams();
    if (selectedCategory !== 'ALL_CATEGORIES') params.set('category', selectedCategory);
    navigate(`/agent?${params.toString()}`);
  };

  // 选择分类
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1); // 重置到第一页
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (category !== 'ALL_CATEGORIES') params.set('category', category);
    navigate(`/agent?${params.toString()}`);
  };



  // 处理分页变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 重新加载当前页数据
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };



  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {t('agentPage.title')}
          </h1>
          {/* <p className="text-xl text-gray-300 mb-2">
            发现和使用最佳的智能助手
          </p> */}
          <p className="text-gray-400 mb-8">
            {t('agentPage.subtitle')}
          </p>
          
          <div className="w-full max-w-2xl mx-auto mb-8">
            <SearchBar 
              onSearch={handleSearch}
              searchQuery={searchQuery}
              onClear={handleClearSearch}
              placeholder={t('agentPage.searchPlaceholder')}
            />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Categories */}
          <div className="w-full lg:w-64 space-y-2">
            <div className="mb-6">
              <span className="text-sm text-gray-400 uppercase tracking-wider font-medium">
                {t('agentPage.categoryFilter')}
              </span>
            </div>
            
            <button
              onClick={() => handleCategorySelect('ALL_CATEGORIES')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 ${
                selectedCategory === 'ALL_CATEGORIES'
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <List size={16} className="text-current" />
                <span className="font-medium">{t('agentPage.allCategories')}</span>
              </div>
              <span className={`text-sm px-2 py-1 rounded-full ${
                selectedCategory === 'ALL_CATEGORIES' 
                  ? 'bg-orange-500/30 text-orange-300' 
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {allAgentsTotalCount}
              </span>
            </button>
            
            {categories.map((category) => {
              // 优先使用API返回的agentCount，否则使用计算的数量
              const agentCount = category.agentCount !== undefined ? category.agentCount : (categoryCounts[category.id] || 0);
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.name)}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200 ${
                    selectedCategory === category.name
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getCategoryIcon(category)}</span>
                    <span className="font-medium">{getCategoryName(category)}</span>
                  </div>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    selectedCategory === category.name 
                      ? 'bg-orange-500/30 text-orange-300' 
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {agentCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="text-orange-500 hover:text-orange-400 text-sm"
                  >
                    {t('agentPage.backButton')}
                  </button>
                )}
                <span className="text-gray-400">
                  {searchQuery
                    ? `${t('agentPage.searchResults')} "${searchQuery}" ${t('agentPage.searchResultsFor')}`
                    : getSelectedCategoryDisplayName()}
                </span>
              </div>
              {/* <span className="text-sm text-gray-500">
                共 {filteredAgents.length} 个助手
              </span> */}
            </div>

            {/* Agent Grid */}
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-400">{t('loading')}</p>
              </div>
            ) : filteredAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">{t('agentPage.notFound')}</h3>
                <p className="text-gray-400 mb-4">
                  {t('agentPage.notFoundDesc')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL_CATEGORIES');
                    navigate('/agent');
                  }}
                  className="bg-orange-500 text-black px-6 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  {t('agentPage.viewAllAgents')}
                </button>
              </div>
            )}

            {/* 分页组件 */}
            {!loading && totalCount > pageSize && (
              <div className="flex justify-center items-center mt-12 space-x-2">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === 1
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {t('agentPage.previousPage')}
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, Math.ceil(totalCount / pageSize)) }, (_, i) => {
                    const pageNum = i + 1;
                    const totalPages = Math.ceil(totalCount / pageSize);
                    
                    // 显示当前页面附近的页码
                    let showPage = pageNum;
                    if (totalPages > 5) {
                      if (currentPage <= 3) {
                        showPage = pageNum;
                      } else if (currentPage >= totalPages - 2) {
                        showPage = totalPages - 4 + pageNum;
                      } else {
                        showPage = currentPage - 2 + pageNum;
                      }
                    }
                    
                    if (showPage > totalPages || showPage < 1) return null;
                    
                    return (
                      <button
                        key={showPage}
                        onClick={() => handlePageChange(showPage)}
                        className={`px-3 py-2 rounded-lg ${
                          currentPage === showPage
                            ? 'bg-orange-500 text-black'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {showPage}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(Math.min(Math.ceil(totalCount / pageSize), currentPage + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                  className={`px-4 py-2 rounded-lg ${
                    currentPage >= Math.ceil(totalCount / pageSize)
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  {t('agentPage.nextPage')}
                </button>
                
                <span className="text-gray-400 ml-4">
                  {t('agentPage.pageInfo').replace('{current}', currentPage.toString()).replace('{total}', Math.ceil(totalCount / pageSize).toString())}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}; 