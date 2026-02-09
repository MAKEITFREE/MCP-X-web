import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { useLanguage } from '../contexts/LanguageContext';

export const TermsPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">{t('terms.title')}</h1>
          
          <div className="prose prose-invert">
            <div className="bg-gray-900 rounded-lg p-8 mb-8">
              <p className="text-gray-300 mb-4">
                {t('terms.lastUpdated')}
              </p>
              <p className="text-gray-300">
                {t('terms.intro')}
              </p>
            </div>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">1. {t('terms.acceptance')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                  {t('terms.acceptanceContent')}
                </p>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">2. {t('terms.useLicense')}</h2>
              <div className="bg-gray-900 rounded-lg p-6 space-y-4">
                <p className="text-gray-300">{t('terms.useLicenseContent')}</p>
                <ul className="list-disc list-inside text-gray-300">
                  <li>{t('terms.useLicenseList.modify')}</li>
                  <li>{t('terms.useLicenseList.commercial')}</li>
                  <li>{t('terms.useLicenseList.reverse')}</li>
                  <li>{t('terms.useLicenseList.copyright')}</li>
                  <li>{t('terms.useLicenseList.transfer')}</li>
                </ul>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">3. {t('terms.userResponsibility')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                  {t('terms.userResponsibilityContent')}
                </p>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">4. {t('terms.disclaimer')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                {t('terms.disclaimerContent')}
                </p>
              </div>
            </section>
            
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">5. {t('terms.liability')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                  {t('terms.liabilityContent')}
                </p>
              </div>
            </section>
            
            <section>
              <h2 className="text-2xl font-bold mb-4">6. {t('terms.contactInfo')}</h2>
              <div className="bg-gray-900 rounded-lg p-6">
                <p className="text-gray-300">
                  {t('terms.contactContent')}{' '}
                  <a href="mailto:business@timecyber.com.cn" className="text-orange-500 hover:text-orange-400">
                    business@timecyber.com.cn
                  </a>{t('terms.contactEmail')}
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