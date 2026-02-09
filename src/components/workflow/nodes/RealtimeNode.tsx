import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../stores/StoreContext';

const sourceColors: Record<string, string> = {
  user: '#f59e0b',
  planner: '#f59e0b',
  ResearchAgent: '#f59e0b',
  WebCoderAgent: '#f97316',
  tool: '#f97316',
  tool_result: '#4ade80',
  output: '#4ade80',
  error: '#ef4444',
  system: '#71717a',
};

const sourceLabels: Record<string, string> = {
  user_input: 'USER',
  planner: 'PLAN',
  agent: 'AGENT',
  tool: 'TOOL',
  tool_result: 'RESULT',
  output: 'OUTPUT',
  error: 'ERROR',
};

export function RealtimeNode() {
  const { messages, planner, researchAgent, webCoderAgent, outputStatus } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const isProcessing = planner.status === 'working' || researchAgent.status === 'working' || webCoderAgent.status === 'working';
  const isComplete = outputStatus === 'complete';

  const getMessageColor = (msg: typeof messages[0]) => {
    if (msg.type === 'user_input') return sourceColors.user;
    if (msg.type === 'planner') return sourceColors.planner;
    if (msg.type === 'agent' && msg.agent) return sourceColors[msg.agent] || sourceColors.planner;
    if (msg.type === 'tool') return sourceColors.tool;
    if (msg.type === 'tool_result') return sourceColors.tool_result;
    if (msg.type === 'output') return sourceColors.output;
    if (msg.type === 'error') return sourceColors.error;
    return sourceColors.system;
  };

  const getMessageLabel = (msg: typeof messages[0]) => {
    if (msg.type === 'agent' && msg.agent) {
      return msg.agent === 'ResearchAgent' ? 'RESEARCH' : 'WEBCODER';
    }
    if (msg.type === 'tool' && msg.agent) {
      return msg.agent === 'ResearchAgent' ? 'R:TOOL' : 'W:TOOL';
    }
    if (msg.type === 'tool_result' && msg.agent) {
      return msg.agent === 'ResearchAgent' ? 'R:RES' : 'W:RES';
    }
    return sourceLabels[msg.type] || msg.type.toUpperCase();
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="w-[690px] h-[350px] rounded-2xl border bg-zinc-900 overflow-hidden shadow-xl border-zinc-800"
      onWheel={handleWheel}
    >
      {/* Header */}
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-300">ACTIVITY LOG</span>
          <span className="text-[10px] text-zinc-500">{messages.length} events</span>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="text-[9px] font-bold text-green-400 px-2 py-1 rounded bg-green-500/20">
              COMPLETE
            </span>
          )}
          {isProcessing && (
            <motion.span
              className="text-[9px] font-bold text-amber-400 px-2 py-1 rounded bg-amber-500/20"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              STREAMING
            </motion.span>
          )}
        </div>
      </div>

      {/* Log Stream */}
      <div
        ref={scrollRef}
        data-scrollable
        className="p-3 h-[300px] overflow-y-auto text-[11px] bg-black/50"
      >
        <AnimatePresence mode="popLayout">
          {messages.length === 0 ? (
            <div className="text-zinc-500 italic py-4 text-center">
              Awaiting activity...
            </div>
          ) : (
            messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex gap-2 py-1 px-2 rounded-lg mb-0.5 hover:bg-zinc-800/50 transition-colors"
              >
                <span className="text-zinc-600 shrink-0 w-[60px]">
                  {new Date(msg.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
                <span
                  className="shrink-0 w-[70px] font-bold"
                  style={{ color: getMessageColor(msg) }}
                >
                  [{getMessageLabel(msg)}]
                </span>
                <span className="text-zinc-400 break-all">
                  {truncateContent(msg.content)}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}