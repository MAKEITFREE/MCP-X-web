import { CheckCircle2, Search, Code, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../stores/StoreContext';

function AgentCard({
  title,
  status,
  currentTask,
  toolCalls,
}: {
  title: string;
  status: string;
  currentTask?: any;
  toolCalls: any[];
}) {
  const isActive = status === 'active' || status === 'working';

  return (
    <div className={`w-[320px] rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 ${
      isActive ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {title === 'RESEARCH' ? (
            <Search size={18} className="text-zinc-400" />
          ) : (
            <Code size={18} className="text-zinc-400" />
          )}
          <span className="text-sm font-bold text-zinc-300">{title}</span>
        </div>
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

      {/* Current Task */}
      {currentTask && (
        <div className="px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-amber-500 flex items-center justify-center bg-amber-500/20">
              <Loader2 size={12} className="text-amber-400 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-zinc-300 truncate">
                {currentTask.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tool Calls */}
      <div className="flex-1 p-2 overflow-y-auto" data-scrollable>
        <AnimatePresence mode="popLayout">
          {toolCalls.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-zinc-500 italic">No tool calls</p>
            </div>
          ) : (
            toolCalls.map((toolCall, index) => (
              <motion.div
                key={toolCall.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-start gap-2 px-2 py-2 rounded-lg mb-1 border border-zinc-800 bg-zinc-900/50"
              >
                <div className="w-5 h-5 rounded border border-zinc-700 flex items-center justify-center">
                  {toolCall.status === 'complete' ? (
                    <CheckCircle2 size={12} className="text-green-400" />
                  ) : (
                    <Loader2 size={12} className="text-amber-400 animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 font-medium truncate">
                    {toolCall.tool}
                  </p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {toolCall.args}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AgentsPanel() {
  const { researchAgent, webCoderAgent } = useStore();

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="flex gap-4" onWheel={handleWheel}>
      <AgentCard
        title="RESEARCH"
        status={researchAgent.status}
        currentTask={researchAgent.currentTask}
        toolCalls={researchAgent.toolCalls}
      />
      <AgentCard
        title="WEBCODER"
        status={webCoderAgent.status}
        currentTask={webCoderAgent.currentTask}
        toolCalls={webCoderAgent.toolCalls}
      />
    </div>
  );
}