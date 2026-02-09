// Human Feedback 相关类型定义

/**
 * 人工反馈状态
 */
export interface HumanFeedbackStatus {
  isAwaitingFeedback: boolean;
  threadId: string;
  pendingContent: string;
  feedbackOptions: string;
}

/**
 * 待反馈任务详情
 */
export interface PendingFeedbackTask {
  threadId: string;
  userQuestion: string;
  contentForReview: string;
  feedbackOptions: string;
  awaitingFeedback: boolean;
  stage: string;
}

/**
 * 反馈提交请求
 */
export interface FeedbackSubmissionRequest {
  threadId: string;
  feedback: 'approved' | 'rejected' | 'continue';
}

/**
 * API响应类型
 */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

/**
 * 反馈选项
 */
export type FeedbackOption = 'approved' | 'rejected' | 'continue';

/**
 * 反馈选项配置
 */
export interface FeedbackOptionConfig {
  value: FeedbackOption;
  label: string;
  description: string;
  color: 'success' | 'danger' | 'warning';
  icon: string;
}
