import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Users, Code, Bug, Star, Gift, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

interface SubmissionData {
  type: 'blogger' | 'developer' | 'tester';
  content: string;
  link?: string;
  contact: string;
  description: string;
}

export const RewardsPage: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'info' | 'submit'>('info');
  const [selectedType, setSelectedType] = useState<'blogger' | 'developer' | 'tester'>('blogger');
  const [formData, setFormData] = useState<SubmissionData>({
    type: 'blogger',
    content: '',
    link: '',
    contact: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  const getRewardTypeDetails = (type: 'blogger' | 'developer' | 'tester') => {
    const detailsMap = {
      blogger: [
        t('rewards.types.blogger.details.0'),
        t('rewards.types.blogger.details.1'),
        t('rewards.types.blogger.details.2'),
        t('rewards.types.blogger.details.3')
      ],
      developer: [
        t('rewards.types.developer.details.0'),
        t('rewards.types.developer.details.1'),
        t('rewards.types.developer.details.2'),
        t('rewards.types.developer.details.3')
      ],
      tester: [
        t('rewards.types.tester.details.0'),
        t('rewards.types.tester.details.1'),
        t('rewards.types.tester.details.2'),
        t('rewards.types.tester.details.3')
      ]
    };
    return detailsMap[type];
  };

  const getRewardTypeRequirements = (type: 'blogger' | 'developer' | 'tester') => {
    const requirementsMap = {
      blogger: [
        t('rewards.types.blogger.requirements.0'),
        t('rewards.types.blogger.requirements.1'),
        t('rewards.types.blogger.requirements.2'),
        t('rewards.types.blogger.requirements.3')
      ],
      developer: [
        t('rewards.types.developer.requirements.0'),
        t('rewards.types.developer.requirements.1'),
        t('rewards.types.developer.requirements.2'),
        t('rewards.types.developer.requirements.3')
      ],
      tester: [
        t('rewards.types.tester.requirements.0'),
        t('rewards.types.tester.requirements.1'),
        t('rewards.types.tester.requirements.2'),
        t('rewards.types.tester.requirements.3')
      ]
    };
    return requirementsMap[type];
  };

  const rewardTypes = [
    {
      id: 'blogger' as const,
      title: t('rewards.types.blogger.title'),
      icon: Users,
      points: t('rewards.types.blogger.points'),
      description: t('rewards.types.blogger.description'),
      details: getRewardTypeDetails('blogger'),
      requirements: getRewardTypeRequirements('blogger')
    },
    {
      id: 'developer' as const,
      title: t('rewards.types.developer.title'),
      icon: Code,
      points: t('rewards.types.developer.points'),
      description: t('rewards.types.developer.description'),
      details: getRewardTypeDetails('developer'),
      requirements: getRewardTypeRequirements('developer')
    },
    {
      id: 'tester' as const,
      title: t('rewards.types.tester.title'),
      icon: Bug,
      points: t('rewards.types.tester.points'),
      description: t('rewards.types.tester.description'),
      details: getRewardTypeDetails('tester'),
      requirements: getRewardTypeRequirements('tester')
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 检查登录状态
    if (!isLoggedIn) {
      alert(t('rewards.messages.loginFirst'));
      navigate('/login', { state: { from: { pathname: location.pathname } } });
      return;
    }

    // 表单验证
    const validationErrors: string[] = [];

    // 验证联系方式（邮箱格式）
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^1[3-9]\d{9}$/;
    const wechatRegex = /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/;
    
    if (!formData.contact.trim()) {
      validationErrors.push(t('rewards.messages.validation.contactRequired'));
    } else if (!emailRegex.test(formData.contact) && !phoneRegex.test(formData.contact) && !wechatRegex.test(formData.contact)) {
      validationErrors.push(t('rewards.messages.validation.contactInvalid'));
    }

    // 验证详细描述长度
    if (!formData.description.trim()) {
      validationErrors.push(t('rewards.messages.validation.descriptionRequired'));
    } else if (formData.description.trim().length < 10) {
      validationErrors.push(t('rewards.messages.validation.descriptionTooShort'));
    } else if (formData.description.trim().length > 1000) {
      validationErrors.push(t('rewards.messages.validation.descriptionTooLong'));
    }

    // 验证链接（如果需要）
    const urlRegex = /^https?:\/\/.+/;
    if (selectedType === 'blogger' && formData.link) {
      if (!urlRegex.test(formData.link)) {
        validationErrors.push(t('rewards.messages.validation.linkInvalid'));
      }
    }
    
    if (selectedType === 'developer' && formData.link) {
      if (!formData.link.includes('github.com')) {
        validationErrors.push(t('rewards.messages.validation.githubLinkRequired'));
      } else if (!urlRegex.test(formData.link)) {
        validationErrors.push(t('rewards.messages.validation.githubLinkInvalid'));
      }
    }

    // 验证问题类型（测试反馈）
    if (selectedType === 'tester' && !formData.content) {
      validationErrors.push(t('rewards.messages.validation.issueTypeRequired'));
    }

    // 如果有验证错误，显示并停止提交
    if (validationErrors.length > 0) {
      alert(t('rewards.messages.submitFailed') + '\n' + validationErrors.join('\n'));
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 根据类型映射feedbackType
      let feedbackType = 0;
      switch (selectedType) {
        case 'blogger':
          feedbackType = 1; // 博主推广
          break;
        case 'developer':
          feedbackType = 2; // 开发贡献
          break;
        case 'tester':
          feedbackType = 3; // 测试反馈
          break;
      }

      // 构建提交数据
      const submitData = {
        contactInfo: formData.contact,
        contributionDescription: formData.description,
        detailedDescription: formData.description,
        feedbackType: feedbackType,
        githubForkUrl: selectedType === 'developer' ? formData.link : undefined,
        issueType: selectedType === 'tester' ? formData.content : undefined,
        releaseUrl: selectedType === 'blogger' ? formData.link : undefined
      };

      // 调用API提交
      const result = await api.feedback.submitFeedback(submitData);
      
      if (result.code === 200) {
        alert(t('rewards.messages.submitSuccess'));
        // 重置表单
        setFormData({
          type: selectedType,
          content: '',
          link: '',
          contact: '',
          description: ''
        });
      } else {
        // 直接显示后端返回的错误信息，不抛出新的Error
        const errorMsg = result.msg || result.message || t('rewards.messages.networkError');
        alert(errorMsg);
      }
    } catch (error: any) {
      console.error('提交失败:', error);
      
      // 提取具体的错误信息
      let errorMessage = t('rewards.messages.networkError');
      
      if (error && typeof error === 'object') {
        // 检查 axios 错误响应结构
        if (error.response && error.response.data) {
          const responseData = error.response.data;
          if (responseData.msg) {
            errorMessage = responseData.msg;
          } else if (responseData.message) {
            errorMessage = responseData.message;
          }
        }
        // 检查直接的错误字段
        else if (error.msg) {
          errorMessage = error.msg;
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSubmit = (type: 'blogger' | 'developer' | 'tester') => {
    setSelectedType(type);
    setActiveTab('submit');
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSubmissionForm = () => {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">{t('rewards.form.selectType')}</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rewardTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`p-4 rounded-lg border text-left ${
                  selectedType === type.id
                    ? 'border-orange-500 bg-gray-800'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center mb-2">
                  <type.icon size={20} className="mr-2" />
                  <span className="font-medium">{type.title}</span>
                </div>
                <p className="text-sm text-gray-400">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {selectedType === 'blogger' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">{t('rewards.form.blogLink')} {t('rewards.form.required')}</label>
              <input
                type="url"
                required
                value={formData.link}
                onChange={(e) => setFormData({...formData, link: e.target.value})}
                placeholder={t('rewards.form.blogLinkPlaceholder')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('rewards.form.contentDescription')} {t('rewards.form.required')}</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder={t('rewards.form.contentDescriptionPlaceholder')}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
              />
              <div className="text-sm text-gray-400 mt-1">
                {formData.description.length}/1000 {t('rewards.form.charactersCount')}
              </div>
            </div>
          </>
        )}

        {selectedType === 'developer' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">{t('rewards.form.githubLink')} {t('rewards.form.required')}</label>
              <input
                type="url"
                required
                value={formData.link}
                onChange={(e) => setFormData({...formData, link: e.target.value})}
                placeholder={t('rewards.form.githubLinkPlaceholder')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('rewards.form.contributionDescription')} {t('rewards.form.required')}</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder={t('rewards.form.contributionDescriptionPlaceholder')}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
              />
              <div className="text-sm text-gray-400 mt-1">
                {formData.description.length}/1000 {t('rewards.form.charactersCount')}
              </div>
            </div>
          </>
        )}

        {selectedType === 'tester' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">{t('rewards.form.issueType')}</label>
              <select
                value={formData.content}
                onChange={(e) => setFormData({...formData, content: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
              >
                <option value="">{t('rewards.form.issueTypePlaceholder')}</option>
                <option value="bug_report">{t('rewards.form.issueTypes.bugReport')}</option>
                <option value="feature_suggestion">{t('rewards.form.issueTypes.featureSuggestion')}</option>
                <option value="performance_optimization">{t('rewards.form.issueTypes.performanceOptimization')}</option>
                <option value="ui_improvement">{t('rewards.form.issueTypes.uiImprovement')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('rewards.form.detailedDescription')} {t('rewards.form.required')}</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder={t('rewards.form.detailedDescriptionPlaceholder')}
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
              />
              <div className="text-sm text-gray-400 mt-1">
                {formData.description.length}/1000 {t('rewards.form.charactersCount')}
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">{t('rewards.form.contactInfo')} {t('rewards.form.required')}</label>
          <input
            type="text"
            required
            value={formData.contact}
            onChange={(e) => setFormData({...formData, contact: e.target.value})}
            placeholder={t('rewards.form.contactInfoPlaceholder')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-orange-500"
          />
          <div className="text-sm text-gray-400 mt-1">
            {t('rewards.form.contactInfoNote')}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {isSubmitting ? t('rewards.form.submitting') : t('rewards.form.submit')}
        </button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 flex items-center justify-center">
              <Gift size={36} className="mr-3 text-orange-500" />
              {t('rewards.title')}
            </h1>
            <p className="text-xl text-gray-300">
              {t('rewards.subtitle')}
            </p>
            <p className="text-gray-400 mt-2">
              {t('rewards.pointsExchange')}
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-900 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'info'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('rewards.rewardDescription')}
              </button>
              <button
                onClick={() => setActiveTab('submit')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'submit'
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('rewards.submitApplication')}
              </button>
            </div>
          </div>

          {activeTab === 'info' ? (
            /* 奖励说明内容 */
            <div className="space-y-8">
              {rewardTypes.map((type) => (
                <div key={type.id} className="bg-gray-900 rounded-xl p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center">
                      <div className="bg-orange-500/20 p-3 rounded-lg mr-4">
                        <type.icon size={24} className="text-orange-500" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold mb-2">{type.title}</h2>
                        <p className="text-gray-400">{type.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-500">{type.points}</div>
                      <div className="text-sm text-gray-400">{t('rewards.pointsReward')}</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <Star size={20} className="mr-2 text-orange-500" />
                        {t('rewards.rewardDetails')}
                      </h3>
                      <ul className="space-y-2">
                        {type.details.map((detail, i) => (
                          <li key={i} className="flex items-start">
                            <ArrowRight size={16} className="mr-2 mt-0.5 text-orange-500 flex-shrink-0" />
                            <span className="text-gray-300">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">{t('rewards.requirements')}</h3>
                      <ul className="space-y-2">
                        {type.requirements.map((req, i) => (
                          <li key={i} className="flex items-start">
                            <ArrowRight size={16} className="mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-400">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <button
                      onClick={() => handleQuickSubmit(type.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center"
                    >
                      {t('rewards.applyNow')} {type.title}
                      <ArrowRight size={16} className="ml-2" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('rewards.pointsExchangeInfo.title')}</h2>
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="text-xl font-bold text-orange-500">{t('rewards.pointsExchangeInfo.pointsValue')}</div>
                    <div className="text-gray-300">{t('rewards.pointsExchangeInfo.cashValue')}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="text-xl font-bold text-orange-500">{t('rewards.pointsExchangeInfo.minExchange')}</div>
                    <div className="text-gray-300">{t('rewards.pointsExchangeInfo.minPoints')}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4">
                    <div className="text-xl font-bold text-orange-500">{t('rewards.pointsExchangeInfo.exchangeCycle')}</div>
                    <div className="text-gray-300">{t('rewards.pointsExchangeInfo.exchangeDate')}</div>
                  </div>
                </div>
                <p className="text-gray-400">
                  {t('rewards.pointsExchangeInfo.notice')}
                </p>
                <p className="text-gray-400">
                  {t('rewards.pointsExchangeInfo.communityNote')}
                </p>
                <p className="text-white-400 font-bold text-lg">
                  {t('rewards.pointsExchangeInfo.warning')}
                </p>
              </div>
            </div>
          ) : (
            /* 提交申请表单 */
            <div className="max-w-3xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-8">
                <h2 className="text-2xl font-bold mb-6">{t('rewards.submitApplication')}</h2>
                
                {!isLoggedIn && (
                  <div className="bg-orange-500/20 border border-orange-500 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <div className="text-orange-500 mr-3">⚠️</div>
                      <div>
                        <p className="text-orange-400 font-medium">{t('rewards.loginRequired.title')}</p>
                        <p className="text-gray-300 text-sm mt-1">
                          {t('rewards.loginRequired.description')}
                          <button
                            onClick={() => navigate('/login', { state: { from: { pathname: location.pathname } } })}
                            className="text-orange-400 hover:text-orange-300 underline mx-1"
                          >
                            {t('rewards.loginRequired.loginText')}
                          </button> 
                          {t('rewards.loginRequired.afterLogin')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {renderSubmissionForm()}
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}; 