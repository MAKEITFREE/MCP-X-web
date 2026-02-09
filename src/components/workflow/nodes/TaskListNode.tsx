import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../stores/StoreContext';
import type { Task } from '../../../types/workflow';

function TaskCheckbox({ status }: { status: Task['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <div className="w-5 h-5 rounded border border-green-500 flex items-center justify-center bg-green-500/20">
          <CheckCircle2 size={12} className="text-green-400" />
        </div>
      );
    case 'running':
      return (
        <div className="w-5 h-5 rounded border border-amber-500 flex items-center justify-center bg-amber-500/20">
          <Loader2 size={12} className="text-amber-400 animate-spin" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 rounded border border-red-500 flex items-center justify-center bg-red-500/20">
          <XCircle size={12} className="text-red-400" />
        </div>
      );
    default:
      return (
        <div className="w-5 h-5 rounded border border-zinc-700 flex items-center justify-center">
          <Circle size={12} className="text-zinc-600" />
        </div>
      );
  }
}

function AgentTag({ agent }: { agent: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ResearchAgent: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'RESEARCH' },
    WebCoderAgent: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'WEBCODER' },
  };
  const { bg, text, label } = config[agent] || { bg: 'bg-zinc-800', text: 'text-zinc-400', label: agent };

  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${bg} ${text}`}>
      {label}
    </span>
  );
}

export function TaskListNode() {
  const { tasks } = useStore();
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const hasActiveTasks = tasks.some(t => t.status === 'running');

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`w-[520px] h-[280px] rounded-2xl border bg-zinc-900 flex flex-col shadow-xl transition-all duration-500 ${
        hasActiveTasks ? 'border-amber-500 shadow-amber-500/20' : 'border-zinc-800'
      }`}
      onWheel={handleWheel}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-300">TASKS</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-amber-400">
              {completedCount}/{tasks.length}
            </span>
            {hasActiveTasks && (
              <motion.div
                className="w-2 h-2 rounded-full bg-amber-400"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
        </div>
        {tasks.length > 0 && (
          <div className="mt-2 h-1 rounded-full overflow-hidden bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / tasks.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </div>

      {/* Task List */}
      <div className="flex-1 p-2 overflow-y-auto" data-scrollable>
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-zinc-500 italic">No tasks queued</p>
            </div>
          ) : (
            tasks.map((task, index) => (
              <motion.div
                key={task.task_id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`flex items-start gap-2 px-2 py-2 rounded-lg mb-1 transition-colors ${
                  task.status === 'running'
                    ? 'border border-amber-500/30 bg-amber-500/5'
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                <TaskCheckbox status={task.status} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs leading-relaxed line-clamp-2 ${
                      task.status === 'completed' ? 'text-zinc-600 line-through' : 'text-zinc-300'
                    }`}
                    title={task.description}
                  >
                    {task.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <AgentTag agent={task.agent} />
                    {task.status === 'running' && (
                      <span className="text-[9px] text-amber-400 font-bold animate-pulse">RUNNING</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}