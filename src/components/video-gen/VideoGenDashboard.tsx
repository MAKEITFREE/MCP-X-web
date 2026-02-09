import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Loader2, Folder, ChevronRight, Calendar, AlertTriangle, Upload, ArrowLeft } from 'lucide-react';
import type { VideoGenProject } from '../../types/videogen';
import { createNewProjectState, saveProjectToDB, getAllProjectsMetadata } from '../../services/videogenService';
import { chatApi } from '../../services/chatApi';

interface Props {
  onOpenProject: (project: VideoGenProject) => void;
}

// 全局标志：服务端数据是否已同步完成
let serverSyncCompleted = false;

// 导出函数供其他组件检查同步状态
export const isServerSyncCompleted = () => serverSyncCompleted;

const VideoGenDashboard: React.FC<Props> = ({ onOpenProject }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<VideoGenProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // 是否正在同步服务端数据

  // 从后端 session 接口加载项目列表
  const loadProjects = async () => {
    // 重置同步状态
    serverSyncCompleted = false;
    setIsSyncing(true);
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.warn('用户未登录');
      setProjects([]);
      setIsLoading(false);
      setIsSyncing(false);
      serverSyncCompleted = true;
      return;
    }

    // 第一步：立即从 IndexedDB 加载本地缓存并显示
    let localProjects: VideoGenProject[] = [];
    try {
      localProjects = await getAllProjectsMetadata();
      console.log('📦 从 IndexedDB 加载了', localProjects.length, '个本地项目');
      
      // 立即显示本地缓存的项目，不等待服务端
      if (localProjects.length > 0) {
        localProjects.sort((a, b) => b.lastModified - a.lastModified);
        setProjects(localProjects);
        setIsLoading(false); // 本地数据加载完成，立即结束loading状态
        console.log('✅ 已显示本地缓存项目，后台继续同步服务端数据...');
      }
    } catch (error) {
      console.warn('加载 IndexedDB 失败:', error);
    }
    
    // 如果没有本地缓存，保持loading状态等待服务端
    if (localProjects.length === 0) {
      setIsLoading(true);
    }
    
    // 构建本地项目索引，用于快速匹配
    const localProjectsMap = new Map<string, VideoGenProject>(); // sessionId -> project
    const localProjectsById = new Map<string, VideoGenProject>(); // id -> project
    localProjects.forEach(p => {
      if (p.sessionId) {
        localProjectsMap.set(String(p.sessionId), p);
      }
      if (p.id) {
        localProjectsById.set(p.id, p);
      }
    });

    // 解析时间字符串的辅助函数
    const parseTimeString = (timeStr: any): number => {
      if (!timeStr) return Date.now();
      if (typeof timeStr === 'number') {
        return timeStr > 1000000000000 ? timeStr : timeStr * 1000;
      }
      if (typeof timeStr === 'string') {
        const cnMatch = timeStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)(\d{1,2}):(\d{2})/);
        if (cnMatch) {
          const [, year, month, day, period, hour, minute] = cnMatch;
          let hourNum = parseInt(hour);
          if (period === '下午' && hourNum !== 12) hourNum += 12;
          else if (period === '上午' && hourNum === 12) hourNum = 0;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hourNum, parseInt(minute)).getTime();
        }
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) return date.getTime();
      }
      return Date.now();
    };

    // 将 session 转换为 VideoGenProject，优先使用服务端数据
    const convertSessionsToProjects = (sessions: any[]): VideoGenProject[] => {
      const syncedSessionIds = new Set<string>();
      const syncedProjectIds = new Set<string>();
      const projectList: VideoGenProject[] = [];
      
      sessions.forEach((session: any) => {
        const sessionId = String(session.id || session.sessionId);
        
        // 从服务端 sessionContent 或 content 解析项目数据
        let serverProjectData: Partial<VideoGenProject> = {};
        let hasValidServerData = false;
        const contentStr = session.sessionContent || session.content;
        if (contentStr && typeof contentStr === 'string') {
          const trimmed = contentStr.trim();
          if (trimmed.startsWith('{')) {
            try {
              serverProjectData = JSON.parse(trimmed);
              hasValidServerData = !!(serverProjectData.scriptData || (serverProjectData.shots && serverProjectData.shots.length > 0) || serverProjectData.rawScript);
            } catch (e) {}
          }
        }

        // 尝试通过多种维度在本地查找匹配的项目，确保不产生重复条目
        const localProject = (serverProjectData.id ? localProjectsById.get(serverProjectData.id) : null) 
                           || localProjectsMap.get(sessionId);
        
        const projectId = serverProjectData.id || localProject?.id || `proj_${sessionId}`;
        
        // 如果该项目 ID 已经处理过，直接跳过，防止重复显示
        if (syncedProjectIds.has(projectId)) {
          return;
        }

        const createTime = parseTimeString(session.createTime);
        const updateTime = session.updateTime ? parseTimeString(session.updateTime) : createTime;

        // 辅助函数：合并分镜，确保包含图片的分镜不被覆盖
        const mergeShots = (serverShots: Shot[], localShots: Shot[]): Shot[] => {
          if (!serverShots || serverShots.length === 0) return localShots || [];
          if (!localShots || localShots.length === 0) return serverShots;
          
          // 如果分镜数量不一致，优先使用服务端（除非服务端为空）
          if (serverShots.length !== localShots.length) return serverShots;
          
          // 数量一致时，逐个分镜合并，保留有图片的关键帧
          return serverShots.map((ss, idx) => {
            const ls = localShots[idx];
            if (!ls) return ss;
            
            const mergedKeyframes = (ss.keyframes || []).map(skf => {
              const lkf = (ls.keyframes || []).find(k => k.type === skf.type);
              // 如果服务端没图片但本地有，保留本地图片
              if (!skf.imageUrl && lkf?.imageUrl) {
                return { ...skf, imageUrl: lkf.imageUrl, status: lkf.status || 'completed' };
              }
              return skf;
            });
            
            return { ...ss, keyframes: mergedKeyframes };
          });
        };

        const mergedProject: VideoGenProject = {
          id: projectId,
          sessionId: sessionId,
          title: session.sessionTitle || serverProjectData.title || localProject?.title || '未命名项目',
          createdAt: createTime,
          lastModified: updateTime,
          stage: serverProjectData.stage || localProject?.stage || 'script',
          targetDuration: serverProjectData.targetDuration || localProject?.targetDuration || '60s',
          language: serverProjectData.language || localProject?.language || '中文',
          textModel: serverProjectData.textModel || localProject?.textModel || 'deepseek-chat',
          imageModel: serverProjectData.imageModel || localProject?.imageModel || 'z-image-turbo',
          videoModel: serverProjectData.videoModel || localProject?.videoModel,
          videoResolution: serverProjectData.videoResolution || localProject?.videoResolution,
          rawScript: serverProjectData.rawScript || localProject?.rawScript || '',
          scriptData: serverProjectData.scriptData || localProject?.scriptData || null,
          shots: mergeShots(serverProjectData.shots || [], localProject?.shots || []),
          isParsingScript: false,
        };

        syncedSessionIds.add(sessionId);
        syncedProjectIds.add(projectId);
        
        // 静默同步本地缓存
        if (hasValidServerData) {
           saveProjectToDB(mergedProject, true).catch(() => {});
        }

        projectList.push(mergedProject);
      });

      // 补充那些仅存在于本地（未同步到服务端）的项目
      localProjects.forEach(lp => {
        const lpSessionId = lp.sessionId ? String(lp.sessionId) : null;
        if (!syncedProjectIds.has(lp.id) && !(lpSessionId && syncedSessionIds.has(lpSessionId))) {
          projectList.push(lp);
          syncedProjectIds.add(lp.id);
        }
      });

      projectList.sort((a, b) => b.lastModified - a.lastModified);
      return projectList;
    };

    try {
      console.log('🌐 后台从服务端加载项目列表...');
      const response = await chatApi.getSessionList(userId, 'mcpx-video-studio');
      
      if (response.code === 200 && (response.rows || response.data)) {
        const sessions = response.rows || response.data || [];
        const projectList = convertSessionsToProjects(sessions);
        console.log('✅ 服务端数据同步完成，共', projectList.length, '个项目');
        setProjects(projectList);
        serverSyncCompleted = true; // 标记服务端同步完成
      } else if (localProjects.length === 0) {
        // 只有在没有本地缓存时才设置空数组
        setProjects([]);
        serverSyncCompleted = true;
      } else {
        // 有本地缓存但服务端返回异常，也标记同步完成（使用本地数据）
        serverSyncCompleted = true;
      }
    } catch (error) {
      console.error('❌ 服务端同步失败:', error);
      // 如果没有本地缓存，才设置为空
      if (localProjects.length === 0) {
        setProjects([]);
      }
      // 有本地缓存时保持不变，不覆盖
      // 同步失败也标记完成，允许用户继续操作
      serverSyncCompleted = true;
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const newProject = await createNewProjectState();
      onOpenProject(newProject);
    } catch (error) {
      console.error('创建项目失败:', error);
      alert('创建项目失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportScript = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.project || !importData.scriptData) {
          throw new Error('无效的脚本文件格式');
        }

        const newId = 'proj_' + Date.now().toString(36);
        const importedProject: VideoGenProject = {
          id: newId,
          title: importData.project.title + ' (导入)',
          createdAt: Date.now(),
          lastModified: Date.now(),
          stage: 'script',
          targetDuration: importData.project.targetDuration || '60s',
          language: importData.project.language || '中文',
          textModel: importData.project.textModel || 'deepseek-chat',
          imageModel: importData.project.imageModel || 'z-image-turbo',
          videoModel: importData.project.videoModel,
          videoResolution: importData.project.videoResolution,
          rawScript: importData.rawScript || '',
          scriptData: importData.scriptData,
          shots: importData.shots || [],
          isParsingScript: false,
        };

        const userId = localStorage.getItem('userId');
        if (userId) {
          try {
            const sessionResponse = await chatApi.createSession({
              userId: userId,
              sessionContent: JSON.stringify(importedProject),
              sessionTitle: importedProject.title,
              remark: 'Imported MCP-X Video Studio Project',
              appId: 'mcpx-video-studio'
            });
            
            if (sessionResponse.code === 200 && sessionResponse.data) {
              const idValue = typeof sessionResponse.data === 'string' 
                ? sessionResponse.data 
                : (sessionResponse.data.id || sessionResponse.data.sessionId);
                
              if (idValue) {
                importedProject.sessionId = String(idValue);
              } else {
                console.warn('⚠️ 导入项目创建 session 响应中没有识别到 id 或 sessionId', sessionResponse.data);
                throw new Error('接口未返回有效的 sessionId');
              }
            } else {
              throw new Error(sessionResponse.msg || '创建 session 失败');
            }
          } catch (error) {
            console.error('创建 session 失败:', error);
            throw error;
          }
        } else {
          throw new Error('用户未登录，无法导入项目');
        }

        await saveProjectToDB(importedProject);
        await loadProjects();
        onOpenProject(importedProject);
      } catch (error: any) {
        console.error('导入失败:', error);
        alert(`导入脚本失败: ${error.message || '未知错误'}`);
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const confirmDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const project = projects.find(p => p.id === id);
      
      if (project?.sessionId && 
          !project.sessionId.startsWith('temp_session_') && 
          project.sessionId !== 'undefined' && 
          project.sessionId !== 'null') {
        await chatApi.deleteSession(project.sessionId);
      }
      
      const { deleteProjectFromDB } = await import('../../services/videogenService');
      await deleteProjectFromDB(id);
      
      await loadProjects();
    } catch (error) {
      console.error("Delete failed", error);
      const updatedProjects = projects.filter(p => p.id !== id);
      setProjects(updatedProjects);
      alert("删除项目失败，但已从列表移除");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'script': return '剧本阶段';
      case 'assets': return '资产生成';
      case 'director': return '导演工作台';
      case 'export': return '导出阶段';
      default: return stage;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 p-8 md:p-12 font-sans selection:bg-white/20">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">返回创作者中心</span>
        </button>
        
        <header className="mb-16 border-b border-zinc-900 pb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light text-white tracking-tight mb-2 flex items-center gap-3">
              项目库
              <span className="text-zinc-800 text-lg">/</span>
              <span className="text-zinc-600 text-sm font-mono tracking-widest uppercase">Projects Database</span>
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleImportScript}
              disabled={importing}
              className="group flex items-center gap-3 px-6 py-3 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span className="font-bold text-xs tracking-widest uppercase">导入脚本</span>
            </button>
            <button
              onClick={handleCreate}
              className="group flex items-center gap-3 px-6 py-3 bg-white text-black hover:bg-zinc-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="font-bold text-xs tracking-widest uppercase">新建项目</span>
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <div
              onClick={handleCreate}
              className="group cursor-pointer border border-zinc-800 hover:border-zinc-500 bg-[#0A0A0A] flex flex-col items-center justify-center min-h-[240px] transition-all"
            >
              <div className="w-12 h-12 border border-zinc-700 flex items-center justify-center mb-6 group-hover:bg-zinc-800 transition-colors">
                <Plus className="w-5 h-5 text-zinc-500 group-hover:text-white" />
              </div>
              <span className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest group-hover:text-zinc-300">Create New Project</span>
            </div>

            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onOpenProject(proj)}
                className="group bg-[#0A0A0A] border border-zinc-800 hover:border-zinc-600 p-0 flex flex-col cursor-pointer transition-all relative overflow-hidden h-[240px]"
              >
                {deleteConfirmId === proj.id && (
                  <div
                    className="absolute inset-0 z-20 bg-[#0A0A0A] flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-10 h-10 bg-red-900/20 flex items-center justify-center rounded-full">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-xs uppercase tracking-widest">确认删除？</p>
                      <p className="text-zinc-500 text-[10px] mt-1 font-mono">此操作无法撤销。</p>
                    </div>
                    <div className="flex gap-2 w-full pt-2">
                      <button
                        onClick={cancelDelete}
                        className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-800"
                      >
                        取消
                      </button>
                      <button
                        onClick={(e) => confirmDelete(e, proj.id)}
                        className="flex-1 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-200 text-[10px] font-bold uppercase tracking-wider transition-colors border border-red-900/30"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 p-6 relative flex flex-col">
                  <button
                    onClick={(e) => requestDelete(e, proj.id)}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-all rounded-sm z-10"
                    title="删除项目"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex-1">
                    <Folder className="w-8 h-8 text-zinc-800 mb-6 group-hover:text-zinc-500 transition-colors" />
                    <h3 className="text-sm font-bold text-white mb-2 line-clamp-1 tracking-wide">{proj.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-[9px] font-mono text-zinc-500 border border-zinc-800 px-1.5 py-0.5 uppercase tracking-wider">
                        {getStageLabel(proj.stage)}
                      </span>
                    </div>
                    {proj.scriptData?.logline && (
                      <p className="text-[10px] text-zinc-600 line-clamp-2 leading-relaxed font-mono border-l border-zinc-800 pl-2">
                        {proj.scriptData.logline}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-6 py-3 border-t border-zinc-900 flex items-center justify-between bg-[#080808]">
                  <div className="flex items-center gap-2 text-[9px] text-zinc-600 font-mono uppercase tracking-widest">
                    <Calendar className="w-3 h-3" />
                    {formatDate(proj.lastModified)}
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoGenDashboard;
