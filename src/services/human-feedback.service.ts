import axios from 'axios';
import type { 
  HumanFeedbackStatus, 
  PendingFeedbackTask, 
  FeedbackSubmissionRequest, 
  ApiResponse 
} from '../types/human-feedback';

/**
 * Human Feedback API 服务类
 */
export class HumanFeedbackService {
  private baseURL = '/chat/human-feedback';

  /**
   * 检查是否有等待人工反馈的任务
   */
  async checkFeedbackStatus(threadId: string): Promise<HumanFeedbackStatus> {
    const response = await axios.get<ApiResponse<HumanFeedbackStatus>>(
      `${this.baseURL}/status/${threadId}`
    );
    
    if (response.data.code !== 200) {
      throw new Error(response.data.msg || '检查反馈状态失败');
    }
    
    return response.data.data;
  }

  /**
   * 获取等待反馈的任务详情
   */
  async getPendingFeedback(threadId: string): Promise<PendingFeedbackTask> {
    const response = await axios.get<ApiResponse<PendingFeedbackTask>>(
      `${this.baseURL}/pending/${threadId}`
    );
    
    if (response.data.code !== 200) {
      throw new Error(response.data.msg || '获取任务详情失败');
    }
    
    return response.data.data;
  }

  /**
   * 提交人工反馈
   */
  async submitFeedback(request: FeedbackSubmissionRequest): Promise<string> {
    const response = await axios.post<ApiResponse<string>>(
      `${this.baseURL}/submit`,
      request
    );
    
    if (response.data.code !== 200) {
      throw new Error(response.data.msg || '提交反馈失败');
    }
    
    return response.data.data;
  }

  /**
   * 轮询检查反馈状态
   */
  async pollFeedbackStatus(
    threadId: string, 
    intervalMs: number = 2000,
    maxAttempts: number = 30
  ): Promise<HumanFeedbackStatus> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const poll = async () => {
        try {
          attempts++;
          const status = await this.checkFeedbackStatus(threadId);
          
          if (status.isAwaitingFeedback) {
            resolve(status);
            return;
          }
          
          if (attempts >= maxAttempts) {
            reject(new Error('轮询超时，未检测到等待反馈的任务'));
            return;
          }
          
          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }
}

// 导出单例实例
export const humanFeedbackService = new HumanFeedbackService();
