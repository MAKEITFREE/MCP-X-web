import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useStore } from '../stores/StoreContext';

export function CanvasControls() {
  const { canvas, setCanvas } = useStore();

  const handleZoomIn = () => {
    setCanvas({ zoom: Math.min(canvas.zoom * 1.2, 2) });
  };

  const handleZoomOut = () => {
    setCanvas({ zoom: Math.max(canvas.zoom / 1.2, 0.25) });
  };

  const handleReset = () => {
    setCanvas({ zoom: 1, panX: 0, panY: 0 });
  };

  return (
    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 font-sans">
      <button
        onClick={handleZoomOut}
        className="p-2 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-200"
        title="Zoom out"
      >
        <ZoomOut size={16} />
      </button>
      <span className="text-xs text-zinc-500 px-2 min-w-[50px] text-center font-medium">
        {Math.round(canvas.zoom * 100)}%
      </span>
      <button
        onClick={handleZoomIn}
        className="p-2 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-200"
        title="Zoom in"
      >
        <ZoomIn size={16} />
      </button>
      <div className="w-px h-4 bg-zinc-800" />
      <button
        onClick={handleReset}
        className="p-2 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-200"
        title="Reset view"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}