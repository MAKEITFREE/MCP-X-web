import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Search, Calendar, Eye, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { api, tokenUtils } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

interface Order {
  id: string;
  orderNo: string;
  orderName: string;
  amount: number;
  status: number;
  payMethod: string;
  createTime: string;
  payTime?: string;
}

export const OrderPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

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
      
      // 如果已登录，加载订单数据
      fetchOrders();
    };
    
    checkAuth();
  }, [navigate, location, currentPage]);

  // 获取订单列表
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.payment.getMyOrders({
        pageNum: currentPage,
        pageSize: pageSize
      });
      
      if (response.code === 200 && response.rows) {
        setOrders(response.rows);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('获取订单列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取订单状态文本
  const getStatusText = (status: number) => {
    const statusMap: Record<number, string> = {
      0: t('order.status.pending'),
      1: t('order.status.paid'),
      2: t('order.status.cancelled'),
      3: t('order.status.refunded')
    };
    return statusMap[status] || t('order.status.unknown');
  };

  // 获取订单状态样式
  const getStatusColor = (status: number) => {
    const colorMap: Record<number, string> = {
      0: 'text-yellow-600 bg-yellow-100',
      1: 'text-green-600 bg-green-100',
      2: 'text-red-600 bg-red-100',
      3: 'text-gray-600 bg-gray-100'
    };
    return colorMap[status] || 'text-gray-600 bg-gray-100';
  };

  // 获取支付方式文本
  const getPayMethodText = (payMethod: string) => {
    const methodMap: Record<string, string> = {
      'wxpay': t('order.payMethod.wechat'),
      'alipay': t('order.payMethod.alipay'),
      'bankcard': t('order.payMethod.bankcard')
    };
    return methodMap[payMethod] || payMethod;
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  // 搜索订单
  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders();
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">{t('order.title')}</h1>
            <p className="text-xl text-gray-300">
              {t('order.subtitle')}
            </p>
          </div>
          
          {/* 搜索栏 */}
          <div className="bg-gray-900 rounded-xl p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('order.searchPlaceholder')}
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-orange-500 text-black rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                {t('order.search')}
              </button>
              <button
                onClick={() => {
                  setSearchKeyword('');
                  setCurrentPage(1);
                  fetchOrders();
                }}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium flex items-center"
              >
                <RefreshCw size={16} className="mr-2" />
                {t('order.refresh')}
              </button>
            </div>
          </div>
          
          {/* 订单列表 */}
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                <p className="mt-4 text-gray-300">{t('order.loading')}</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400">{t('order.noOrders')}</p>
              </div>
            ) : (
              <>
                {/* 表头 */}
                <div className="hidden md:grid md:grid-cols-7 gap-4 p-4 bg-gray-800 text-gray-300 font-medium">
                  <div>{t('order.table.orderNo')}</div>
                  <div>{t('order.table.productName')}</div>
                  <div>{t('order.table.amount')}</div>
                  <div>{t('order.table.payMethod')}</div>
                  <div>{t('order.table.status')}</div>
                  <div>{t('order.table.createTime')}</div>
                  <div>{t('order.table.actions')}</div>
                </div>
                
                {/* 订单列表 */}
                <div className="divide-y divide-gray-800">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 md:grid md:grid-cols-7 gap-4 items-center">
                      {/* 移动端布局 */}
                      <div className="md:hidden space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{order.orderName}</div>
                            <div className="text-sm text-gray-400">{order.orderNo}</div>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-orange-500 font-bold">￥{order.amount}</div>
                            <div className="text-sm text-gray-400">{getPayMethodText(order.payMethod)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-400">{formatDate(order.createTime)}</div>
                            <button className="text-orange-500 text-sm hover:text-orange-400 mt-1">
                              <Eye size={16} className="inline mr-1" />
                              {t('order.table.view')}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* 桌面端布局 */}
                      <div className="hidden md:contents">
                        <div className="text-sm text-gray-300">{order.orderNo}</div>
                        <div className="font-medium">{order.orderName}</div>
                        <div className="text-orange-500 font-bold">￥{order.amount}</div>
                        <div className="text-gray-400">{getPayMethodText(order.payMethod)}</div>
                        <div className={`px-2 py-1 rounded-full text-xs inline-block ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </div>
                        <div className="text-sm text-gray-400">{formatDate(order.createTime)}</div>
                        <div>
                          <button className="text-orange-500 hover:text-orange-400 text-sm">
                            <Eye size={16} className="inline mr-1" />
                            {t('order.table.view')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* 分页 */}
                {total > pageSize && (
                  <div className="p-4 bg-gray-800 flex justify-center">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                      >
                        {t('order.pagination.prev')}
                      </button>
                      
                      {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === Math.ceil(total / pageSize) || Math.abs(page - currentPage) <= 2)
                        .map((page, index, array) => (
                          <React.Fragment key={page}>
                            {index > 0 && array[index - 1] < page - 1 && (
                              <span className="px-3 py-1 text-gray-400">...</span>
                            )}
                            <button
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-1 rounded ${
                                currentPage === page
                                  ? 'bg-orange-500 text-black'
                                  : 'bg-gray-700 text-white hover:bg-gray-600'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        ))}
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= Math.ceil(total / pageSize)}
                        className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                      >
                        {t('order.pagination.next')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

