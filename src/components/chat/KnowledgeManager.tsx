import React, { useState, useEffect } from 'react';
import { KnowledgeInfo } from '../../types';
import { knowledgeApi } from '../../services/knowledgeApi';
import { KnowledgeForm } from './KnowledgeForm';
import { KnowledgeDetail } from './KnowledgeDetail';
import { toast } from '../../utils/toast';

interface KnowledgeManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeManager: React.FC<KnowledgeManagerProps> = ({ isOpen, onClose }) => {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeInfo | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeInfo | null>(null);

  // 加载知识库列表
  const loadKnowledgeList = async () => {
    setLoading(true);
    try {
      const response = await knowledgeApi.getKnowledgeList({ pageNum: 1, pageSize: 100 });
      if (response.code === 200 && response.rows) {
        setKnowledgeList(response.rows);
      } else {
        console.error('获取知识库列表失败:', response.msg);
        toast.error('获取知识库列表失败');
      }
    } catch (error: any) {
      console.error('获取知识库列表错误:', error);
      toast.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadKnowledgeList();
    }
  }, [isOpen]);

  // 保存知识库
  const handleSaveKnowledge = async (knowledge: KnowledgeInfo) => {
    try {
      if (editingKnowledge) {
        await knowledgeApi.editKnowledge(knowledge);
      } else {
        await knowledgeApi.saveKnowledge(knowledge);
      }
      await loadKnowledgeList(); // 重新加载列表
      setShowForm(false);
      setEditingKnowledge(null);
    } catch (error: any) {
      console.error('保存知识库失败:', error);
      throw error;
    }
  };

  // 编辑知识库
  const handleEdit = (knowledge: KnowledgeInfo) => {
    setEditingKnowledge(knowledge);
    setShowForm(true);
  };

  // 删除知识库
  const handleDelete = async (knowledge: KnowledgeInfo) => {
    if (!knowledge.id) {
      toast.error('知识库ID无效');
      return;
    }

    if (!confirm(`确定要删除知识库 "${knowledge.kname}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await knowledgeApi.removeKnowledge(knowledge.id as string);
      if (response.code === 200) {
        toast.success('删除知识库成功');
        await loadKnowledgeList(); // 重新加载列表
      } else {
        toast.error(response.msg || '删除知识库失败');
      }
    } catch (error: any) {
      console.error('删除知识库失败:', error);
      toast.error('删除知识库失败');
    }
  };

  // 新增知识库
  const handleCreate = () => {
    setEditingKnowledge(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingKnowledge(null);
  };

  // 查看知识库详情
  const handleViewDetail = (knowledge: KnowledgeInfo) => {
    setSelectedKnowledge(knowledge);
    setShowDetail(true);
  };

  const handleCloseDetail = () => {
    setShowDetail(false);
    setSelectedKnowledge(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* 标题栏 */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">知识库管理</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                新增知识库
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : knowledgeList.length === 0 ? (
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">暂无知识库</h3>
                <p className="mt-1 text-sm text-gray-500">开始创建您的第一个知识库</p>
                <div className="mt-6">
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    新增知识库
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {knowledgeList.map((knowledge) => (
                  <div
                    key={knowledge.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-base font-semibold text-gray-900 truncate max-w-[60%] pr-2">
                        {knowledge.kname}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(knowledge)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100"
                          title="编辑"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(knowledge)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-gray-100"
                          title="删除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {knowledge.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {knowledge.description}
                      </p>
                    )}

                    <div className="space-y-2 text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>检索条数:</span>
                        <span>{knowledge.retrieveLimit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>文本块大小:</span>
                        <span>{knowledge.textBlockSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>向量模型:</span>
                        <span className="truncate max-w-20">{knowledge.embeddingModelName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>公开状态:</span>
                        <span className={knowledge.share === 1 ? 'text-green-600' : 'text-gray-600'}>
                          {knowledge.share === 1 ? '公开' : '私有'}
                        </span>
                      </div>
                    </div>

                    {knowledge.createTime && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400">
                        创建时间: {new Date(knowledge.createTime).toLocaleDateString()}
                      </div>
                    )}

                    {/* 卡片底栏 - 幽灵主按钮 */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end">
                      <button
                        onClick={() => handleViewDetail(knowledge)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-blue-600 border border-blue-600 bg-transparent hover:bg-blue-50 active:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                        title="管理内容"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        管理内容
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 知识库表单弹窗 */}
      <KnowledgeForm
        key={editingKnowledge ? (editingKnowledge.id?.toString() || editingKnowledge.kid || 'edit') : 'create'}
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={handleSaveKnowledge}
        editingKnowledge={editingKnowledge}
      />

      {/* 知识库详情弹窗 */}
      {selectedKnowledge && (
        <KnowledgeDetail
          knowledge={selectedKnowledge}
          isOpen={showDetail}
          onClose={handleCloseDetail}
        />
      )}
    </>
  );
};
