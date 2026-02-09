import React from 'react';
import { Film, Download, Share2, Layers, Clock, CheckCircle, BarChart3, Play, FileText } from 'lucide-react';
import type { VideoGenProject } from '../../types/videogen';

interface Props {
  project: VideoGenProject;
}

const StageExport: React.FC<Props> = ({ project }) => {
  const completedShots = project.shots.filter(s => s.interval?.videoUrl);
  const totalShots = project.shots.length;
  const progress = totalShots > 0 ? Math.round((completedShots.length / totalShots) * 100) : 0;
  
  // Calculate total duration roughly
  const estimatedDuration = project.shots.reduce((acc, s) => acc + (s.interval?.duration || 3), 0);

  // Collect video list
  const getVideoList = () => {
    const videoList: { filename: string; url: string; shotInfo: any }[] = [];
    completedShots.forEach((shot) => {
      const videoUrl = shot.interval?.videoUrl;
      if (videoUrl) {
        const shotIndex = project.shots.findIndex(s => s.id === shot.id);
        const filename = `shot_${String(shotIndex + 1).padStart(3, '0')}.mp4`;
        videoList.push({
          filename,
          url: videoUrl,
          shotInfo: {
            shotNumber: shotIndex + 1,
            sceneId: shot.sceneId,
            actionSummary: shot.actionSummary,
            dialogue: shot.dialogue,
            cameraMovement: shot.cameraMovement,
            shotSize: shot.shotSize,
            duration: shot.interval?.duration || 3,
          }
        });
      }
    });
    return videoList;
  };

  // Generate preview HTML and open in new tab
  const handleGeneratePreview = () => {
    if (completedShots.length === 0) {
      alert('还没有生成任何视频片段，请先生成视频');
      return;
    }
    
    const videoList = getVideoList();
    const htmlContent = generatePreviewHTML(videoList);
    
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Generate the preview HTML content with video player
  const generatePreviewHTML = (videoList: any[]) => {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.scriptData?.title || '未命名项目'} - 在线预览</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .header { background: #111; border-bottom: 1px solid #222; padding: 16px 24px; position: sticky; top: 0; z-index: 100; }
    .header-content { max-width: 1400px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .title { font-size: 20px; font-weight: bold; }
    .title span { color: #6366f1; }
    .stats { display: flex; gap: 24px; font-size: 12px; color: #888; }
    .stat-value { color: #fff; font-family: monospace; }
    .main { max-width: 1400px; margin: 0 auto; padding: 24px; display: grid; grid-template-columns: 1fr 360px; gap: 24px; }
    @media (max-width: 1024px) { .main { grid-template-columns: 1fr; } }
    .player-section { background: #111; border-radius: 16px; overflow: hidden; border: 1px solid #222; }
    .player-container { position: relative; background: #000; aspect-ratio: 16/9; }
    .player-container video { width: 100%; height: 100%; object-fit: contain; }
    .player-controls { padding: 16px 20px; background: #0d0d0d; border-top: 1px solid #222; }
    .controls-row { display: flex; align-items: center; gap: 12px; }
    .play-btn { width: 48px; height: 48px; border-radius: 50%; background: #6366f1; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .play-btn:hover { background: #4f46e5; transform: scale(1.05); }
    .play-btn svg { width: 20px; height: 20px; fill: #fff; }
    .progress-container { flex: 1; }
    .progress-bar { height: 6px; background: #333; border-radius: 3px; cursor: pointer; }
    .progress-fill { height: 100%; background: #6366f1; border-radius: 3px; transition: width 0.1s; }
    .time-display { font-family: monospace; font-size: 12px; color: #888; min-width: 100px; text-align: right; }
    .shot-info { padding: 16px 20px; background: #0a0a0a; }
    .shot-badge { display: inline-block; padding: 4px 10px; background: #6366f1; color: #fff; font-size: 10px; font-weight: bold; border-radius: 4px; margin-bottom: 8px; text-transform: uppercase; }
    .shot-title { font-size: 14px; color: #fff; margin-bottom: 4px; }
    .shot-meta { font-size: 11px; color: #666; }
    .playlist-section { background: #111; border-radius: 16px; border: 1px solid #222; overflow: hidden; max-height: calc(100vh - 120px); display: flex; flex-direction: column; }
    .playlist-header { padding: 16px 20px; border-bottom: 1px solid #222; background: #0d0d0d; }
    .playlist-title { font-size: 14px; font-weight: bold; }
    .playlist-count { font-size: 11px; color: #666; margin-top: 4px; }
    .playlist-items { flex: 1; overflow-y: auto; }
    .playlist-item { padding: 12px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: all 0.2s; display: flex; gap: 12px; align-items: center; }
    .playlist-item:hover { background: #1a1a1a; }
    .playlist-item.active { background: #1a1a2e; border-left: 3px solid #6366f1; }
    .item-number { width: 28px; height: 28px; background: #222; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: #888; }
    .playlist-item.active .item-number { background: #6366f1; color: #fff; }
    .item-info { flex: 1; min-width: 0; }
    .item-title { font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
    .item-meta { font-size: 10px; color: #666; }
    .item-duration { font-size: 10px; color: #888; font-family: monospace; }
    .actions { padding: 16px 20px; border-top: 1px solid #222; background: #0d0d0d; }
    .action-btn { width: 100%; padding: 12px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; font-size: 12px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
    .btn-primary { background: #fff; color: #000; }
    .btn-primary:hover { background: #ddd; }
    .btn-secondary { background: #222; color: #fff; border: 1px solid #333; }
    .btn-secondary:hover { background: #333; }
    .playlist-items::-webkit-scrollbar { width: 6px; }
    .playlist-items::-webkit-scrollbar-track { background: #111; }
    .playlist-items::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <div class="title"><span>▶</span> ${project.scriptData?.title || '未命名项目'}</div>
      <div class="stats">
        <div>镜头: <span class="stat-value">${videoList.length}</span></div>
        <div>时长: <span class="stat-value">~${estimatedDuration}s</span></div>
      </div>
    </div>
  </div>
  <div class="main">
    <div class="player-section">
      <div class="player-container">
        <video id="mainPlayer" playsinline></video>
      </div>
      <div class="player-controls">
        <div class="controls-row">
          <button class="play-btn" onclick="togglePlay()">
            <svg viewBox="0 0 24 24" id="playIcon"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="progress-container">
            <div class="progress-bar" onclick="seek(event)">
              <div class="progress-fill" id="progressFill"></div>
            </div>
          </div>
          <div class="time-display" id="timeDisplay">00:00 / 00:00</div>
        </div>
      </div>
      <div class="shot-info">
        <div class="shot-badge" id="shotBadge">Shot 01</div>
        <div class="shot-title" id="shotTitle">准备播放...</div>
        <div class="shot-meta" id="shotMeta">点击播放开始</div>
      </div>
    </div>
    <div class="playlist-section">
      <div class="playlist-header">
        <div class="playlist-title">🎬 播放列表</div>
        <div class="playlist-count">共 ${videoList.length} 个镜头 · 自动连续播放</div>
      </div>
      <div class="playlist-items" id="playlistItems">
        ${videoList.map((v, i) => `
        <div class="playlist-item" data-index="${i}" onclick="playVideo(${i})">
          <div class="item-number">${String(i + 1).padStart(2, '0')}</div>
          <div class="item-info">
            <div class="item-title">${v.shotInfo.actionSummary?.substring(0, 35) || v.filename}...</div>
            <div class="item-meta">${v.shotInfo.cameraMovement || ''}</div>
          </div>
          <div class="item-duration">${v.shotInfo.duration}s</div>
        </div>
        `).join('')}
      </div>
      <div class="actions">
        <button class="action-btn btn-primary" onclick="downloadAll()">⬇️ 下载全部视频</button>
        <button class="action-btn btn-secondary" onclick="copyLinks()">📋 复制所有链接</button>
      </div>
    </div>
  </div>
  <script>
    const videos = ${JSON.stringify(videoList)};
    let currentIndex = 0;
    const player = document.getElementById('mainPlayer');
    const playIcon = document.getElementById('playIcon');
    const progressFill = document.getElementById('progressFill');
    const timeDisplay = document.getElementById('timeDisplay');
    
    if (videos.length > 0) loadVideo(0);
    
    function loadVideo(index) {
      currentIndex = index;
      player.src = videos[index].url;
      document.getElementById('shotBadge').textContent = 'Shot ' + String(videos[index].shotInfo.shotNumber).padStart(2, '0');
      document.getElementById('shotTitle').textContent = videos[index].shotInfo.actionSummary || videos[index].filename;
      document.getElementById('shotMeta').textContent = [videos[index].shotInfo.cameraMovement, videos[index].shotInfo.duration + 's'].filter(Boolean).join(' · ');
      document.querySelectorAll('.playlist-item').forEach((item, i) => item.classList.toggle('active', i === index));
    }
    
    function playVideo(index) { loadVideo(index); player.play(); }
    function togglePlay() { player.paused ? player.play() : player.pause(); }
    function formatTime(s) { return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(Math.floor(s%60)).padStart(2,'0'); }
    function seek(e) { const rect = e.target.getBoundingClientRect(); player.currentTime = ((e.clientX - rect.left) / rect.width) * player.duration; }
    
    player.addEventListener('play', () => { playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'; });
    player.addEventListener('pause', () => { playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; });
    player.addEventListener('timeupdate', () => {
      progressFill.style.width = (player.currentTime / player.duration * 100) + '%';
      timeDisplay.textContent = formatTime(player.currentTime) + ' / ' + formatTime(player.duration || 0);
    });
    player.addEventListener('ended', () => { if (currentIndex < videos.length - 1) playVideo(currentIndex + 1); });
    
    async function downloadAll() {
      for (let i = 0; i < videos.length; i++) {
        const a = document.createElement('a'); a.href = videos[i].url; a.download = videos[i].filename; a.target = '_blank';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 800));
      }
    }
    function copyLinks() { navigator.clipboard.writeText(videos.map(v => v.url).join('\\n')).then(() => alert('已复制 ' + videos.length + ' 个链接！')); }
  </script>
</body>
</html>`;
  };

  // Download all videos sequentially using native browser download
  const handleDownloadAllVideos = () => {
    if (completedShots.length === 0) {
      alert('还没有生成任何视频片段，请先生成视频');
      return;
    }
    
    if (!confirm(`即将依次下载 ${completedShots.length} 个视频文件。\n\n请在浏览器中允许多个文件下载。\n\n是否继续？`)) {
      return;
    }

    completedShots.forEach((shot, index) => {
      const videoUrl = shot.interval?.videoUrl;
      if (videoUrl) {
        const shotIndex = project.shots.findIndex(s => s.id === shot.id);
        const filename = `shot_${String(shotIndex + 1).padStart(3, '0')}.mp4`;
        
        // Stagger downloads to avoid browser blocking
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = videoUrl;
          a.download = filename;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, index * 800); // 800ms delay between each download
      }
    });
  };

  // Handle downloading source assets
  const handleDownloadAssets = () => {
    handleDownloadAllVideos();
  };

  // Export project script as JSON
  const handleExportScript = () => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      project: {
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        targetDuration: project.targetDuration,
        language: project.language,
        textModel: project.textModel,
        imageModel: project.imageModel,
        videoModel: project.videoModel,
        videoResolution: project.videoResolution,
      },
      rawScript: project.rawScript,
      scriptData: project.scriptData,
      shots: project.shots.map(shot => ({
        id: shot.id,
        sceneId: shot.sceneId,
        actionSummary: shot.actionSummary,
        dialogue: shot.dialogue,
        cameraMovement: shot.cameraMovement,
        shotSize: shot.shotSize,
        characters: shot.characters,
        characterVariations: shot.characterVariations,
        keyframes: shot.keyframes?.map(kf => ({
          id: kf.id,
          type: kf.type,
          visualPrompt: kf.visualPrompt,
          status: kf.status,
          imageUrl: kf.imageUrl,
        })),
        interval: shot.interval ? {
          id: shot.interval.id,
          duration: shot.interval.duration,
          motionStrength: shot.interval.motionStrength,
          status: shot.interval.status,
          videoUrl: shot.interval.videoUrl,
        } : undefined,
      })),
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title || 'project'}_script_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] overflow-hidden relative">
      
      {/* Header - Consistent with Director */}
      <div className="h-16 border-b border-zinc-800 bg-[#1A1A1A] px-6 flex items-center shrink-0">
          <h2 className="text-lg font-bold text-white flex items-center gap-3">
              <Film className="w-5 h-5 text-indigo-500" />
              成片与导出
              <span className="text-xs text-zinc-600 font-mono font-normal uppercase tracking-wider bg-black/30 px-2 py-1 rounded">Rendering & Export</span>
          </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-8 md:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Main Status Panel */}
          <div className="bg-[#141414] border border-zinc-800 rounded-xl p-8 shadow-2xl relative overflow-hidden group">
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 p-48 bg-indigo-900/5 blur-[120px] rounded-full pointer-events-none"></div>
             <div className="absolute bottom-0 left-0 p-32 bg-emerald-900/5 blur-[100px] rounded-full pointer-events-none"></div>

             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 relative z-10 gap-6">
               <div>
                 <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{project.scriptData?.title || '未命名项目'}</h3>
                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] rounded uppercase font-mono tracking-wider">Master Sequence</span>
                 </div>
                 <div className="flex items-center gap-6 mt-3">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Shots</span>
                        <span className="text-sm font-mono text-zinc-300">{project.shots.length}</span>
                    </div>
                    <div className="w-px h-6 bg-zinc-800"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Est. Duration</span>
                        <span className="text-sm font-mono text-zinc-300">~{estimatedDuration}s</span>
                    </div>
                    <div className="w-px h-6 bg-zinc-800"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold mb-0.5">Target</span>
                        <span className="text-sm font-mono text-zinc-300">{project.targetDuration}</span>
                    </div>
                 </div>
               </div>
               
               <div className="text-right bg-black/20 p-4 rounded-lg border border-white/5 backdrop-blur-sm min-w-[160px]">
                 <div className="flex items-baseline justify-end gap-1 mb-1">
                     <span className="text-3xl font-mono font-bold text-indigo-400">{progress}</span>
                     <span className="text-sm text-zinc-500">%</span>
                 </div>
                 <div className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center justify-end gap-2">
                    {progress === 100 ? <CheckCircle className="w-3 h-3 text-green-500" /> : <BarChart3 className="w-3 h-3" />}
                    Render Status
                 </div>
               </div>
             </div>

             {/* Timeline Visualizer Strip */}
             <div className="mb-10">
                <div className="flex justify-between text-[10px] text-zinc-600 font-mono uppercase tracking-widest mb-2 px-1">
                    <span>Sequence Map</span>
                    <span>TC 00:00:00:00</span>
                </div>
                <div className="h-20 bg-[#080808] rounded-lg border border-zinc-800 flex items-center px-2 gap-1 overflow-x-auto custom-scrollbar relative shadow-inner">
                   {project.shots.length === 0 ? (
                      <div className="w-full flex items-center justify-center text-zinc-800 text-xs font-mono uppercase tracking-widest">
                          <Film className="w-4 h-4 mr-2" />
                          No Shots Available
                      </div>
                   ) : (
                      project.shots.map((shot, idx) => {
                        const isDone = !!shot.interval?.videoUrl;
                        return (
                          <div 
                            key={shot.id} 
                            className={`h-14 min-w-[4px] flex-1 rounded-[2px] transition-all relative group flex flex-col justify-end overflow-hidden ${
                              isDone
                                ? 'bg-indigo-900/40 border border-indigo-500/30 hover:bg-indigo-500/40' 
                                : 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-800'
                            }`}
                            title={`Shot ${idx+1}: ${shot.actionSummary}`}
                          >
                             {/* Mini Progress Bar inside timeline segment */}
                             {isDone && <div className="h-full w-full bg-indigo-500/20"></div>}
                             
                             {/* Hover Tooltip */}
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 whitespace-nowrap">
                                <div className="bg-black text-white text-[10px] px-2 py-1 rounded border border-zinc-700 shadow-xl">
                                    Shot {idx + 1}
                                </div>
                             </div>
                          </div>
                        )
                      })
                   )}
                </div>
             </div>

             {/* Action Buttons */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <button 
                  onClick={handleGeneratePreview}
                  disabled={completedShots.length === 0} 
                  className={`h-12 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all border ${
                 completedShots.length > 0
                   ? 'bg-white text-black hover:bg-zinc-200 border-white shadow-lg shadow-white/5' 
                   : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
               }`}>
                 <Play className="w-4 h-4" />
                 在线预览播放
               </button>
               
               <button 
                  onClick={handleDownloadAllVideos}
                  disabled={completedShots.length === 0}
                  className={`h-12 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all border ${
                 completedShots.length > 0
                   ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700' 
                   : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
               }`}>
                 <Download className="w-4 h-4" />
                 下载所有片段
               </button>
               
               <button 
                  onClick={handleExportScript}
                  className="h-12 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all border bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700">
                 <FileText className="w-4 h-4" />
                 导出脚本数据
               </button>
             </div>
             
             {/* Download Info */}
             {completedShots.length > 0 && (
               <div className="mt-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                 <p className="text-[10px] text-zinc-500 leading-relaxed">
                   <span className="text-zinc-400 font-bold">使用说明：</span>
                   点击"在线预览播放"会打开一个新页面，可以顺序播放已完成的 {completedShots.length} 个视频片段，并支持下载。
                   {progress < 100 && <span className="text-yellow-500"> (当前进度 {progress}%，还有 {totalShots - completedShots.length} 个镜头未完成)</span>}
                 </p>
               </div>
             )}
          </div>

          {/* Secondary Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div 
                onClick={handleDownloadAssets}
                className="p-5 bg-[#141414] border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors group cursor-pointer flex flex-col justify-between h-32">
                  <Layers className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 mb-4 transition-colors" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Source Assets</h4>
                    <p className="text-[10px] text-zinc-500">Download all generated images and raw video clips.</p>
                  </div>
              </div>
              <div 
                onClick={() => alert('分享功能即将推出')}
                className="p-5 bg-[#141414] border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors group cursor-pointer flex flex-col justify-between h-32">
                  <Share2 className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 mb-4 transition-colors" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Share Project</h4>
                    <p className="text-[10px] text-zinc-500">Create a view-only link for client review.</p>
                  </div>
              </div>
              <div 
                onClick={() => alert('渲染日志功能即将推出')}
                className="p-5 bg-[#141414] border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors group cursor-pointer flex flex-col justify-between h-32">
                  <Clock className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 mb-4 transition-colors" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Render Logs</h4>
                    <p className="text-[10px] text-zinc-500">View generation history and token usage.</p>
                  </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StageExport;
