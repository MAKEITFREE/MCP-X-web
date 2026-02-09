import React from 'react';
import { FileText, Users, Clapperboard, Film, ChevronLeft, Aperture, Crown, CheckCircle, Save, History, RotateCcw, X, Clock, Settings } from 'lucide-react';
import { chatApi } from '../../services/chatApi';
import { useNavigate } from 'react-router-dom';

interface VideoGenSidebarProps {
  currentStage: string;
  setStage: (stage: 'script' | 'assets' | 'director' | 'export') => void;
  onExit: () => void;
  projectName?: string;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  sessionId?: string;
  onLoadHistory?: (content: string) => void;
}

const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = React.useState({
    defaultAudio: false,
    defaultDuration: 8
  });

  React.useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('mcp_video_gen_settings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse settings', e);
        }
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('mcp_video_gen_settings', JSON.stringify(settings));
    // 触发自定义事件，通知其他组件设置已更改
    window.dispatchEvent(new CustomEvent('video-gen-settings-changed', { detail: settings }));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0A0A0A] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-[#0F0F0F]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-400" />
              工作台默认设置
            </h2>
            <p className="text-xs text-zinc-500 mt-1">设置新项目的默认参数</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Audio Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-200">默认生成语言/音频</div>
              <div className="text-xs text-zinc-500">开启后，新生成的镜头将默认尝试生成配音音频</div>
            </div>
            <button
              onClick={() => setSettings({ ...settings, defaultAudio: !settings.defaultAudio })}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.defaultAudio ? 'bg-indigo-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.defaultAudio ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Duration Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-zinc-200">默认视频时长</div>
                <div className="text-xs text-zinc-500">设置新生成镜头的默认秒数</div>
              </div>
              <span className="text-indigo-400 font-mono text-sm font-bold">{settings.defaultDuration}秒</span>
            </div>
            <input
              type="range"
              min="2"
              max="15"
              step="1"
              value={settings.defaultDuration}
              onChange={(e) => setSettings({ ...settings, defaultDuration: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
              <span>2s</span>
              <span>5s</span>
              <span>8s</span>
              <span>10s</span>
              <span>15s</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#0F0F0F] border-t border-zinc-900 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-900 text-zinc-400 font-medium rounded-lg hover:bg-zinc-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
  onLoad: (content: string) => void;
}> = ({ isOpen, onClose, sessionId, onLoad }) => {
  const [historyList, setHistoryList] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<any>(null);

  React.useEffect(() => {
    if (isOpen && sessionId) {
      loadHistory();
    }
  }, [isOpen, sessionId]);

  const loadHistory = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await chatApi.getSessionContentHistory(sessionId);
      if (res.code === 200) {
        setHistoryList(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setLoading(false);
    }
  };

  const parsePreview = (content: string) => {
    try {
      if (!content) return { error: '空内容' };
      const data = JSON.parse(content);
      return {
        title: data.title,
        stage: data.stage,
        scenesCount: data.scriptData?.scenes?.length || 0,
        shotsCount: data.shots?.length || 0,
        duration: data.targetDuration,
        lastModified: data.lastModified
      };
    } catch (e) {
      return { error: '解析失败' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-[#0A0A0A] border border-zinc-800 rounded-xl shadow-2xl flex flex-col h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900 bg-[#0F0F0F]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-400" />
              历史版本记录
            </h2>
            <p className="text-xs text-zinc-500 mt-1">查看并恢复之前的编辑版本</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* List */}
          <div className="w-80 border-r border-zinc-800 overflow-y-auto bg-[#0A0A0A]">
            {loading ? (
              <div className="p-8 text-center text-zinc-500 text-xs">加载记录中...</div>
            ) : historyList.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">暂无历史记录</div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {historyList.map((item) => {
                  const preview = parsePreview(item.content);
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`w-full text-left p-4 hover:bg-zinc-900/50 transition-colors ${isSelected ? 'bg-zinc-900 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-zinc-400">
                          {new Date(item.createTime).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-zinc-300 truncate mb-1">
                        {preview.title || '未命名'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                        <span className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 uppercase">{preview.stage || 'N/A'}</span>
                        {preview.shotsCount ? <span>{preview.shotsCount} 镜头</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 bg-[#050505] p-8 overflow-y-auto flex flex-col items-center justify-center">
            {selectedItem ? (
              <div className="w-full max-w-lg space-y-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                    <Clock className="w-8 h-8 text-zinc-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">版本预览</h3>
                  <p className="text-sm text-zinc-500 font-mono">{new Date(selectedItem.createTime).toLocaleString()}</p>
                </div>

                <div className="bg-[#0A0A0A] border border-zinc-800 rounded-lg p-6 space-y-4">
                  {(() => {
                    const prev = parsePreview(selectedItem.content);
                    if (prev.error) return <div className="text-red-500 text-sm py-4 text-center">{prev.error}</div>;
                    return (
                      <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                        <div className="space-y-1">
                          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">项目标题</div>
                          <div className="text-zinc-300 font-medium">{prev.title}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">所处阶段</div>
                          <div className="text-zinc-300 font-medium capitalize">{prev.stage}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">场景数量</div>
                          <div className="text-zinc-300 font-medium">{prev.scenesCount} Scenes</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">分镜数量</div>
                          <div className="text-zinc-300 font-medium">{prev.shotsCount} Shots</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">目标时长</div>
                          <div className="text-zinc-300 font-medium">{prev.duration}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      if (confirm('确定要回滚到此版本吗？当前未保存的修改将会丢失。')) {
                        onLoad(selectedItem.content);
                        onClose();
                      }
                    }}
                    className="flex-1 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    恢复此版本
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-zinc-600 text-sm flex flex-col items-center gap-4">
                <History className="w-12 h-12 opacity-20" />
                请从左侧选择一个历史记录查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoGenSidebar: React.FC<VideoGenSidebarProps> = ({
  currentStage,
  setStage,
  onExit,
  projectName,
  saveStatus = 'saved',
  sessionId,
  onLoadHistory
}) => {
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const navItems = [
    { id: 'script', label: '剧本与故事', icon: FileText, sub: 'Phase 01' },
    { id: 'assets', label: '角色与场景', icon: Users, sub: 'Phase 02' },
    { id: 'director', label: '导演工作台', icon: Clapperboard, sub: 'Phase 03' },
    { id: 'export', label: '成片与导出', icon: Film, sub: 'Phase 04' },
  ];

  return (
    <aside className="w-72 bg-[#050505] border-r border-zinc-800 h-screen fixed left-0 top-0 flex flex-col z-50 select-none">
      {/* Header */}
      <div className="p-6 border-b border-zinc-900">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center flex-shrink-0">
            <Aperture className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white tracking-wider uppercase">MCP-X Video Studio</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">AI Director</p>
          </div>
        </div>

        <button
          onClick={onExit}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-mono uppercase tracking-wide group"
        >
          <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
          返回项目列表
        </button>
      </div>

      {/* Project Status */}
      <div className="px-6 py-4 border-b border-zinc-900">
        <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">当前项目</div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-zinc-200 truncate font-mono flex-1 mr-2">{projectName || '未命名项目'}</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
              title="默认设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            {sessionId && onLoadHistory && (
              <button
                onClick={() => setShowHistory(true)}
                className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
                title="查看历史记录"
              >
                <History className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = currentStage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setStage(item.id as any)}
              className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-200 group relative border-l-2 ${isActive
                ? 'border-white bg-zinc-900/50 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
                }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                <span className="font-medium text-xs tracking-wider uppercase">{item.label}</span>
              </div>
              <span className={`text-[10px] font-mono ${isActive ? 'text-zinc-400' : 'text-zinc-700'}`}>{item.sub}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-900">
        {/* Save Status */}
        <div className="px-6 py-4 border-b border-zinc-900">
          <div className="flex items-center gap-2 text-xs font-mono">
            {saveStatus === 'saving' ? (
              <>
                <Save className="w-3 h-3 text-zinc-500 animate-pulse" />
                <span className="text-zinc-500">保存中...</span>
              </>
            ) : saveStatus === 'unsaved' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-zinc-500">未保存</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-zinc-500">已保存</span>
              </>
            )}
          </div>
        </div>

        {/* Upgrade VIP Button */}
        <div className="p-6">
          <button
            onClick={() => navigate('/pricing')}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            <Crown className="w-4 h-4" />
            <span className="text-xs uppercase tracking-widest">升级 VIP</span>
          </button>
        </div>
      </div>


      {
        sessionId && onLoadHistory && (
          <HistoryModal
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            sessionId={sessionId}
            onLoad={onLoadHistory}
          />
        )
      }
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </aside >
  );
};

export default VideoGenSidebar;
