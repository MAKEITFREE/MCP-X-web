import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations, languages, Language } from '../i18n/languages';

interface LanguageContextType {
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  languages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // 从 localStorage 获取保存的语言，默认为中文
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    const savedLang = localStorage.getItem('preferred-language');
    return savedLang || 'zh';
  });

  // 翻译函数
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[currentLanguage as keyof typeof translations];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
    
    // 如果找不到翻译，尝试使用中文作为后备
    if (value === undefined && currentLanguage !== 'zh') {
      let fallbackValue: any = translations.zh;
      for (const k of keys) {
        if (fallbackValue && typeof fallbackValue === 'object') {
          fallbackValue = fallbackValue[k];
        } else {
          fallbackValue = undefined;
          break;
        }
      }
      value = fallbackValue;
    }
    
    return typeof value === 'string' ? value : key;
  };

  // 设置语言并保存到 localStorage
  const setLanguage = (lang: string) => {
    setCurrentLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const contextValue: LanguageContextType = {
    currentLanguage,
    setLanguage,
    t,
    languages
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};
