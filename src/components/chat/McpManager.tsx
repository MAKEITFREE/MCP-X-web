import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { DetailedServer, Server } from '../../types';
import { toast } from '../../utils/toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { mcpService, MCPServiceConfig, MCPTool } from '../../services/mcpService';

interface McpManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: { selectedServerIds: string[]; configMap: Record<string, any> }) => void;
  initialSelectedIds?: string[];
  initialConfigMap?: Record<string, any>;
  defaultTab?: 'manage' | 'my';
}

export const McpManager: React.FC<McpManagerProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSelectedIds = [],
  initialConfigMap = {},
  defaultTab = 'manage'
}) => {
  const { currentLanguage } = useLanguage();
  const [loading, setLoading] = useState<boolean>(false);
  const [servers, setServers] = useState<Server[]>([]);
  // const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds); // 暂时不使用
  const [activeId, setActiveId] = useState<string | null>(initialSelectedIds[0] || null);
  const [detailMap, setDetailMap] = useState<Record<string, DetailedServer | null>>({});
  const [configMap, setConfigMap] = useState<Record<string, any>>(initialConfigMap);
  const [rawJsonMap, setRawJsonMap] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'manage' | 'my'>(defaultTab);
  const [myLoading, setMyLoading] = useState<boolean>(false);
  const [myList, setMyList] = useState<any[]>([]);
  const [myPageNum, setMyPageNum] = useState<number>(1);
  const [myPageSize] = useState<number>(10);
  const [myTotal, setMyTotal] = useState<number>(0);
  const [myEditingId, setMyEditingId] = useState<string | null>(null);
  const [myEditingRaw, setMyEditingRaw] = useState<string>('');
  const [toolsMap, setToolsMap] = useState<Record<string, MCPTool[]>>({});
  const [toolsLoading, setToolsLoading] = useState<Record<string, boolean>>({});
  const myCount = useMemo(() => (myTotal && myTotal > 0 ? myTotal : myList.length), [myTotal, myList]);
  const getDisplayNameByAny = (s: any): string => {
    if (!s) return '';
    if (currentLanguage === 'zh') {
      return s.chineseName || s.nameCn || s.name || s.handle || '';
    }
    return s.name || s.nameEn || s.handle || '';
  };

  // 预检测：使用新的 MCP 服务进行探测
  const probeMcpTools = async (serviceConfig: MCPServiceConfig): Promise<boolean> => {
    try {
      const result = await mcpService.probeMCPTools(serviceConfig);
      if (result.ok && result.tools) {
        // 缓存工具列表
        const configKey = JSON.stringify(serviceConfig);
        setToolsMap(prev => ({ ...prev, [configKey]: result.tools || [] }));
      }
      return result.ok;
    } catch (error) {
      console.error('MCP 工具探测失败:', error);
      return false;
    }
  };

  // 执行 MCP 工具
  const runMcpTool = async (serviceConfig: MCPServiceConfig, tool: string, args?: any) => {
    try {
      const result = await mcpService.executeMCPTool(serviceConfig, tool, args);
      return result;
    } catch (error) {
      console.error('MCP 工具执行失败:', error);
      return { 
        ok: false, 
        message: error instanceof Error ? error.message : '执行失败' 
      };
    }
  };

  // 加载工具列表
  const loadMcpTools = async (serviceConfig: MCPServiceConfig, configKey: string) => {
    if (toolsLoading[configKey]) return;
    
    setToolsLoading(prev => ({ ...prev, [configKey]: true }));
    try {
      const result = await mcpService.probeMCPTools(serviceConfig);
      if (result.ok && result.tools) {
        setToolsMap(prev => ({ ...prev, [configKey]: result.tools || [] }));
      }
    } catch (error) {
      console.error('加载 MCP 工具失败:', error);
    } finally {
      setToolsLoading(prev => ({ ...prev, [configKey]: false }));
    }
  };

  // 保存单个 MCP（可传入原始 JSON 覆盖）
  const saveSingle = async (sid: string, rawOverride?: string, omitName?: boolean) => {
    try {
      const userId = localStorage.getItem('userId');
      let cfg: any = {};
      const raw = rawOverride !== undefined ? rawOverride : rawJsonMap[sid];
      if (typeof raw === 'string' && raw.trim() !== '') {
        try { cfg = JSON.parse(raw); } catch { cfg = configMap[sid] ?? {}; }
      } else {
        cfg = configMap[sid] ?? {};
      }

      const server = servers.find(s => s.id === sid);
      let serverName = getDisplayNameByAny(server as any);
      if (!serverName) {
        const detail: any = detailMap[sid];
        serverName = getDisplayNameByAny(detail);
      }
      if (!serverName) serverName = sid;

      const payload: any = {
        userId,
        serverId: sid,
        serviceConfig: JSON.stringify(cfg)
      };
      if (!omitName) payload.name = serverName;

      // 如果我的列表中已存在该 serverId：直接更新，否则新增
      const existing = myList.find((it: any) => String(it.serverId ?? it.id) === String(sid));
      if (existing && existing.id) {
        payload.id = existing.id;
        const updRes: any = await api.userMcp.saveOrUpdate(payload);
        if (!(updRes && updRes.code === 200)) {
          throw new Error(updRes?.msg || updRes?.message || '更新失败');
        }
      } else {
        const addRes: any = await api.userMcp.add(payload);
        if (!(addRes && addRes.code === 200)) {
          throw new Error(addRes?.msg || addRes?.message || '新增失败');
        }
      }
      return true;
    } catch (e) {
      console.error('保存用户MCP配置失败:', e);
      toast.error('保存失败');
      return false;
    }
  };

  // 拉取服务器列表
  const loadServers = async () => {
    setLoading(true);
    try {
      const res = await api.server.fetchServers();
      setServers(res.servers || []);
    } catch (e) {
      console.error('加载MCP服务器列表失败:', e);
      toast.error('加载MCP服务器列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 执行搜索
  const performSearch = async () => {
    const key = searchKey.trim();
    if (!key) {
      await loadServers();
      return;
    }
    setSearching(true);
    try {
      const res = await api.search.search(key);
      const list: any[] = (res && (res.data || res.rows || res)) || [];
      const mapped: Server[] = (Array.isArray(list) ? list : []).map((item: any, idx: number) => {
        const id = (item.id ?? item.serverId ?? item.sid ?? idx).toString();
        const name = item.name || item.chineseName || item.nameCn || item.handle || `MCP-${idx}`;
        const handle = item.handle || (typeof name === 'string' ? name.toLowerCase().replace(/\s+/g, '-') : `mcp-${idx}`);
        const description = item.descriptionEn || item.descriptionCn || item.description || '';
        return {
          id,
          name,
          handle,
          description,
          category: '精选MCP' as any,
          tags: ['Remote'],
          usage: item.usageCount || 0,
          usageLabel: (item.usageLabel as string) || String(item.usageCount || 0),
          verified: !!item.verified,
          new: !!item.isNew
        } as Server;
      });
      setServers(mapped);
    } catch (e) {
      console.error('搜索MCP失败:', e);
      toast.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 拉取详情
  const ensureDetail = async (id: string) => {
    if (detailMap[id] !== undefined) return;
    try {
      const detail = await api.server.getServerById(id);
      setDetailMap(prev => ({ ...prev, [id]: detail }));
      const existing = detail?.serverConfig ?? {};
      setConfigMap(prev => ({ ...prev, [id]: existing }));
      setRawJsonMap(prev => ({ ...prev, [id]: JSON.stringify(existing ?? {}, null, 2) }));
    } catch (e) {
      console.error('获取MCP详情失败:', e);
      toast.error('获取MCP详情失败');
      setDetailMap(prev => ({ ...prev, [id]: null }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      if (defaultTab === 'manage') {
        loadServers();
      } else {
        loadMyMcp(1);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    // 打开时若有初始选中，优先加载第一个的详情
    if (isOpen && initialSelectedIds.length > 0) {
      ensureDetail(initialSelectedIds[0]);
    }
  }, [isOpen]);

  // const activeDetail = useMemo(() => (activeId ? detailMap[activeId] : null), [activeId, detailMap]);
  const activeRaw = useMemo(() => (activeId ? rawJsonMap[activeId] ?? '' : ''), [activeId, rawJsonMap]);

  const toggleSelect = async (id: string) => {
    // setSelectedIds(prev => {
    //   const exists = prev.includes(id);
    //   const next = exists ? prev.filter(x => x !== id) : [...prev, id];
    //   return next;
    // });
    setActiveId(id);
    await ensureDetail(id);
  };

  const handleJsonChange = (id: string, value: string) => {
    setRawJsonMap(prev => ({ ...prev, [id]: value }));
    try {
      const parsed = value?.trim() ? JSON.parse(value) : {};
      setConfigMap(prev => ({ ...prev, [id]: parsed }));
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e?.message || 'JSON解析错误');
    }
  };

  const handleSave = async () => {
    if (jsonError) {
      toast.error('请先修复 JSON 错误');
      return;
    }
    try {
      const sid = activeId;
      if (!sid) {
        toast.error('请先在左侧选择一个 MCP 服务');
        return;
      }
      const ok = await saveSingle(sid);
      if (!ok) return;
      onSave({ selectedServerIds: [sid], configMap });
      toast.success('已保存到服务器');
      // 保存成功后停留在弹窗，并切换到“我的 MCP”选项卡并刷新列表以展示新增项
      setActiveTab('my');
      await loadMyMcp(1);
    } catch (e) {
      console.error('保存用户MCP配置失败:', e);
      toast.error('保存失败');
      // 保存失败不跳转，不刷新选项卡
      return;
    }
  };

  // 我的MCP：拉取列表
  const loadMyMcp = async (page = 1) => {
    setMyLoading(true);
    try {
      const res = await api.userMcp.list({ pageNum: page, pageSize: myPageSize });
      const rows = res?.rows || res?.data || [];
      setMyList(Array.isArray(rows) ? rows : []);
      if (typeof res?.total === 'number') setMyTotal(res.total);
      setMyPageNum(page);
    } catch (e) {
      // 忽略单次失败
    } finally {
      setMyLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] overflow-hidden shadow-xl">
        {/* 标题栏（右上角关闭） */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">MCP 工具配置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="关闭"
            title="关闭"
          >
            ×
          </button>
        </div>

        {/* 选项卡 */}
        <div className="px-4 pt-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              className={`px-3 py-2 text-sm rounded-t ${activeTab === 'my' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => { setActiveTab('my'); loadMyMcp(1); }}
            >
              我的 MCP{myCount > 0 ? `（${myCount}）` : ''}
            </button>
            <button
              className={`px-3 py-2 text-sm rounded-t ${activeTab === 'manage' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => { setActiveTab('manage'); loadServers(); }}
            >
              MCP市场
            </button>
          </div>
        </div>
        

        {/* 内容区 */}
        <div className="grid grid-cols-12 gap-0">
          {/* 左侧列表 */}
          {activeTab === 'manage' ? (
          <>
          <div className="col-span-5 border-r border-gray-200 h-[calc(90vh-140px)] flex flex-col">
            {/* 搜索框 */}
            <div className="p-3 border-b border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  value={searchKey}
                  onChange={(e) => setSearchKey(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') performSearch(); }}
                  className="flex-1 px-3 py-2 text-sm bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="搜索 MCP（名称、描述、Handle）"
                />
                <button
                  onClick={performSearch}
                  disabled={searching}
                  className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  搜索
                </button>
                <button
                  onClick={() => { setSearchKey(''); loadServers(); }}
                  className="px-3 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  重置
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-6 text-gray-500">加载中...</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {servers.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-blue-50 ${activeId === s.id ? 'bg-blue-50' : 'bg-white'}`}
                    onClick={() => { toggleSelect(s.id); setActiveId(s.id); ensureDetail(s.id); }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{currentLanguage === 'zh' ? ((s as any).chineseName || (s as any).nameCn || s.name || s.handle) : (s.name || (s as any).nameEn || s.handle)}</div>
                      {((currentLanguage === 'zh' ? ((s as any).descriptionCn || s.description) : (s.description || (s as any).descriptionEn)) || '') && (
                        <div className="text-xs text-gray-500 truncate">{currentLanguage === 'zh' ? ((s as any).descriptionCn || s.description || '') : (s.description || (s as any).descriptionEn || '')}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* 右侧配置编辑 */}
          <div className="col-span-7 overflow-y-auto h-[calc(90vh-100px)]">
            {activeId ? (
              <div className="p-4 relative h-full flex flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm text-gray-600">服务 ID：{activeId}</div>
                  {jsonError && <div className="text-xs text-red-600">{jsonError}</div>}
                </div>
                
                {/* 工具列表和配置编辑区域分割 */}
                <div className="flex-1 flex flex-col gap-4">
                  {/* 配置编辑区 */}
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 mb-2">配置编辑：</div>
                    <textarea
                      className="w-full h-[35vh] font-mono text-xs border border-gray-300 rounded-md p-3 bg-white text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 selection:bg-blue-100 selection:text-gray-900"
                      placeholder="在此编辑 serviceConfig（标准 MCP JSON），左侧选择不同服务可切换配置"
                      value={activeRaw}
                      onChange={(e) => handleJsonChange(activeId, e.target.value)}
                    />
                  </div>

                  {/* 工具列表区 */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-600">MCP 工具列表：</div>
                      <button
                        onClick={() => {
                          const configKey = JSON.stringify(configMap[activeId] || {});
                          loadMcpTools(configMap[activeId] || {}, configKey);
                        }}
                        disabled={toolsLoading[JSON.stringify(configMap[activeId] || {})] || !!jsonError}
                        className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {toolsLoading[JSON.stringify(configMap[activeId] || {})] ? '检测中...' : '检测工具'}
                      </button>
                    </div>
                    <div className="border border-gray-300 rounded-md h-[20vh] overflow-y-auto bg-gray-50">
                      {(() => {
                        const configKey = JSON.stringify(configMap[activeId] || {});
                        const tools = toolsMap[configKey] || [];
                        const loading = toolsLoading[configKey];
                        
                        if (loading) {
                          return <div className="p-3 text-gray-500 text-xs">正在检测工具...</div>;
                        }
                        
                        if (tools.length === 0) {
                          return <div className="p-3 text-gray-500 text-xs">暂无工具，请点击"检测工具"按钮</div>;
                        }
                        
                        return (
                          <div className="p-2">
                            {tools.map((tool, idx) => (
                              <div key={idx} className="mb-2 p-2 bg-white rounded border border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-medium text-gray-800">{tool.name}</div>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const result = await runMcpTool(configMap[activeId] || {}, tool.name, {});
                                        if (result.ok) {
                                          toast.success(`工具 ${tool.name} 执行成功`);
                                          console.log('工具执行结果:', result.result);
                                        } else {
                                          toast.error(`工具 ${tool.name} 执行失败: ${result.message}`);
                                        }
                                      } catch (error) {
                                        toast.error(`工具 ${tool.name} 执行异常`);
                                        console.error('工具执行异常:', error);
                                      }
                                    }}
                                    className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                                  >
                                    测试
                                  </button>
                                </div>
                                {tool.description && (
                                  <div className="text-xs text-gray-600 mt-1">{tool.description}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* 右下角操作按钮（仅管理页显示） */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={!!jsonError}
                  >
                    保存
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    关闭
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-gray-500">请选择左侧的 MCP 服务</div>
            )}
          </div>
          </>
          ) : (
          <div className="col-span-12 h-[calc(90vh-140px)] overflow-y-auto">
            {myLoading ? (
              <div className="p-6 text-gray-500">加载中...</div>
            ) : myList.length === 0 ? (
              <div className="p-6 text-gray-500 flex flex-col items-center gap-3">
                <div>暂无数据</div>
                <button
                  onClick={() => { setActiveTab('manage'); loadServers(); }}
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  去管理市场添加
                </button>
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-12 px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded">
                  <div className="col-span-3">Server ID</div>
                  <div className="col-span-3">名称</div>
                  <div className="col-span-4">配置概览</div>
                  <div className="col-span-2 text-right">状态</div>
                </div>
                {myEditingId && (
                  <div className="mt-3 p-3 border border-gray-200 rounded bg-white">
                    <div className="mb-2 text-sm text-gray-600">编辑配置（ID：{myEditingId}）</div>
                    <textarea
                      className="w-full h-40 font-mono text-xs border border-gray-300 rounded p-2 bg-white text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={myEditingRaw}
                      onChange={(e) => setMyEditingRaw(e.target.value)}
                    />
                    <div className="mt-2 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setMyEditingId(null); setMyEditingRaw(''); }}
                        className="px-3 py-1.5 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >取消</button>
                      <button
                        onClick={async () => {
                          if (!myEditingId) return;
                          const ok = await saveSingle(myEditingId, myEditingRaw, true);
                          if (!ok) return;
                          toast.success('已保存到服务器');
                          await loadMyMcp(myPageNum);
                          setMyEditingId(null);
                          setMyEditingRaw('');
                        }}
                        className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                      >保存</button>
                    </div>
                  </div>
                )}
                {myList.map((item, idx) => {
                  let summary = '';
                  try {
                    const cfg = typeof item.serviceConfig === 'string' ? JSON.parse(item.serviceConfig) : (item.serviceConfig || {});
                    summary = JSON.stringify(cfg).slice(0, 140);
                  } catch {
                    summary = String(item.serviceConfig).slice(0, 140);
                  }
                  return (
                    <div key={idx} className="grid grid-cols-12 px-3 py-2 text-sm border-b border-gray-100 items-center">
                      <div className="col-span-3 text-gray-800">{item.serverId || item.id}</div>
                      <div className="col-span-3 text-gray-800">{item.serverName || item.name || '-'}</div>
                      <div className="col-span-4 text-gray-600 truncate" title={summary}>{summary}</div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-2">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={String(item.status || 0) === '1'}
                            onChange={async (e) => {
                              const id = Number(item.id || item.serverId);
                              if (e.target.checked) {
                                try {
                                  // 解析 JSON 并做启用前的探测（远程可达/工具列表）
                                  let cfg: any = {};
                                  try {
                                    cfg = typeof item.serviceConfig === 'string' ? JSON.parse(item.serviceConfig) : (item.serviceConfig || {});
                                  } catch {}
                                  const ok = await probeMcpTools(cfg);
                                  if (!ok) {
                                    toast.error('MCP未就绪，请先确认本地/远程服务可用');
                                    await loadMyMcp(myPageNum);
                                    return;
                                  }
                                  // 探测成功 → 通知后端启动
                                  const res: any = await api.userMcp.start(id);
                                  if (!(res && res.code === 200)) throw new Error(res?.msg || res?.message || '启动失败');
                                  toast.success('已启用');
                                  await loadMyMcp(myPageNum);
                                } catch (err) {
                                  toast.error('启用失败');
                                  await loadMyMcp(myPageNum);
                                }
                              } else {
                                // 取消勾选暂不处理（后端未给停用接口），刷新恢复状态
                                await loadMyMcp(myPageNum);
                              }
                            }}
                          />
                          <span className="ml-2 text-xs text-gray-600">启用</span>
                        </label>
                        <button
                          onClick={async () => {
                            try {
                              let cfg: any = {};
                              try {
                                cfg = typeof item.serviceConfig === 'string' ? JSON.parse(item.serviceConfig) : (item.serviceConfig || {});
                              } catch {}
                              
                              const result = await mcpService.probeMCPTools(cfg);
                              if (result.ok && result.tools && result.tools.length > 0) {
                                toast.success(`检测到 ${result.tools.length} 个工具: ${result.tools.map(t => t.name).join(', ')}`);
                              } else {
                                toast.error('未检测到可用工具');
                              }
                            } catch (error) {
                              toast.error('工具检测失败');
                              console.error('工具检测失败:', error);
                            }
                          }}
                          className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700"
                        >检测</button>
                        <button
                          onClick={async () => {
                            const sid = String(item.serverId || item.id);
                            const userRaw = typeof item.serviceConfig === 'string'
                              ? item.serviceConfig
                              : JSON.stringify(item.serviceConfig || {}, null, 2);
                            if (activeTab === 'my') {
                              setMyEditingId(sid);
                              setMyEditingRaw(userRaw);
                            } else {
                              setActiveTab('manage');
                              await ensureDetail(sid);
                              setActiveId(sid);
                              // setSelectedIds(prev => (prev.includes(sid) ? prev : [...prev, sid])); // 暂时不使用
                              setRawJsonMap(prev => ({ ...prev, [sid]: userRaw }));
                            }
                          }}
                          className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >编辑</button>
                        <button
                          onClick={async () => {
                            try {
                              const res: any = await api.userMcp.remove(item.id || item.serverId);
                              if (!(res && res.code === 200)) {
                                throw new Error(res?.msg || res?.message || '删除失败');
                              }
                              toast.success('已删除');
                              await loadMyMcp(Math.max(1, myPageNum));
                            } catch (e) {
                              console.error('删除失败:', e);
                              toast.error('删除失败');
                            }
                          }}
                          className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >删除</button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => loadMyMcp(Math.max(1, myPageNum - 1))}
                    disabled={myLoading || myPageNum <= 1}
                    className="px-3 py-1.5 bg-gray-100 rounded disabled:opacity-50"
                  >上一页</button>
                  <span className="text-sm text-gray-500">{myPageNum} / {Math.max(1, Math.ceil(myTotal / myPageSize))}</span>
                  <button
                    onClick={() => loadMyMcp(myPageNum + 1)}
                    disabled={myLoading || (myPageNum >= Math.ceil(myTotal / myPageSize) && myTotal > 0)}
                    className="px-3 py-1.5 bg-gray-100 rounded disabled:opacity-50"
                  >下一页</button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};


