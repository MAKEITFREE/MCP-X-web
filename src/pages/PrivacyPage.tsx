import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { useLanguage } from '../contexts/LanguageContext';

export const PrivacyPage: React.FC = () => {
  const { currentLanguage, t } = useLanguage();
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">{t('privacy.title')}</h1>
          
          <div className="prose prose-invert">
            <div className="bg-gray-900 rounded-lg p-8 mb-8">
              <p className="text-gray-300 mb-4">
                {t('privacy.lastUpdated')}
              </p>
              <p className="text-gray-300">
                {t('privacy.intro')}
              </p>
            </div>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{t('privacy.infoWeCollect')}</h2>
              <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                <p className="text-gray-300">{t('privacy.infoWeCollectDesc')}</p>
                <ul className="list-disc list-inside text-gray-300">
                  <li>{currentLanguage === 'zh' ? '账户信息（姓名、邮箱、密码）' : 'Account information (name, email, password)'}</li>
                  <li>{currentLanguage === 'zh' ? '个人资料信息' : 'Profile information'}</li>
                  <li>{currentLanguage === 'zh' ? '服务器提交和文档' : 'Server submissions and documentation'}</li>
                  <li>{currentLanguage === 'zh' ? '通信偏好' : 'Communication preferences'}</li>
                </ul>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{t('privacy.howWeUse')}</h2>
              <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                <p className="text-gray-300">{t('privacy.howWeUseDesc')}</p>
                <ul className="list-disc list-inside text-gray-300">
                  <li>{currentLanguage === 'zh' ? '提供和维护我们的服务' : 'Provide and maintain our services'}</li>
                  <li>{currentLanguage === 'zh' ? '处理您的交易' : 'Process your transactions'}</li>
                  <li>{currentLanguage === 'zh' ? '向您发送技术通知和更新' : 'Send you technical notices and updates'}</li>
                  <li>{currentLanguage === 'zh' ? '回复您的评论和问题' : 'Respond to your comments and questions'}</li>
                  <li>{currentLanguage === 'zh' ? '改进我们的服务' : 'Improve our services'}</li>
                </ul>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{t('privacy.dataSecurity')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                  {t('privacy.dataSecurityDesc')}
                </p>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{t('privacy.yourRights')}</h2>
              <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                <p className="text-gray-300">{t('privacy.yourRightsDesc')}</p>
                <ul className="list-disc list-inside text-gray-300">
                  <li>{currentLanguage === 'zh' ? '访问您的个人信息' : 'Access your personal information'}</li>
                  <li>{currentLanguage === 'zh' ? '更正不准确的信息' : 'Correct inaccurate information'}</li>
                  <li>{currentLanguage === 'zh' ? '请求删除您的信息' : 'Request deletion of your information'}</li>
                  <li>{currentLanguage === 'zh' ? '反对我们使用您的信息' : 'Object to our use of your information'}</li>
                  <li>{currentLanguage === 'zh' ? '撤回同意' : 'Withdraw consent'}</li>
                </ul>
              </div>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold mb-4">{t('privacy.contactUs')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                  {t('privacy.contactUsDesc')}{' '}
                  <a href="mailto:business@timecyber.com.cn" className="text-orange-500 hover:text-orange-400">
                    business@timecyber.com.cn
                  </a>{t('privacy.contactUsEmail')}
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};