import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { AlertTriangle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message } from 'antd';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export const AddServerPage: React.FC = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    description: '',
    category: '精选MCP',
    type: 'Remote',
    documentation: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: { pathname: location.pathname } } });
    }
  }, [navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.server.addServer({
        name: formData.name,
        handle: formData.handle,
        description: formData.description,
        documentation: formData.documentation
      });

      if (response.code !== 200) {
        throw new Error(response.message || t('addServer.submitFailed'));
      }

      message.success(t('addServer.submitSuccess'));
      navigate('/mcp');
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('addServer.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 如果未登录，页面内容不渲染
  if (!localStorage.getItem('token')) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('addServer.title')}</h1>
            <p className="text-gray-400">{t('addServer.subtitle')}</p>
            <div className="mt-4">
              <a 
                href="/rewards" 
                className="text-orange-500 hover:text-orange-400 text-sm font-medium transition-colors"
              >
                {t('addServer.rewardsLink')}
              </a>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                  {t('addServer.serverName')}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder={t('addServer.serverNamePlaceholder')}
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="handle" className="block text-sm font-medium text-gray-300 mb-1">
                  {t('addServer.handle')}
                </label>
                <input
                  type="text"
                  id="handle"
                  name="handle"
                  value={formData.handle}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder={t('addServer.handlePlaceholder')}
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                  {t('addServer.description')}
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder={t('addServer.descriptionPlaceholder')}
                  required
                  disabled={loading}
                />
              </div>
              
              <div>
                <label htmlFor="documentation" className="block text-sm font-medium text-gray-300 mb-1">
                  {t('addServer.githubUrl')}
                </label>
                <input
                  type="url"
                  id="documentation"
                  name="documentation"
                  value={formData.documentation}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  placeholder={t('addServer.githubUrlPlaceholder')}
                  disabled={loading}
                />
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 flex items-start">
                <AlertTriangle className="text-yellow-500 mt-1 mr-3 flex-shrink-0" size={20} />
                <div className="text-sm text-gray-300">
                  <p className="font-medium mb-1">{t('addServer.beforeSubmit')}</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>{t('addServer.confirmMcp')}</li>
                    <li>{t('addServer.confirmTested')}</li>
                    <li>{t('addServer.confirmDocs')}</li>
                  </ul>
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full bg-orange-500 text-black font-medium rounded-lg px-4 py-2.5 hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? t('addServer.submitting') : t('addServer.submitServer')}
              </button>
            </form>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};