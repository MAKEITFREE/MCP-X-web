import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { getMyApps, deleteApp, formatCodeGenType, type AppInfo } from '../services/appBuildApi';
import { toast } from '../utils/toast';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit3, 
  Trash2, 
  Calendar,
  Code,
  ExternalLink,
  MoreVertical
} from 'lucide-react';

interface AppsListResponse {
  rows: AppInfo[];
  total: number;
  code: number;
  msg: string;
}

export const MyAppsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLanguage, t } = useLanguage();
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 12,
    total: 0,
  });
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const userId = localStorage.getItem('userId');

  // 检查登录状态
  useEffect(() => {
    if (!userId) {
      navigate('/login', { state: { from: location } });
    }
  }, [userId, navigate, location]);

  // 加载应用列表
  const loadApps = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const params = {
        pageNum: page,
        pageSize: pagination.pageSize,
        appName: search || undefined,
        sortField: 'createTime',
        sortOrder: 'desc',
        isDelete: 0,
      };

      const response = await getMyApps(params);
      if (response.code === 200) {
        // 后端直接返回了 total 和 rows，不是嵌套在 data 中
        setApps(response.rows || []);
        setPagination(prev => ({
          ...prev,
          current: page, // 后端没有返回 current，使用请求的页码
          total: response.total || 0,
        }));
      } else {
        toast.error('加载失败: ' + (response.msg || '未知错误'));
      }
    } catch (error) {
      console.error('加载应用列表失败:', error);
      toast.error('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 搜索处理
  const handleSearch = () => {
    loadApps(1, searchQuery);
  };

  // 删除应用
  const handleDelete = async (appId: string, appName: string) => {
    if (!window.confirm(`确定要删除应用"${appName}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await deleteApp(appId);
      if (response.code === 200) {
        toast.success('删除成功');
        loadApps(pagination.current, searchQuery);
      } else {
        toast.error('删除失败: ' + response.message);
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    }
  };

  // 格式化时间
  const formatTime = (timeString: string) => {
    try {
      return new Date(timeString).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeString;
    }
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    loadApps(page, searchQuery);
  };

  // 初始化
  useEffect(() => {
    loadApps();
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* 顶部导航 */}
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/app/new')}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                {currentLanguage === 'zh' ? '返回' : 'Back'}
              </button>
              <h1 className="text-2xl font-bold">{currentLanguage === 'zh' ? '我的应用' : 'My Apps'}</h1>
            </div>
            <button
              onClick={() => navigate('/app/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={20} />
              {currentLanguage === 'zh' ? '创建新应用' : 'Create New App'}
            </button>
          </div>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={currentLanguage === 'zh' ? '搜索应用名称...' : 'Search app name...'}
              className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors shadow-sm"
          >
            {currentLanguage === 'zh' ? '搜索' : 'Search'}
          </button>
        </div>

        {/* 应用列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📱</div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">{currentLanguage === 'zh' ? '还没有应用' : 'No apps yet'}</h3>
            <p className="text-slate-600 mb-6">{currentLanguage === 'zh' ? '创建你的第一个AI生成的网站应用' : 'Create your first AI‑generated website app'}</p>
            <button
              onClick={() => navigate('/app/new')}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              {currentLanguage === 'zh' ? '创建新应用' : 'Create New App'}
            </button>
          </div>
        ) : (
          <>
            {/* 应用网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* 应用封面 */}
                  <div className="h-32 bg-gradient-to-br from-blue-500 to-indigo-600 relative">
                    {app.cover ? (
                      <img
                        src={app.cover}
                        alt={app.appName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Code className="h-12 w-12 text-white opacity-80" />
                      </div>
                    )}
                    
                    {/* 操作菜单 */}
                    <div className="absolute top-2 right-2">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(activeDropdown === app.id ? null : app.id);
                          }}
                          className="p-1.5 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
                        >
                          <MoreVertical className="h-4 w-4 text-white" />
                        </button>
                        
                        {activeDropdown === app.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-10">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  navigate(`/app/build/${app.id}`);
                                  setActiveDropdown(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                              >
                                <Eye size={16} />
                                查看/编辑
                              </button>
                              {app.deployKey && (
                                <button
                                  onClick={() => {
                                    // 打开预览链接
                                    window.open(`/dist/${app.deployKey}/index.html`, '_blank');
                                    setActiveDropdown(null);
                                  }}
                                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                >
                                  <ExternalLink size={16} />
                                  预览网站
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  handleDelete(app.id, app.appName);
                                  setActiveDropdown(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                                删除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 生成类型标签 */}
                    <div className="absolute bottom-2 left-2">
                      <span className="px-2 py-1 text-xs bg-white/20 text-white rounded-full backdrop-blur-sm">
                        {formatCodeGenType(app.codeGenType)}
                      </span>
                    </div>
                  </div>

                  {/* 应用信息 */}
                  <div className="p-4">
                    <h3 className="font-medium mb-2 line-clamp-1">
                      {app.appName}
                    </h3>
                    
                    {app.initPrompt && (
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {app.initPrompt}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        <span>{formatTime(app.createTime)}</span>
                      </div>
                      {app.deployedTime && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>已部署</span>
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => navigate(`/app/build/${app.id}`)}
                        className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        进入编辑
                      </button>
                      {app.deployKey && (
                        <button
                          onClick={() => window.open(`/dist/${app.deployKey}/index.html`, '_blank')}
                          className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {pagination.total > pagination.pageSize && (
              <div className="flex justify-center mt-8">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.current - 1)}
                    disabled={pagination.current <= 1}
                    className="px-3 py-1 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  
                  <span className="px-4 py-1 text-sm text-slate-600">
                    第 {pagination.current} 页，共 {Math.ceil(pagination.total / pagination.pageSize)} 页
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
                    className="px-3 py-1 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
