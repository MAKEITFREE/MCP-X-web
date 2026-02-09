import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Github, Loader2 } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';
import { useLanguage } from '../contexts/LanguageContext';

export const GithubCallbackPage: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleGithubCallback = async () => {
      try {
        // 检查用户是否已经登录
        const existingToken = localStorage.getItem('token');
        if (existingToken) {
          console.log('用户已登录，直接跳转到首页');
          toast.success(t('githubCallback.alreadyLoggedIn'));
          navigate('/');
          return;
        }

        // 从URL参数中获取授权码和状态参数
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');
        
        if (error) {
          console.error('GitHub授权错误:', error);
          setError(t('githubCallback.authorizationFailed'));
          setLoading(false);
          return;
        }
        
        // 验证state参数防止CSRF攻击
        const savedState = localStorage.getItem('github_oauth_state');
        if (state && savedState && state !== savedState) {
          console.error('State参数不匹配，可能存在CSRF攻击');
          setError(t('githubCallback.securityCheckFailed'));
          localStorage.removeItem('github_oauth_state');
          setLoading(false);
          return;
        }
        
        // 清除保存的state
        if (savedState) {
          localStorage.removeItem('github_oauth_state');
        }
        
        if (!code) {
          console.error('未获取到授权码，可能是重复访问回调页面');
          // 如果没有授权码，可能是用户直接访问了回调页面
          setError(t('githubCallback.invalidAccess'));
          setLoading(false);
          return;
        }

        console.log('获取到GitHub授权码:', code);
        
        // 调用后端GitHub登录接口
        const res = await api.user.githubLogin(code);
        console.log('GitHub登录API响应:', res);
        
        if (res && res.code === 200) {
          // 处理登录响应
          const token = res.data?.access_token || res.data?.token || res.token;
          const userInfo = res.data?.userInfo;
          
          console.log('提取的token:', token);
          console.log('提取的userInfo:', userInfo);
          
          if (token) {
            localStorage.setItem('token', token);
            console.log('已保存token到localStorage');
          }
          
          if (userInfo) {
            // 保存用户ID
            if (userInfo.userId) {
              localStorage.setItem('userId', userInfo.userId);
              console.log('已保存userId到localStorage:', userInfo.userId);
            }
            
            // 保存其他用户信息
            if (userInfo.nickName) {
              localStorage.setItem('nickname', userInfo.nickName);
            }
            if (userInfo.username) {
              localStorage.setItem('username', userInfo.username);
            }
            
            // 保存用户角色信息
            if (userInfo.rolePermission && userInfo.rolePermission.length > 0) {
              localStorage.setItem('userRole', userInfo.rolePermission[0]);
            }
          }
          
          console.log('localStorage更新后的内容:');
          console.log('- token:', localStorage.getItem('token'));
          console.log('- userId:', localStorage.getItem('userId'));
          console.log('- username:', localStorage.getItem('username'));
          
          toast.success(t('githubCallback.loginSuccess'));
          navigate('/');
        } else {
          setError(res?.msg || res?.message || t('githubCallback.loginFailed'));
        }
      } catch (err: any) {
        console.error('GitHub登录错误:', err);
        setError(err?.response?.data?.msg || err?.message || t('githubCallback.loginError'));
      } finally {
        setLoading(false);
      }
    };

    handleGithubCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          {loading ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
              <h2 className="text-xl font-semibold">{t('githubCallback.processing')}</h2>
              <p className="text-gray-400">{t('githubCallback.processingDesc')}</p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <Github className="w-6 h-6 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-red-400">{t('githubCallback.loginFailed')}</h2>
              <p className="text-gray-400">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-4 bg-orange-500 text-black font-medium rounded-lg px-6 py-2 hover:bg-orange-600 transition-colors"
              >
                {t('githubCallback.backToLogin')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Github className="w-6 h-6 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-green-400">{t('githubCallback.loginSuccess')}</h2>
              <p className="text-gray-400">{t('githubCallback.redirecting')}</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}; 