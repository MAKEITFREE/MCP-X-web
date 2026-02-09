import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Wallet, CreditCard, Calendar, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { api, tokenUtils } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

interface BalanceData {
  userBalance: number;
  userPlan: string;
}

export const BalancePage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const hasToken = tokenUtils.hasToken();
      if (!hasToken) {
        navigate('/login', { state: { from: { pathname: location.pathname } } });
        return;
      }
      
      const isValid = await tokenUtils.silentCheck();
      if (!isValid) {
        navigate('/login', { state: { from: { pathname: location.pathname } } });
        return;
      }
      
      // 如果已登录，加载余额数据
      fetchBalanceData();
    };
    
    checkAuth();
  }, [navigate, location]);

  // 获取余额和套餐信息
  const fetchBalanceData = async () => {
    try {
      setLoading(true);
      const response = await api.payment.getMyBalanceAndPlan();
      
      if (response.code === 200 && response.data) {
        setBalanceData(response.data);
      }
    } catch (error) {
      console.error('获取余额信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取套餐显示名称
  const getPlanDisplayName = (plan: string) => {
    const planMap: Record<string, string> = {
      'free': t('balance.plans.free'),
      'pro': t('balance.plans.pro'),
      'vip': t('balance.plans.vip'),
      'enterprise': t('balance.plans.enterprise')
    };
    return planMap[plan?.toLowerCase()] || plan || t('balance.plans.free');
  };

  // 获取套餐颜色
  const getPlanColor = (plan: string) => {
    const colorMap: Record<string, string> = {
      'free': 'text-gray-600 bg-gray-100',
      'pro': 'text-orange-600 bg-orange-100',
      'vip': 'text-purple-600 bg-purple-100',
      'enterprise': 'text-blue-600 bg-blue-100'
    };
    return colorMap[plan?.toLowerCase()] || 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">{t('balance.title')}</h1>
            <p className="text-xl text-gray-300">
              {t('balance.subtitle')}
            </p>
          </div>
          
          {/* 刷新按钮 */}
          <div className="flex justify-end mb-6">
            <button
              onClick={fetchBalanceData}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium flex items-center disabled:opacity-50"
            >
              <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('balance.refresh')}
            </button>
          </div>
          
          {loading && !balanceData ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <p className="mt-4 text-gray-300">{t('balance.loading')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {/* 余额卡片 */}
              <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Wallet size={24} className="mr-3" />
                    <h2 className="text-xl font-bold">{t('balance.currentBalance')}</h2>
                  </div>
                  <div className="bg-white/20 p-2 rounded-lg">
                    <TrendingUp size={20} />
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="text-4xl font-bold mb-2">
                    ￥{balanceData?.userBalance?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-orange-100">
                    {t('balance.availableBalance')}
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t border-white/20">
                  <span className="text-orange-100">{t('balance.lastUpdate')}</span>
                  <span className="text-sm">{new Date().toLocaleString()}</span>
                </div>
              </div>
              
              {/* 套餐卡片 */}
              <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <CreditCard size={24} className="mr-3 text-gray-400" />
                    <h2 className="text-xl font-bold">{t('balance.currentPlan')}</h2>
                  </div>
                  <div className="bg-gray-800 p-2 rounded-lg">
                    <Clock size={20} className="text-gray-400" />
                  </div>
                </div>
                
                <div className="mb-6">
                  <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium mb-4 ${getPlanColor(balanceData?.userPlan || 'free')}`}>
                    {getPlanDisplayName(balanceData?.userPlan || 'free')}
                  </div>
                  <div className="text-gray-400">
                    {t('balance.planDescription')}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">{t('balance.planType')}</span>
                    <span className="font-medium">{getPlanDisplayName(balanceData?.userPlan || 'free')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">{t('balance.status')}</span>
                    <span className="text-green-500 font-medium">{t('balance.active')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">{t('balance.renewDate')}</span>
                    <span className="font-medium">-</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 功能区域 */}
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-6 text-center">{t('balance.quickActions')}</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {/* 充值 */}
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-orange-500 transition-colors cursor-pointer">
                <div className="text-center">
                  <div className="bg-orange-500/20 p-4 rounded-lg inline-block mb-4">
                    <Wallet size={24} className="text-orange-500" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">{t('balance.recharge')}</h4>
                  <p className="text-gray-400 text-sm">{t('balance.rechargeDesc')}</p>
                </div>
              </div>
              
              {/* 升级套餐 */}
              <div 
                className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-orange-500 transition-colors cursor-pointer"
                onClick={() => navigate('/pricing')}
              >
                <div className="text-center">
                  <div className="bg-purple-500/20 p-4 rounded-lg inline-block mb-4">
                    <CreditCard size={24} className="text-purple-500" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">{t('balance.upgrade')}</h4>
                  <p className="text-gray-400 text-sm">{t('balance.upgradeDesc')}</p>
                </div>
              </div>
              
              {/* 查看订单 */}
              <div 
                className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-orange-500 transition-colors cursor-pointer"
                onClick={() => navigate('/orders')}
              >
                <div className="text-center">
                  <div className="bg-blue-500/20 p-4 rounded-lg inline-block mb-4">
                    <Calendar size={24} className="text-blue-500" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">{t('balance.viewOrders')}</h4>
                  <p className="text-gray-400 text-sm">{t('balance.viewOrdersDesc')}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 统计信息 */}
          <div className="mt-12 bg-gray-900 rounded-xl p-8 border border-gray-800">
            <h3 className="text-xl font-bold mb-6">{t('balance.usageStats')}</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500 mb-2">0</div>
                <div className="text-gray-400">{t('balance.thisMonthSpent')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500 mb-2">0</div>
                <div className="text-gray-400">{t('balance.totalTransactions')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500 mb-2">0</div>
                <div className="text-gray-400">{t('balance.apiCalls')}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

