import { useState, useEffect, useCallback, useRef } from 'react';
import { humanFeedbackService } from '../services/human-feedback.service';
import type { 
  HumanFeedbackStatus, 
  PendingFeedbackTask, 
  FeedbackOption,
  FeedbackOptionConfig
} from '../types/human-feedback';

/**
 * Human Feedback Hook 配置
 */
interface UseHumanFeedbackOptions {
  threadId: string;
  autoCheck?: boolean;
  checkInterval?: number;
  onFeedbackRequired?: (task: PendingFeedbackTask) => void;
  onFeedbackSubmitted?: (feedback: FeedbackOption) => void;
  onError?: (error: Error) => void;
}

/**
 * Human Feedback Hook 返回值
 */
interface UseHumanFeedbackReturn {
  // 状态
  isAwaitingFeedback: boolean;
  pendingTask: PendingFeedbackTask | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  
  // 方法
  checkStatus: () => Promise<void>;
  submitFeedback: (feedback: FeedbackOption) => Promise<void>;
  clearError: () => void;
  
  // 反馈选项配置
  feedbackOptions: FeedbackOptionConfig[];
}

/**
 * 反馈选项配置
 */
const FEEDBACK_OPTIONS: FeedbackOptionConfig[] = [
  {
    value: 'approved',
    label: '批准',
    description: '批准当前结果，继续执行',
    color: 'success',
    icon: '✓'
  },
  {
    value: 'rejected',
    label: '拒绝',
    description: '拒绝当前结果，重新处理',
    color: 'danger',
    icon: '✗'
  },
  {
    value: 'continue',
    label: '继续',
    description: '跳过确认，直接继续',
    color: 'warning',
    icon: '→'
  }
];

/**
 * Human Feedback 自定义Hook
 */
export function useHumanFeedback(options: UseHumanFeedbackOptions): UseHumanFeedbackReturn {
  const {
    threadId,
    autoCheck = false,
    checkInterval = 3000,
    onFeedbackRequired,
    onFeedbackSubmitted,
    onError
  } = options;

  // 状态
  const [isAwaitingFeedback, setIsAwaitingFeedback] = useState(false);
  const [pendingTask, setPendingTask] = useState<PendingFeedbackTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 引用
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<string>('');

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 处理错误
   */
  const handleError = useCallback((err: Error) => {
    const message = err.message || '未知错误';
    setError(message);
    onError?.(err);
    console.error('Human Feedback Error:', err);
  }, [onError]);

  /**
   * 检查反馈状态
   */
  const checkStatus = useCallback(async () => {
    if (!threadId) return;

    try {
      setIsLoading(true);
      clearError();

      const status = await humanFeedbackService.checkFeedbackStatus(threadId);
      
      setIsAwaitingFeedback(status.isAwaitingFeedback);
      
      if (status.isAwaitingFeedback && lastCheckRef.current !== threadId) {
        // 获取详细任务信息
        const task = await humanFeedbackService.getPendingFeedback(threadId);
        setPendingTask(task);
        onFeedbackRequired?.(task);
        lastCheckRef.current = threadId;
      } else if (!status.isAwaitingFeedback) {
        setPendingTask(null);
        lastCheckRef.current = '';
      }

    } catch (err) {
      handleError(err instanceof Error ? err : new Error('检查状态失败'));
    } finally {
      setIsLoading(false);
    }
  }, [threadId, onFeedbackRequired, clearError, handleError]);

  /**
   * 提交反馈
   */
  const submitFeedback = useCallback(async (feedback: FeedbackOption) => {
    if (!threadId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      clearError();

      await humanFeedbackService.submitFeedback({
        threadId,
        feedback
      });

      // 重置状态
      setIsAwaitingFeedback(false);
      setPendingTask(null);
      lastCheckRef.current = '';
      
      onFeedbackSubmitted?.(feedback);

    } catch (err) {
      handleError(err instanceof Error ? err : new Error('提交反馈失败'));
    } finally {
      setIsSubmitting(false);
    }
  }, [threadId, isSubmitting, onFeedbackSubmitted, clearError, handleError]);

  /**
   * 启动自动检查
   */
  const startAutoCheck = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (!isAwaitingFeedback) {
        checkStatus();
      }
    }, checkInterval);
  }, [checkStatus, checkInterval, isAwaitingFeedback]);

  /**
   * 停止自动检查
   */
  const stopAutoCheck = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 效果：自动检查
  useEffect(() => {
    if (autoCheck && threadId) {
      startAutoCheck();
      // 立即检查一次
      checkStatus();
    }

    return () => {
      stopAutoCheck();
    };
  }, [autoCheck, threadId, startAutoCheck, stopAutoCheck, checkStatus]);

  // 效果：清理
  useEffect(() => {
    return () => {
      stopAutoCheck();
    };
  }, [stopAutoCheck]);

  return {
    // 状态
    isAwaitingFeedback,
    pendingTask,
    isLoading,
    isSubmitting,
    error,
    
    // 方法
    checkStatus,
    submitFeedback,
    clearError,
    
    // 配置
    feedbackOptions: FEEDBACK_OPTIONS
  };
}

/**
 * 简化版Hook - 仅用于检查状态
 */
export function useHumanFeedbackStatus(threadId: string) {
  const [status, setStatus] = useState<HumanFeedbackStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!threadId) return;

    try {
      setIsLoading(true);
      setError(null);
      const result = await humanFeedbackService.checkFeedbackStatus(threadId);
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查状态失败');
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    isLoading,
    error,
    refetch: checkStatus
  };
}
