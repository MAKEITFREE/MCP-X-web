import React from 'react';
import { useHumanFeedback, useHumanFeedbackStatus } from '../../hooks/useHumanFeedback';
import type { FeedbackOption, PendingFeedbackTask } from '../../types/human-feedback';
import '../../styles/human-feedback.css';

/**
 * Human Feedback Panel 组件属性
 */
interface HumanFeedbackPanelProps {
  threadId: string;
  className?: string;
  autoCheck?: boolean;
  onFeedbackSubmitted?: (feedback: FeedbackOption) => void;
  onClose?: () => void;
}

/**
 * 反馈内容显示组件
 */
const FeedbackContent: React.FC<{ task: PendingFeedbackTask }> = ({ task }) => {
  return (
    <div className="feedback-content bg-slate-50 rounded-lg p-4 space-y-4">
      <div className="content-section">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">用户问题</h4>
        <div className="user-question text-sm text-slate-600 bg-white p-3 rounded border">
          {task.userQuestion || '无'}
        </div>
      </div>
      
      <div className="content-section">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">待审阅内容</h4>
        <div className="review-content bg-white p-3 rounded border">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap">{task.contentForReview}</pre>
        </div>
      </div>
      
      <div className="content-section">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">当前阶段</h4>
        <span className="stage-badge inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
          {task.stage}
        </span>
      </div>
    </div>
  );
};

/**
 * Human Feedback Panel 主组件
 */
export const HumanFeedbackPanel: React.FC<HumanFeedbackPanelProps> = ({
  threadId,
  className = '',
  autoCheck = true,
  onFeedbackSubmitted,
  onClose
}) => {
  const {
    isAwaitingFeedback,
    pendingTask,
    isLoading,
    isSubmitting,
    error,
    submitFeedback,
    clearError,
    feedbackOptions
  } = useHumanFeedback({
    threadId,
    autoCheck,
    onFeedbackSubmitted: (feedback) => {
      onFeedbackSubmitted?.(feedback);
      // 可选：自动关闭面板
      // onClose?.();
    }
  });

  const handleFeedbackClick = async (feedback: FeedbackOption) => {
    await submitFeedback(feedback);
  };

  const handleCloseClick = () => {
    clearError();
    onClose?.();
  };

  // 如果没有等待反馈的任务，不显示面板
  if (!isAwaitingFeedback && !error) {
    return null;
  }

  return (
    <div className={`human-feedback-panel bg-white border border-orange-200 rounded-lg shadow-lg ${className}`}>
      <div className="panel-header flex items-center justify-between p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          🤖 <span>Agent需要您的确认</span>
        </h3>
        {onClose && (
          <button 
            className="close-button w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            onClick={handleCloseClick}
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>

      <div className="panel-body p-4 space-y-4">
        {error && (
          <div className="error-message bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <span className="error-icon text-red-500">⚠️</span>
            <div className="flex-1">
              <span className="text-red-700 text-sm">{error}</span>
            </div>
            <button 
              onClick={clearError} 
              className="error-close w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 rounded"
            >
              ×
            </button>
          </div>
        )}

        {isLoading && (
          <div className="loading-state flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <div className="spinner w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-blue-700 text-sm">正在检查任务状态...</span>
          </div>
        )}

        {pendingTask && (
          <>
            <FeedbackContent task={pendingTask} />
            
            <div className="feedback-actions space-y-4">
              <h4 className="text-sm font-semibold text-slate-700">请选择您的操作：</h4>
              <div className="action-buttons grid grid-cols-1 sm:grid-cols-3 gap-3">
                {feedbackOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`feedback-button relative px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                      option.color === 'success' 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                        : option.color === 'danger'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200'
                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}`}
                    onClick={() => handleFeedbackClick(option.value)}
                    disabled={isSubmitting}
                    title={option.description}
                  >
                    <span className="button-icon text-lg">{option.icon}</span>
                    <span className="button-label">{option.label}</span>
                    {isSubmitting && (
                      <span className="button-spinner absolute right-2">⏳</span>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="feedback-description bg-slate-50 rounded-lg p-3 space-y-2">
                {feedbackOptions.map((option) => (
                  <div key={option.value} className="option-description text-xs text-slate-600">
                    <strong className="text-slate-700">{option.label}:</strong> {option.description}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * 简化的通知横幅组件
 */
export const HumanFeedbackBanner: React.FC<{ threadId: string; onShowDetails?: () => void; }>
  = ({ threadId, onShowDetails }) => {
  // 使用精简版状态查询（仅首次查询，不轮询），避免重复调用接口
  const { status, isLoading } = useHumanFeedbackStatus(threadId);
  const isAwaitingFeedback = !!status?.isAwaitingFeedback;

  if (!isAwaitingFeedback || isLoading) {
    return null;
  }

  return (
    <div className="human-feedback-banner bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
      <div className="banner-content flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="banner-icon">🤖</span>
          <span className="banner-text text-orange-800 font-medium text-sm">Agent正在等待您的确认</span>
        </div>
        {onShowDetails && (
          <button 
            className="banner-button px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 rounded transition-colors"
            onClick={onShowDetails}
          >
            查看详情
          </button>
        )}
      </div>
    </div>
  );
};

export default HumanFeedbackPanel;
