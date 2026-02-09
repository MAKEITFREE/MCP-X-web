import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../stores/StoreContext';
import {
  PlannerNode,
  TaskListNode,
  AgentsPanel,
  OutputNode,
  RealtimeNode,
} from '../nodes';
import { ConnectionLines } from './ConnectionLines';

const NODE_POSITIONS = {
  planner: { x: 50, y: 50 },
  taskList: { x: 470, y: 50 },      // 50 + 370 + 50 gap
  agents: { x: 1040, y: 50 },       // 470 + 520 + 50 gap
  output: { x: 1410, y: 50 },       // 1040 + 320 + 50 gap
  // Activity log centered under all nodes
  // Total width: 1410 + 320 = 1730, center = (50 + 1730) / 2 = 890
  // Realtime x = 890 - 345 = 545
  realtime: { x: 545, y: 620 },
};

const CONNECTIONS = [
  { from: 'planner', to: 'taskList', color: 'amber' },
  { from: 'taskList', to: 'agents', color: 'amber' },
  { from: 'agents', to: 'output', color: 'amber' },
];

export function InfiniteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvas, setCanvas } = useStore();
  const { zoom, panX, panY } = canvas;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-scrollable]')) {
        return;
      }
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.25), 2);
      setCanvas({ zoom: newZoom });
    },
    [zoom, setCanvas]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    },
    [panX, panY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setCanvas({
          panX: e.clientX - dragStart.x,
          panY: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, setCanvas]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      // Center the canvas on the workflow (center point is at x=890, y=510)
      setCanvas({
        panX: width / 2 - 890,
        panY: height / 2 - 510,
      });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"
      />

      {/* Canvas content */}
      <motion.div
        className="absolute"
        style={{
          width: '2400px',
          height: '1200px',
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <ConnectionLines
          positions={NODE_POSITIONS}
          connections={CONNECTIONS}
        />

        <div className="absolute" style={{ left: NODE_POSITIONS.planner.x, top: NODE_POSITIONS.planner.y }}>
          <PlannerNode />
        </div>

        <div className="absolute" style={{ left: NODE_POSITIONS.taskList.x, top: NODE_POSITIONS.taskList.y }}>
          <TaskListNode />
        </div>

        <div className="absolute" style={{ left: NODE_POSITIONS.agents.x, top: NODE_POSITIONS.agents.y }}>
          <AgentsPanel />
        </div>

        <div className="absolute" style={{ left: NODE_POSITIONS.output.x, top: NODE_POSITIONS.output.y }}>
          <OutputNode />
        </div>

        <div className="absolute" style={{ left: NODE_POSITIONS.realtime.x, top: NODE_POSITIONS.realtime.y }}>
          <RealtimeNode />
        </div>
      </motion.div>
    </div>
  );
}