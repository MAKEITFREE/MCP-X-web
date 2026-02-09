import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { MapPin, Users, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const CareersPage: React.FC = () => {
  const { t } = useLanguage();
  
  const openings = [
    {
      title: t('careers.jobs.frontendEngineer'),
      department: t('careers.jobs.frontendDept'),
      location: t('careers.remote'),
      type: t('careers.fullTime'),
      responsibilities: t('careers.jobs.frontendResponsibilities')
    },
    {
      title: t('careers.jobs.productManager'),
      department: t('careers.jobs.productDept'),
      location: t('careers.remote'),
      type: t('careers.fullTime'),
      responsibilities: t('careers.jobs.productResponsibilities')
    },
    {
      title: t('careers.jobs.aiScientist'),
      department: t('careers.jobs.researchDept'),
      location: t('careers.remote'),
      type: t('careers.fullTime'),
      responsibilities: t('careers.jobs.aiResponsibilities')
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{t('careers.title')}</h1>
            <p className="text-xl text-gray-300">
              {t('careers.subtitle')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <div className="inline-block p-3 bg-orange-500 rounded-lg mb-4">
                <MapPin className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('careers.remoteFirst')}</h3>
              <p className="text-gray-300">{t('careers.remoteFirstDesc')}</p>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <div className="inline-block p-3 bg-orange-500 rounded-lg mb-4">
                <Users className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('careers.inclusiveCulture')}</h3>
              <p className="text-gray-300">{t('careers.inclusiveCultureDesc')}</p>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <div className="inline-block p-3 bg-orange-500 rounded-lg mb-4">
                <Zap className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('careers.impact')}</h3>
              <p className="text-gray-300">{t('careers.impactDesc')}</p>
            </div>
          </div>
          
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8">{t('careers.openPositions')}</h2>
            <div className="space-y-4">
              {openings.map((job, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                      <p className="text-gray-300">{job.department}</p>
                      {job.responsibilities && (
                        <ol className="text-gray-400 text-sm mt-2 space-y-1 pl-5 list-decimal">
                          {job.responsibilities.split('\n').map((line, idx) => (
                            <li key={idx}>{line.replace(/^\d+\.\s*/, '')}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <span className="bg-orange-500 text-black px-6 py-1 rounded-full text-sm min-w-[56px] text-center">
                      {job.type}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <MapPin size={16} className="mr-2" />
                    {job.location}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4 text-black">{t('careers.noSuitablePosition')}</h2>
            <p className="text-black mb-6">
              {t('careers.noSuitablePositionDesc')}
            </p>
            <button className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-900 transition-colors">
              {t('careers.submitResume')}
            </button>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};