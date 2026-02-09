import React, { useState } from 'react';
import { Github, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import wechatQrcode from '../../assets/wechat-qrcode.jpg';
import { useLanguage } from '../../contexts/LanguageContext';

export const Footer: React.FC = () => {
  const { currentLanguage, t } = useLanguage();
  const [showWechat, setShowWechat] = useState(false);

  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between mb-8">
          <div className="mb-6 md:mb-0">
            <Link to="/" className="text-xl font-bold text-white whitespace-nowrap">MCP-X</Link>
            <p className="mt-2 text-gray-400 max-w-md whitespace-nowrap">
              {t('footer.subtitle1')}
            </p>
            <p className="mt-2 text-gray-400 max-w-md whitespace-nowrap">
              {t('footer.subtitle2')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{t('footer.product')}</h3>
              <ul className="space-y-2">
                <li><Link to="/" className="text-gray-400 hover:text-white transition-colors">{t('footer.servers')}</Link></li>
                {/* <li><Link to="/docs" className="text-gray-400 hover:text-white transition-colors">文档</Link></li> */}
                <li><Link to="/pricing" className="text-gray-400 hover:text-white transition-colors">{t('footer.pricing')}</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{t('footer.company')}</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-gray-400 hover:text-white transition-colors">{t('footer.aboutUs')}</Link></li>
                <li><Link to="/careers" className="text-gray-400 hover:text-white transition-colors">{t('footer.careers')}</Link></li>
                <li><Link to="/contact" className="text-gray-400 hover:text-white transition-colors">{t('footer.contact')}</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">{t('footer.legal')}</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-gray-400 hover:text-white transition-colors">{t('footer.privacy')}</Link></li>
                <li><Link to="/terms" className="text-gray-400 hover:text-white transition-colors">{t('footer.terms')}</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} MCP-X. {t('footer.copyright')}
            {currentLanguage === 'zh' && (
              <a
                href="https://beian.miit.gov.cn/"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-gray-400 hover:text-white"
              >
                蜀ICP备2023016826号-11
              </a>
            )}
          </p>
          
          <div className="flex space-x-6">
            <a href="https://github.com/TimeCyber" className="text-gray-400 hover:text-white transition-colors" aria-label="Github">
              <Github size={20} />
            </a>
            <a href="mailto:business@timecyber.com.cn" className="text-gray-400 hover:text-white transition-colors" aria-label="Mail">
              <Mail size={20} />
            </a>
            <button
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="WeChat"
              onClick={() => setShowWechat(true)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <MessageCircle size={20} />
            </button>
          </div>
        </div>
        {/* 微信二维码弹窗 */}
        {showWechat && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center">
              <img src={wechatQrcode} alt={t('footer.wechatQrTitle')} className="w-64 h-auto mb-4" />
              <div className="mb-2 text-black">{t('footer.wechatQrTitle')}</div>
              <button
                className="mt-2 px-4 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                onClick={() => setShowWechat(false)}
              >
                {t('footer.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};