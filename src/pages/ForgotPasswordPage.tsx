import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../utils/toast';
import { Navbar } from '../components/layout/Navbar';
import api from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useLanguage();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  // 发送验证码
  const handleSendCode = async () => {
    if (!email.trim()) {
      setError(t('forgotPassword.enterEmail'));
      return;
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('forgotPassword.invalidEmail'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 调用发送验证码接口
      const res = await api.user.emailCode(email);
      if (res && res.code === 200) {
        toast.success(t('forgotPassword.codeSent'));
        setStep('code');
        
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(res?.msg || t('forgotPassword.sendCodeFailed'));
      }
    } catch (err: any) {
      console.error('发送验证码错误:', err);
      setError(err?.response?.data?.msg || err?.message || t('forgotPassword.sendCodeFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError(t('forgotPassword.enterCode'));
      return;
    }

    setStep('password');
    setError('');
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setError(t('forgotPassword.enterNewPassword'));
      return;
    }

    if (newPassword.length < 6) {
      setError(t('forgotPassword.passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('forgotPassword.passwordMismatch'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 这里应该调用重置密码的API
      // const res = await api.user.resetPassword({ email, code, newPassword });
      
      // 由于API可能还没有实现，先模拟成功
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(t('forgotPassword.resetSuccess'));
      navigate('/login');
    } catch (err: any) {
      console.error('重置密码错误:', err);
      setError(err?.response?.data?.msg || err?.message || t('forgotPassword.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendCode = async () => {
    if (countdown > 0) return;
    await handleSendCode();
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('forgotPassword.title')}</h1>
            {step === 'email' && (
              <p className="text-gray-400">{t('forgotPassword.emailStep')}</p>
            )}
            {step === 'code' && (
              <p className="text-gray-400">{t('forgotPassword.codeStep').replace('{email}', email)}</p>
            )}
            {step === 'password' && (
              <p className="text-gray-400">{t('forgotPassword.passwordStep')}</p>
            )}
          </div>

          <div className="bg-gray-900 p-8 rounded-xl border border-gray-800">
            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            {step === 'email' && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    {t('forgotPassword.emailLabel')}
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    disabled={loading}
                  />
                </div>

                <button
                  onClick={handleSendCode}
                  disabled={loading}
                  className="w-full bg-orange-500 text-black py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
                </button>
              </div>
            )}

            {step === 'code' && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium mb-2">
                    {t('forgotPassword.codeLabel')}
                  </label>
                  <input
                    type="text"
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={t('forgotPassword.codePlaceholder')}
                    maxLength={6}
                  />
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">
                    {t('forgotPassword.noCodeReceived')}
                  </span>
                  <button
                    onClick={handleResendCode}
                    disabled={countdown > 0}
                    className="text-orange-400 hover:text-orange-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    {countdown > 0 ? t('forgotPassword.resendAfter').replace('{seconds}', countdown.toString()) : t('forgotPassword.resend')}
                  </button>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleVerifyCode}
                    className="w-full bg-orange-500 text-black py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    {t('forgotPassword.verifyAndContinue')}
                  </button>
                  
                  <button
                    onClick={() => setStep('email')}
                    className="w-full border border-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    {t('forgotPassword.backToEmail')}
                  </button>
                </div>
              </div>
            )}

            {step === 'password' && (
              <div className="space-y-6">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                    {t('forgotPassword.newPasswordLabel')}
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={t('forgotPassword.newPasswordPlaceholder')}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                    {t('forgotPassword.confirmPasswordLabel')}
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="w-full bg-orange-500 text-black py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? t('forgotPassword.resetting') : t('forgotPassword.resetPassword')}
                  </button>
                  
                  <button
                    onClick={() => setStep('code')}
                    className="w-full border border-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    {t('forgotPassword.backToCode')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-orange-400 hover:text-orange-300 transition-colors"
            >
              {t('forgotPassword.rememberPassword')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};