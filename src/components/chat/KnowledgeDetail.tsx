import React, { useState, useEffect } from 'react';
import { KnowledgeInfo, KnowledgeAttach } from '../../types';
import { knowledgeApi } from '../../services/knowledgeApi';
import { KnowledgeFileUpload } from './KnowledgeFileUpload';
import { toast } from '../../utils/toast';

interface KnowledgeDetailProps {
  knowledge: KnowledgeInfo;
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeDetail: React.FC<KnowledgeDetailProps> = ({
  knowledge,
  isOpen,
  onClose
}) => {
  const [attachments, setAttachments] = useState<KnowledgeAttach[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('upload');

  // 加载附件列表
  const loadAttachments = async () => {
    if (!knowledge.id) return;
    
    setLoading(true);
    try {
      const response = await knowledgeApi.getKnowledgeAttach(knowledge.id.toString(), { pageNum: 1, pageSize: 100 });
      if (response.code === 200 && response.rows) {
        setAttachments(response.rows);
      } else {
        console.error('获取附件列表失败:', response.msg);
      }
    } catch (error: any) {
      console.error('获取附件列表错误:', error);
      toast.error('获取附件列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && knowledge.kid) {
      loadAttachments();
    }
  }, [isOpen, knowledge.kid]);

  // 删除附件
  const handleDeleteAttachment = async (attach: KnowledgeAttach) => {
    if (!confirm(`确定要删除附件 "${attach.attachName}" 吗？`)) {
      return;
    }

    try {
      const response = await knowledgeApi.removeAttach(attach.kid);
      if (response.code === 200) {
        toast.success('删除附件成功');
        await loadAttachments(); // 重新加载列表
      } else {
        toast.error(response.msg || '删除附件失败');
      }
    } catch (error: any) {
      console.error('删除附件失败:', error);
      toast.error('删除附件失败');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes as any)) return '-';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件类型图标
  const getFileIcon = (fileName?: string) => {
    if (!fileName || typeof fileName !== 'string') return '📎';
    const parts = fileName.split('.');
    const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'ppt':
      case 'pptx':
        return '📊';
      case 'txt':
      case 'md':
        return '📃';
      default:
        return '📎';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{knowledge.kname}</h2>
            <p className="text-sm text-gray-600 mt-1">知识库内容管理</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 标签切换 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            上传文件
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'files'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            文件列表 ({attachments.length})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'upload' ? (
            /* 文件上传标签页 */
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">上传知识库文件</h3>
              {knowledge.id ? (
                <KnowledgeFileUpload
                  id={knowledge.id}
                  onUploadSuccess={() => {
                    loadAttachments();
                    toast.success('文件上传成功，正在解析中...');
                  }}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  知识库ID无效，无法上传文件
                </div>
              )}
            </div>
          ) : (
            /* 文件列表标签页 */
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">已上传的文件</h3>
                <button
                  onClick={loadAttachments}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  disabled={loading}
                >
                  {loading ? '刷新中...' : '刷新'}
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">加载中...</span>
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">暂无文件</h3>
                  <p className="mt-1 text-sm text-gray-500">开始上传您的第一个文件</p>
                  <div className="mt-6">
                    <button
                      onClick={() => setActiveTab('upload')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      上传文件
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getFileIcon(attachment?.docName || attachment?.attachName)}</span>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {attachment?.docName || attachment?.attachName || '未命名文件'}
                          </h4>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{formatFileSize(attachment?.attachSize)}</span>
                            <span>类型: {attachment?.docType || attachment?.attachType || '-'}</span>
                            {/* <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                attachment.vectorStatus === 30
                                  ? 'bg-green-100 text-green-800'
                                  : attachment.vectorStatus === 10
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {attachment.vectorStatus === 30
                                ? '已处理'
                                : attachment.vectorStatus === 10
                                ? '待处理'
                                : '处理失败'}
                            </span> */}
                            {attachment.createTime && (
                              <span>
                                {new Date(attachment.createTime).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAttachment(attachment)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="删除文件"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
