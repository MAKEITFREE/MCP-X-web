import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../stores/StoreContext';

export function PlannerNode() {
  const { planner, messages } = useStore();
  const { status, currentToolCall } = planner;
  const isActive = status === 'active' || status === 'working';
  const scrollRef = useRef<HTMLDivElement>(null);

  const plannerMessages = messages
    .filter(m => m.type === 'planner' || (m.type === 'tool' && !m.agent));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [plannerMessages]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  const truncateContent = (content: string, maxLength: number = 400) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const isTaskResult = (content: string) => {
    return content.includes('Task Execution Results') || content.includes('Task 1:') || content.includes('Task 2:');
  };

  return (
    <div
      className={`w-[370px] h-[400px] rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 ${
        isActive ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
      }`}
      onWheel={handleWheel}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-300">PLANNER</span>
          {isActive && (
            <motion.span
              className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              ACTIVE
            </motion.span>
          )}
        </div>
      </div>

      {/* Tool call */}
      {currentToolCall && (
        <div className="flex items-center gap-2 mx-3 mt-2 p-2 rounded-lg border border-amber-500/50 bg-amber-500/10 text-xs">
          <Loader2 size={12} className="animate-spin text-amber-400" />
          <span className="text-amber-200 truncate">{currentToolCall.args}</span>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        data-scrollable
        className="flex-1 m-3 p-3 rounded-lg border border-zinc-800 bg-black/50 overflow-y-auto space-y-2"
      >
        <AnimatePresence mode="popLayout">
          {plannerMessages.length === 0 ? (
            <span className="text-xs text-zinc-500 italic">Awaiting input...</span>
          ) : (
            plannerMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs pb-2 border-b border-zinc-800"
              >
                {msg.type === 'tool' ? (
                  <div className="text-amber-200">
                    <span className="text-zinc-600">└─ </span>
                    {truncateContent(msg.content)}
                  </div>
                ) : isTaskResult(msg.content) ? (
                  <div className="whitespace-pre-wrap p-2 mt-1 rounded-lg border border-green-500/50 bg-green-500/10 text-green-200">
                    <span className="text-[10px] font-bold text-green-400">TASK RESULTS</span>
                    <div className="mt-1">{truncateContent(msg.content)}</div>
                  </div>
                ) : (
                  <div className="text-zinc-300 whitespace-pre-wrap">
                    {truncateContent(msg.content)}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}