/**
 * 语音识别支持检测工具
 * 检测浏览器环境和语音识别API支持情况
 */

// 检测是否为微信浏览器
export const isWeChatBrowser = (): boolean => {
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /micromessenger/.test(ua);
  } catch {
    return false;
  }
};

// 检测是否为移动端浏览器
export const isMobileBrowser = (): boolean => {
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|harmony|ipad|ipod|blackberry|iemobile|opera mini/.test(ua);
  } catch {
    return false;
  }
};

// 检测是否为iOS设备
export const isIOSDevice = (): boolean => {
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  } catch {
    return false;
  }
};

// 检测是否为Android设备
export const isAndroidDevice = (): boolean => {
  try {
    const ua = navigator.userAgent.toLowerCase();
    return /android/.test(ua);
  } catch {
    return false;
  }
};

// 检测语音识别API是否可用
export const isSpeechRecognitionSupported = (): boolean => {
  try {
    // 检查基本API是否存在
    const hasWebkitSpeechRecognition = 'webkitSpeechRecognition' in window;
    const hasSpeechRecognition = 'SpeechRecognition' in window;
    
    if (!hasWebkitSpeechRecognition && !hasSpeechRecognition) {
      return false;
    }

    // 微信浏览器通常不支持语音识别
    if (isWeChatBrowser()) {
      return false;
    }

    // iOS Safari 对语音识别支持有限
    if (isIOSDevice()) {
      // iOS 14.3+ 的 Safari 才开始支持语音识别，但仍有很多限制
      const version = getIOSVersion();
      if (version && version < 14.3) {
        return false;
      }
      // 即使版本支持，iOS Safari 的语音识别也经常不稳定
      // 建议在生产环境中禁用
      return false;
    }

    // Android 设备检查
    if (isAndroidDevice()) {
      // Android Chrome 通常支持，但需要检查版本
      const chromeVersion = getChromeVersion();
      if (chromeVersion && chromeVersion < 25) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

// 获取iOS版本号
const getIOSVersion = (): number | null => {
  try {
    const ua = navigator.userAgent;
    const match = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      return major + minor / 10;
    }
    return null;
  } catch {
    return null;
  }
};

// 获取Chrome版本号
const getChromeVersion = (): number | null => {
  try {
    const ua = navigator.userAgent;
    const match = ua.match(/Chrome\/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  } catch {
    return null;
  }
};

// 创建语音识别实例（如果支持的话）
export const createSpeechRecognition = (language: string = 'zh-CN'): any | null => {
  try {
    if (!isSpeechRecognitionSupported()) {
      return null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

    const recognition = new SpeechRecognition();
    
    // 配置语音识别参数
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.maxAlternatives = 1;
    
    // 设置超时时间
    if ('timeout' in recognition) {
      recognition.timeout = 10000; // 10秒超时
    }
    
    return recognition;
  } catch (error) {
    console.warn('创建语音识别实例失败:', error);
    return null;
  }
};

// 检测语音识别是否应该显示
export const shouldShowSpeechRecognition = (): boolean => {
  // 基本支持检测
  if (!isSpeechRecognitionSupported()) {
    return false;
  }

  // 微信浏览器隐藏
  if (isWeChatBrowser()) {
    return false;
  }

  // iOS设备隐藏（由于支持不稳定）
  if (isIOSDevice()) {
    return false;
  }

  // 其他移动端浏览器也可能不稳定，可以选择隐藏
  // 如果想要更保守的策略，可以取消注释下面的代码
  if (isMobileBrowser()) {
    return false;
  }

  return true;
};

// 获取浏览器环境描述（用于调试）
export const getBrowserEnvironmentInfo = (): string => {
  const info = [];
  
  if (isWeChatBrowser()) info.push('微信浏览器');
  if (isIOSDevice()) info.push('iOS设备');
  if (isAndroidDevice()) info.push('Android设备');
  if (isMobileBrowser()) info.push('移动端浏览器');
  
  const speechSupported = isSpeechRecognitionSupported();
  info.push(speechSupported ? '支持语音识别' : '不支持语音识别');
  
  const shouldShow = shouldShowSpeechRecognition();
  info.push(shouldShow ? '显示录音按钮' : '隐藏录音按钮');
  
  return info.join(', ');
};
