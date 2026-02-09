import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Check, X, Mail, Phone, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Modal } from 'antd';
import { api } from '../services/api';
import { QRCodeCanvas } from 'qrcode.react';

export const PricingPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isContactModalVisible, setIsContactModalVisible] = useState(false);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [vipPackages, setVipPackages] = useState<any[]>([]);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const paymentPollTimer = useRef<any>(null);

  const stopPaymentPolling = () => {
    if (paymentPollTimer.current) {
      clearInterval(paymentPollTimer.current);
      paymentPollTimer.current = null;
    }
  };

  const startPaymentPolling = (orderNo: string) => {
    stopPaymentPolling();
    let attempts = 0;
    paymentPollTimer.current = setInterval(async () => {
      attempts += 1;
      try {
        const res = await api.payment.getOrderByNo(orderNo);
        const data: any = res?.data || res; // 兼容不同返回结构
        const status = data?.paymentStatus ?? data?.status; // 1=已支付，0=未支付
        if (status === 1 || status === '1') {
          stopPaymentPolling();
          setIsPaymentModalVisible(false);
          setPaymentOrder(null);
          navigate('/settings');
        }
      } catch (e) {
        // 忽略单次错误，继续轮询
      }
      if (attempts >= 24) {
        // 超时约2分钟停止（5秒 * 24 次）
        stopPaymentPolling();
      }
    }, 5000);
  };

  // 获取VIP套餐数据
  useEffect(() => {
    const fetchVipPackages = async () => {
      try {
        const response = await api.package.getVipPackages();
        if (response.code === 200 && response.data) {
          setVipPackages(response.data);
        }
      } catch (error) {
        console.error('获取VIP套餐失败:', error);
      }
    };

    fetchVipPackages();
  }, []);

  const handleContactSales = () => {
    setIsContactModalVisible(true);
  };

  const handleBuyVip = async (packageId?: number) => {
    if (isCreatingOrder) return;
    try {
      setIsCreatingOrder(true);

      const targetId = packageId || vipPackages.find(pkg => pkg.name === 'VIP套餐')?.id;

      if (!targetId) {
        console.error('未找到套餐信息');
        return;
      }

      const response = await api.payment.createWechatOrder(targetId);
      if (response.code === 200 && response.data) {
        setPaymentOrder(response.data);
        setIsPaymentModalVisible(true);
        if (response.data.orderNo) {
          startPaymentPolling(response.data.orderNo);
        }
      } else {
        console.error('创建订单失败:', response);
      }
    } catch (error) {
      console.error('创建支付订单失败:', error);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const getFeatures = (planType: string) => {
    const features = {
      free: [
        t('pricing.features.free.0'),
        t('pricing.features.free.1'),
        t('pricing.features.free.2'),
        t('pricing.features.free.3')
      ],
      pro: [
        '10,000 TOKEN次数',
        '优先支持',
        'API 访问',
        '自定义集成',
        '专业图像编辑工具',
        '智能图像增强',
        '批量处理能力'
      ],
      enterprise: [
        t('pricing.features.enterprise.0'),
        t('pricing.features.enterprise.1'),
        t('pricing.features.enterprise.2'),
        t('pricing.features.enterprise.3'),
        t('pricing.features.enterprise.4'),
        t('pricing.features.enterprise.5'),
        t('pricing.features.enterprise.6'),
        t('pricing.features.enterprise.7'),
        t('pricing.features.enterprise.8'),
        t('pricing.features.enterprise.9')
      ]
    };
    return features[planType as keyof typeof features] || [];
  };

  const getLimitations = (planType: string) => {
    const limitations = {
      free: [
        t('pricing.limitations.free.0'),
        t('pricing.limitations.free.1'),
        t('pricing.limitations.free.2'),
        t('pricing.limitations.free.3')
      ],
      pro: [
        t('pricing.limitations.pro.0')
      ],
      enterprise: []
    };
    return limitations[planType as keyof typeof limitations] || [];
  };

  const plans = [
    // 动态加载前两个套餐
    ...(vipPackages.length > 0 ? vipPackages.slice(0, 2).map((pkg, index) => {
      // 为不同套餐设置不同的基础功能
      const baseFeatures = index === 0 ? [
        '约5,000 TOKEN次数',
        'AI图像编辑工具',
        '图形工作台，支持图像生成，编辑',
        '约50次AI图像生成能力',
        '图片可商用',
        '优先支持'
      ] : [
        '约100,000 TOKEN次数',
        '优先支持',
        'AI图像编辑工具',
        'AI视频生成工具',
        '智能图像生成，编辑',
        '批量处理能力',
        '约500次AI图像生成能力',
        '约100次AI视频生成能力',
        '图片视频可商用'
      ];

      return {
        id: pkg.id,
        name: pkg.name,
        price: `￥${pkg.price}`,
        description: index === 0
          ? '适合初次体验的专业套餐，提供基础图像编辑和生成服务'
          : '功能完整的专业套餐，包含全部图像和视频工作台权限',
        features: [
          ...baseFeatures,
          // 新增：图片工作台Token和视频工作台权限
          pkg.imageTokens ? `${pkg.imageTokens} 图片生成Token` : (index === 0 ? '100 图片生成Token' : '500 图片生成Token'),
          pkg.videoAccess ? '支持视频工作台' : (index === 0 ? '暂不支持视频工作台' : '支持视频工作台')
        ],
        limitations: index === 0 ? [t('pricing.limitations.pro.0')] : [],
        popular: index === 1 // 第二个套餐作为"推荐"
      };
    }) : []),
    // 固定的企业版（如果没有加载到套餐，这里会变成第一个，或者排在后面）
    {
      name: t('pricing.plans.enterprise'),
      price: t('pricing.custom'),
      description: t('pricing.plans.enterpriseDesc'),
      features: getFeatures('enterprise'),
      limitations: getLimitations('enterprise'),
      popular: false,
      id: undefined
    }
  ];

  // 如果没有获取到套餐(loading或error)，可以保留一个占位或者什么都不显示，这里为了UI稳定，确保如果vipPackages为空，我们不展示错误的空列表。
  // 但由于我们要在原Free的位置展示，所以vipPackages为空时，页面可能会少卡片，这是正常的loading状态。


  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('pricing.title')}</h1>
          <p className="text-xl text-gray-300">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-gray-900 rounded-xl p-8 border ${plan.popular
                ? 'border-orange-500 relative'
                : 'border-gray-800'
                }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-orange-500 text-black px-3 py-1 rounded-full text-sm font-medium">
                    {t('pricing.mostPopular')}
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <div className="text-4xl font-bold mb-2">
                  {plan.price === t('pricing.custom') ? plan.price :
                    plan.price.includes('.') && plan.price.endsWith('0') ?
                      plan.price.replace(/\.0$/, '') : plan.price}
                  {/* {plan.price !== t('pricing.custom') && (
                    <span className="text-lg text-gray-400">{t('pricing.perMonth')}</span>
                  )} */}
                </div>
                <p className="text-gray-400">{plan.description}</p>
              </div>

              <button
                onClick={() => {
                  if (plan.name === t('pricing.plans.enterprise')) {
                    handleContactSales();
                  } else if (plan.id) {
                    handleBuyVip(plan.id);
                  } else {
                    // Fallback just in case
                    handleBuyVip();
                  }
                }}
                disabled={plan.name === t('pricing.plans.pro') && isCreatingOrder}
                className={`w-full py-2 px-4 rounded-lg font-medium mb-8 ${plan.popular
                  ? `bg-orange-500 text-black ${plan.name === t('pricing.plans.pro') && isCreatingOrder ? 'opacity-60 cursor-not-allowed' : 'hover:bg-orange-600'}`
                  : 'bg-gray-800 text-white hover:bg-gray-700'
                  } transition-colors`}
              >
                {plan.name === t('pricing.plans.enterprise') ? t('pricing.contactSales') : plan.name === t('pricing.plans.pro') ? (isCreatingOrder ? t('pricing.creatingOrder') : t('pricing.buyNow')) : t('pricing.getStarted')}
              </button>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">{t('pricing.includedFeatures')}</h3>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center text-gray-300">
                        <Check size={16} className="text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.limitations.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">{t('pricing.limitationsLabel')}</h3>
                    <ul className="space-y-2">
                      {plan.limitations.map((limitation, i) => (
                        <li key={i} className="flex items-center text-gray-400">
                          <X size={16} className="text-red-500 mr-2 flex-shrink-0" />
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gray-900 rounded-xl p-8 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">
            {t('pricing.faq')}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-2">{t('pricing.faqItems.toolCall')}</h3>
              <p className="text-gray-400">
                {t('pricing.faqItems.toolCallAnswer')}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">{t('pricing.faqItems.planChange')}</h3>
              <p className="text-gray-400">
                {t('pricing.faqItems.planChangeAnswer')}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">{t('pricing.faqItems.payment')}</h3>
              <p className="text-gray-400">
                {t('pricing.faqItems.paymentAnswer')}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">{t('pricing.faqItems.refund')}</h3>
              <p className="text-gray-400">
                {t('pricing.faqItems.refundAnswer')}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* 联系销售模态框 */}
      <Modal
        title={t('pricing.contactInfo')}
        open={isContactModalVisible}
        onCancel={() => setIsContactModalVisible(false)}
        footer={[
          <button
            key="close"
            onClick={() => setIsContactModalVisible(false)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {t('pricing.close')}
          </button>
        ]}
        className="contact-modal"
      >
        <div className="py-4">
          <p className="text-gray-600 mb-6">{t('pricing.contactDesc')}</p>

          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="text-orange-500" size={20} />
              <div>
                <div className="font-medium">{t('pricing.email')}</div>
                <div className="text-gray-600">business@timecyber.com.cn</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="text-orange-500" size={20} />
              <div>
                <div className="font-medium">{t('pricing.phone')}</div>
                <div className="text-gray-600">+86 186-0802-0462</div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <MessageCircle className="text-orange-500" size={20} />
              <div>
                <div className="font-medium">{t('pricing.wechat')}</div>
                <div className="text-gray-600">AI快码加编</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 微信支付模态框 */}
      <Modal
        title={t('pricing.wechatPayment')}
        open={isPaymentModalVisible}
        onCancel={() => {
          setIsPaymentModalVisible(false);
          setPaymentOrder(null);
          stopPaymentPolling();
        }}
        footer={[
          <button
            key="close"
            onClick={() => {
              setIsPaymentModalVisible(false);
              setPaymentOrder(null);
            }}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors mr-2"
          >
            {t('pricing.close')}
          </button>,
          <button
            key="confirm"
            onClick={() => {
              // 这里可以添加支付确认逻辑
              setIsPaymentModalVisible(false);
              setPaymentOrder(null);
              stopPaymentPolling();
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {t('pricing.confirmPayment')}
          </button>
        ]}
        className="payment-modal"
      >
        <div className="py-4 text-center">
          <p className="text-gray-600 mb-6">{t('pricing.wechatPaymentDesc')}</p>

          {/* 二维码区域 */}
          <div className="flex justify-center mb-6">
            {paymentOrder && paymentOrder.qrCodeUrl ? (
              <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
                <QRCodeCanvas value={paymentOrder.qrCodeUrl} size={184} />
              </div>
            ) : (
              <div className="w-48 h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-2">📱</div>
                  <div className="text-gray-500 text-sm">{t('pricing.qrCodePlaceholder')}</div>
                </div>
              </div>
            )}
          </div>

          {/* 支付信息 */}
          <div className="bg-green-50 p-4 rounded-lg">
            {paymentOrder && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{t('pricing.orderNo')}:</span>
                  <span className="text-gray-700 text-sm">{paymentOrder.orderNo}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{t('pricing.paymentAmount')}:</span>
                  <span className="text-green-600 font-bold text-lg">￥{paymentOrder.amount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t('pricing.productName')}:</span>
                  <span className="text-gray-700">{paymentOrder.orderName}</span>
                </div>
              </>
            )}
            {!paymentOrder && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{t('pricing.paymentAmount')}:</span>
                  <span className="text-green-600 font-bold text-lg">
                    ￥{vipPackages.length > 0 ? vipPackages[0].price : '99'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{t('pricing.productName')}:</span>
                  <span className="text-gray-700">{vipPackages.length > 0 ? vipPackages[0].name : t('pricing.plans.pro')}</span>
                </div>
              </>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-4">
            {t('pricing.paymentInstructions')}
          </p>
        </div>
      </Modal>

      <Footer />
    </div>
  );
};