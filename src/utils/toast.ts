// 全局 toast 实例，会在 ToastProvider 挂载时被设置
let globalToast: {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
} | null = null;

export const setGlobalToast = (toastInstance: typeof globalToast) => {
  globalToast = toastInstance;
};

export const toast = {
  success: (message: string, duration?: number) => {
    if (globalToast) {
      globalToast.success(message, duration);
    } else {
      console.log('Toast success:', message);
    }
  },
  error: (message: string, duration?: number) => {
    if (globalToast) {
      globalToast.error(message, duration);
    } else {
      console.log('Toast error:', message);
    }
  },
  warning: (message: string, duration?: number) => {
    if (globalToast) {
      globalToast.warning(message, duration);
    } else {
      console.log('Toast warning:', message);
    }
  },
  info: (message: string, duration?: number) => {
    if (globalToast) {
      globalToast.info(message, duration);
    } else {
      console.log('Toast info:', message);
    }
  }
}; 