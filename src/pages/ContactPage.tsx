import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Mail, MessageSquare, Phone } from 'lucide-react';
import { api } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export const ContactPage: React.FC = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.contact.sendMessage(formData);
      alert(t('contact.messageSent'));
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      let msg = t('contact.sendFailed');
      if (err && (err.message || err.msg)) {
        msg = err.message || err.msg;
      } else if (typeof err === 'string') {
        msg = err;
      }
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{t('contact.title')}</h1>
            <p className="text-xl text-gray-300">
              {t('contact.subtitle')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <div className="inline-block p-3 bg-orange-500 rounded-lg mb-4">
                <Mail className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('contact.email')}</h3>
              <p className="text-gray-300 break-all">business@timecyber.com.cn</p>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <div className="inline-block p-3 bg-orange-500 rounded-lg mb-4">
                <MessageSquare className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('contact.community')}</h3>
              <p className="text-gray-300">{t('contact.communityDesc')}</p>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-6 text-center">
              <div className="inline-block p-3 bg-orange-500 rounded-lg mb-4">
                <Phone className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('contact.phone')}</h3>
              <p className="text-gray-300">+86 (028) 18608020462</p>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-6">{t('contact.sendMessage')}</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                    {t('contact.yourName')}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                    {t('contact.emailAddress')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-1">
                  {t('contact.subject')}
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-1">
                  {t('contact.messageContent')}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-orange-500 text-black font-medium rounded-lg px-4 py-2.5 hover:bg-orange-600 transition-colors"
                disabled={submitting}
              >
                {submitting ? t('contact.sendingMessage') : t('contact.sendMessageButton')}
              </button>
            </form>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};