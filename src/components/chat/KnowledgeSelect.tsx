import React, { useState, useEffect } from 'react';
import { KnowledgeInfo } from '../../types';
import { knowledgeApi } from '../../services/knowledgeApi';
import { toast } from '../../utils/toast';

interface KnowledgeSelectProps {
  selectedKnowledge?: KnowledgeInfo | null;
  onSelect: (knowledge: KnowledgeInfo | null) => void;
  onManageKnowledge: () => void;
  disabled?: boolean;
}

export const KnowledgeSelect: React.FC<KnowledgeSelectProps> = ({
  selectedKnowledge,
  onSelect,
  onManageKnowledge,
  disabled = false
}) => {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // 加载知识库列表
  const loadKnowledgeList = async (): Promise<KnowledgeInfo[]> => {
    setLoading(true);
    try {
      const response = await knowledgeApi.getKnowledgeList({ pageNum: 1, pageSize: 100 });
      if (response.code === 200 && response.rows) {
        setKnowledgeList(response.rows);
        return response.rows;
      } else {
        console.error('获取知识库列表失败:', response.msg);
        toast.error('获取知识库列表失败');
        return [];
      }
    } catch (error: any) {
      console.error('获取知识库列表错误:', error);
      toast.error('获取知识库列表失败');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeList();
  }, []);

  // 打开下拉时强制刷新列表，并在当前选择已被删除时清空选择
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const list = await loadKnowledgeList();
      if (selectedKnowledge) {
        const exists = list.some(k => String(k.id) === String(selectedKnowledge.id));
        if (!exists) {
          onSelect(null);
        }
      }
    })();
  }, [isOpen]);

  const handleSelect = (knowledge: KnowledgeInfo | null) => {
    onSelect(knowledge);
    setIsOpen(false);
  };

  const handleManage = () => {
    setIsOpen(false);
    onManageKnowledge();
  };

  return (
    <div className="relative inline-block">
      {/* 图标按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        title={selectedKnowledge ? `知识库：${selectedKnowledge.kname}` : '选择知识库'}
        className="relative p-2 rounded-md text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        {selectedKnowledge && (
          <span className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full bg-blue-500"></span>
        )}
      </button>

      {/* 上弹出菜单 */}
      {isOpen && (
        <div className="absolute z-50 w-80 bottom-full mb-2 left-0 bg-white border border-slate-200 rounded-lg shadow-xl">
          <div className="py-1">
            {/* 无选择项 */}
            <button
              onClick={() => handleSelect(null)}
              className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <span>不使用知识库</span>
              {!selectedKnowledge && (
                <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* 分隔线 */}
            {knowledgeList.length > 0 && <hr className="my-1 border-slate-200" />}

            {/* 知识库列表 */}
            {knowledgeList.length > 0 ? (
              knowledgeList.map((knowledge) => (
                <button
                  key={knowledge.id}
                  onClick={() => handleSelect(knowledge)}
                  className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <div className="flex-1 text-left">
                    <div className="font-medium">{knowledge.kname}</div>
                    {knowledge.description && (
                      <div className="text-xs text-slate-500 truncate max-w-xs">
                        {knowledge.description}
                      </div>
                    )}
                  </div>
                  {selectedKnowledge?.id === knowledge.id && (
                    <svg className="w-4 h-4 ml-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-500">
                暂无知识库
              </div>
            )}

            {/* 分隔线和管理选项 */}
            <hr className="my-1 border-slate-200" />
            <button
              onClick={handleManage}
              className="flex items-center w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              管理知识库
            </button>
          </div>
        </div>
      )}

      {/* 点击外部关闭下拉菜单 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
