import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createApp } from '../services/appBuildApi';
import { toast } from '../utils/toast';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CreateAppForm {
  initPrompt: string;
}

// 生成类型选择已取消

const examplePrompts = [
  {
    title: '个人作品集网站',
    prompt: '创建一个个人作品集网站，包含首页、关于我、项目展示、技能介绍和联系方式页面。使用现代简洁的设计风格，响应式布局，深色主题。',
  },
  {
    title: '公司官网',
    prompt: '设计一个科技公司官网，包含公司介绍、产品服务、团队介绍、新闻动态和联系我们。采用专业的商务风格，蓝白色调，包含轮播图和产品卡片。',
  },
  {
    title: '餐厅网站',
    prompt: '制作一个餐厅网站，展示菜单、餐厅环境、预订功能和联系信息。温馨的设计风格，美食图片展示，在线订餐功能。',
  },
  {
    title: '在线学习平台',
    prompt: '构建一个在线学习平台，包含课程列表、课程详情、学习进度、用户中心。现代化的教育风格设计，课程卡片布局。',
  },
];

export const NewAppPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentLanguage } = useLanguage();
  const [form, setForm] = useState<CreateAppForm>({
    initPrompt: '',
  });
  const [creating, setCreating] = useState(false);
  const userId = localStorage.getItem('userId');

  // 检查登录状态
  useEffect(() => {
    if (!userId) {
      navigate('/login', { state: { from: location } });
    }
  }, [userId, navigate, location]);

  // 创建应用执行逻辑（提交和回车复用）
  const handleCreate = async () => {
    if (!form.initPrompt.trim()) {
      toast.error(currentLanguage === 'zh' ? '请输入初始提示词' : 'Please enter an initial prompt');
      return;
    }
    if (!userId) {
      toast.error(currentLanguage === 'zh' ? '请先登录' : 'Please login first');
      navigate('/login', { state: { from: location } });
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const response = await createApp({
        initPrompt: form.initPrompt.trim(),
        message: form.initPrompt.trim(),
        userId,
      });
      if (response.code === 200 && response.data) {
        toast.success(currentLanguage === 'zh' ? '应用创建成功' : 'App created successfully');
        navigate(`/app/build/${response.data}`);
      } else {
        toast.error((currentLanguage === 'zh' ? '创建失败: ' : 'Create failed: ') + response.message);
      }
    } catch (error) {
      console.error(currentLanguage === 'zh' ? '创建应用失败:' : 'Create app failed:', error);
      toast.error(currentLanguage === 'zh' ? '创建失败，请重试' : 'Creation failed, please retry');
    } finally {
      setCreating(false);
    }
  };

  // 表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleCreate();
  };

  // 使用示例提示词
  const useExamplePrompt = (prompt: string) => {
    setForm(prev => ({ ...prev, initPrompt: prompt }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 text-slate-800">
      {/* 顶部导航 */}
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft size={20} />
                {currentLanguage === 'zh' ? '返回' : 'Back'}
              </button>
              <h1 className="text-2xl font-bold">{currentLanguage === 'zh' ? '创建新应用' : 'Create New App'}</h1>
            </div>
            <button
              onClick={() => navigate('/my-apps')}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              {currentLanguage === 'zh' ? '我的应用' : 'My Apps'}
            </button>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 顶部提示文字（突出显示，居中） */}
          <h2 className="text-center text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {currentLanguage === 'zh' ? '一句话，生成你的网站' : 'One sentence, build your website'}
          </h2>
          <p className="text-center text-base md:text-lg text-slate-700">
            {currentLanguage === 'zh' ? '用自然语言描述你的需求即可开始。写得越详细，结果越贴近你的想法。' : 'Describe your needs in natural language to get started. The more details, the closer the results match your idea.'}
          </p>

          {/* 对话输入框（突出显示为对话气泡风格） */}
          {/* <label className="block text-sm font-medium text-slate-700">
            初始提示词
          </label> */}
          <div className="relative overflow-visible">
                <textarea
                  value={form.initPrompt}
                  onChange={(e) => setForm(prev => ({ ...prev, initPrompt: e.target.value }))}
              placeholder={currentLanguage === 'zh' ? '一句话生成网站：例如 创建一个个人作品集网站，包含首页、项目、关于我、联系方式，深色科技风，支持移动端。' : 'One sentence to build: e.g., Create a personal portfolio site with Home, Projects, About, Contact; dark tech style; responsive.'}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm"
              rows={5}
                  maxLength={1000}
                  required
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                />
            <button
              type="submit"
              disabled={creating || !form.initPrompt.trim()}
              className="absolute bottom-3 right-3 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {creating ? (currentLanguage === 'zh' ? '创建中...' : 'Creating...') : (currentLanguage === 'zh' ? '创建应用' : 'Create App')}
            </button>
              </div>

          {/* 示例提示词（以气泡/按钮样式展示） */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-3">示例提示词</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {examplePrompts.map((example, index) => (
                <button
                  type="button"
                      key={index}
                  className="text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
                      onClick={() => useExamplePrompt(example.prompt)}
                    >
                  <h4 className="text-sm font-medium mb-1">{example.title}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2">{example.prompt.substring(0, 100)}...</p>
                </button>
              ))}
            </div>
          </div>

          {/* 底部操作已取消取消按钮 */}
        </form>
      </div>
    </div>
  );
};
