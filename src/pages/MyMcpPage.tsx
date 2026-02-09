import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { api } from '../services/api';

export const MyMcpPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.userMcp.list({ pageNum: page, pageSize });
      const rows = res?.rows || res?.data || [];
      setData(Array.isArray(rows) ? rows : []);
      if (typeof res?.total === 'number') setTotal(res.total);
      setPageNum(page);
    } catch (e) {
      // 忽略单次错误
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">我的 MCP</h1>
            <button
              onClick={() => load(pageNum)}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 text-sm text-gray-400 border-b border-gray-800">
              <div className="col-span-3">Server ID</div>
              <div className="col-span-4">名称</div>
              <div className="col-span-5">配置概览</div>
            </div>
            {data.length === 0 ? (
              <div className="p-6 text-gray-500">暂无数据</div>
            ) : (
              data.map((item, idx) => {
                let summary = '';
                try {
                  const cfg = typeof item.serviceConfig === 'string' ? JSON.parse(item.serviceConfig) : (item.serviceConfig || {});
                  summary = JSON.stringify(cfg).slice(0, 140);
                } catch {
                  summary = String(item.serviceConfig).slice(0, 140);
                }
                return (
                  <div key={idx} className="grid grid-cols-12 px-4 py-3 text-sm border-t border-gray-800">
                    <div className="col-span-3 text-gray-300">{item.serverId || item.id}</div>
                    <div className="col-span-4 text-gray-200">{item.serverName || item.name || '-'}</div>
                    <div className="col-span-5 text-gray-400 truncate" title={summary}>{summary}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => load(Math.max(1, pageNum - 1))}
              disabled={loading || pageNum <= 1}
              className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-50"
            >上一页</button>
            <span className="text-sm text-gray-400">{pageNum} / {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button
              onClick={() => load(pageNum + 1)}
              disabled={loading || (pageNum >= Math.ceil(total / pageSize) && total > 0)}
              className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-50"
            >下一页</button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};


