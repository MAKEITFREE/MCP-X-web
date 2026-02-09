import React from 'react';
import { toast } from '../../utils/toast';

export const ToastDemo: React.FC = () => {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold mb-4">Toast 演示</h2>
      <div className="space-x-2">
        <button
          onClick={() => toast.success('操作成功！')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          成功提示
        </button>
        
        <button
          onClick={() => toast.error('操作失败，请重试')}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          错误提示
        </button>
        
        <button
          onClick={() => toast.warning('请注意，这是一个警告')}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          警告提示
        </button>
        
        <button
          onClick={() => toast.info('这是一个信息提示')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          信息提示
        </button>
        
        <button
          onClick={() => toast.success('这是一个长时间显示的提示', 10000)}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          长时间提示
        </button>
      </div>
    </div>
  );
}; 