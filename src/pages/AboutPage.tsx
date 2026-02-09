import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { useLanguage } from '../contexts/LanguageContext';

export const AboutPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">{t('about.title')}</h1>
          
          <div className="prose prose-invert">
            <p className="text-xl text-gray-300 mb-8">
              {t('about.subtitle')}
            </p>
            
            <div className="bg-gray-900 rounded-lg p-8 mb-12">
              <h2 className="text-2xl font-bold mb-4">{t('about.mission')}</h2>
              <p className="text-gray-300 mb-6">
                {t('about.missionDesc')}
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-3">{t('about.innovation')}</h3>
                <p className="text-gray-300">
                  {t('about.innovationDesc')}
                </p>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="text-xl font-bold mb-3">{t('about.community')}</h3>
                <p className="text-gray-300">
                  {t('about.communityDesc')}
                </p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-8">
              <h2 className="text-2xl font-bold mb-4">{t('about.joinUs')}</h2>
              <p className="text-black mb-4">
                {t('about.joinUsDesc')}
              </p>
              <button className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors">
                {t('about.getStarted')}
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};