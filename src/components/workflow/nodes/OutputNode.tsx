import { ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../stores/StoreContext';

function isWebFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'html' || ext === 'htm';
}

function getFileUrl(filename: string): string {
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }
  return `./outputs/${filename}`;
}

export function OutputNode() {
  const { outputStatus, outputText, outputFiles } = useStore();
  const isComplete = outputStatus === 'complete';
  const webFiles = outputFiles.filter(isWebFile);

  const handleOpenWebpage = (filename: string) => {
    const url = getFileUrl(filename);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`w-[320px] h-[400px] rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 ${
        isComplete ? 'border-green-500 shadow-green-500/20' : 'border-zinc-800'
      }`}
      onWheel={handleWheel}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-300">OUTPUT</span>
        {isComplete && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="px-2 py-1 rounded bg-green-500/20"
          >
            <span className="text-[9px] font-bold text-green-400">COMPLETE</span>
          </motion.div>
        )}
      </div>

      {/* Output Content */}
      <div
        className="flex-1 m-3 p-3 rounded-lg border border-zinc-800 bg-black/50 text-xs overflow-y-auto leading-relaxed"
        data-scrollable
      >
        {isComplete ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-green-200 whitespace-pre-wrap"
          >
            {outputText}
          </motion.div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-zinc-500 italic">Awaiting output...</span>
          </div>
        )}
      </div>

      {/* Open webpage button(s) */}
      {isComplete && webFiles.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {webFiles.map((file) => (
            <motion.button
              key={file}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleOpenWebpage(file)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500 text-amber-400 text-xs font-bold transition-all hover:bg-amber-500/10 bg-zinc-950"
            >
              <ExternalLink size={12} />
              OPEN {file.toUpperCase()}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}