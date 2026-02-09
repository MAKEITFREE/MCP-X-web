import { motion } from 'framer-motion';
import { useStore } from '../stores/StoreContext';

interface Position {
  x: number;
  y: number;
}

interface Connection {
  from: string;
  to: string;
  color: string;
}

interface ConnectionLinesProps {
  positions: Record<string, Position>;
  connections: Connection[];
}

// Node dimensions for horizontal pipeline layout
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  planner: { width: 370, height: 400 },
  taskList: { width: 520, height: 280 },
  agents: { width: 320, height: 520 },
  output: { width: 320, height: 400 },
  realtime: { width: 690, height: 350 },
};

const COLOR_MAP: Record<string, string> = {
  amber: '#f59e0b',
  orange: '#f97316',
  green: '#4ade80',
  zinc: '#71717a',
};

function calculatePath(
  from: Position,
  to: Position,
  fromNodeId: string,
  toNodeId: string
): string {
  const fromDim = NODE_DIMENSIONS[fromNodeId] || { width: 200, height: 150 };
  const toDim = NODE_DIMENSIONS[toNodeId] || { width: 200, height: 150 };

  const startX = from.x + fromDim.width;
  const startY = from.y + fromDim.height / 2;

  const endX = to.x;
  const endY = to.y + toDim.height / 2;

  const midX = (startX + endX) / 2;

  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function ConnectionLine({
  from,
  to,
  fromId,
  toId,
  color,
  isActive,
}: {
  from: Position;
  to: Position;
  fromId: string;
  toId: string;
  color: string;
  isActive: boolean;
}) {
  const path = calculatePath(from, to, fromId, toId);
  const strokeColor = COLOR_MAP[color] || '#374151';

  return (
    <g>
      {isActive && (
        <motion.path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={8}
          strokeOpacity={0.2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
          filter="blur(6px)"
        />
      )}

      <motion.path
        d={path}
        fill="none"
        stroke={isActive ? strokeColor : '#27272a'}
        strokeWidth={2}
        strokeDasharray={isActive ? 'none' : '6 6'}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5 }}
      />

      {isActive && (
        <motion.circle
          r={5}
          fill={strokeColor}
          initial={{ offsetDistance: '0%' }}
          animate={{ offsetDistance: '100%' }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            offsetPath: `path("${path}")`,
          }}
        >
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="0.5s"
            repeatCount="indefinite"
          />
        </motion.circle>
      )}
    </g>
  );
}

export function ConnectionLines({ positions, connections }: ConnectionLinesProps) {
  const {
    planner,
    tasks,
    researchAgent,
    webCoderAgent,
    outputStatus,
  } = useStore();

  const isAnyAgentActive =
    researchAgent.status === 'active' ||
    researchAgent.status === 'working' ||
    webCoderAgent.status === 'active' ||
    webCoderAgent.status === 'working';

  const isConnectionActive = (from: string, to: string): boolean => {
    switch (`${from}-${to}`) {
      case 'planner-taskList':
        return planner.status === 'working' || tasks.length > 0;
      case 'taskList-agents':
        return isAnyAgentActive || tasks.some(t => t.status === 'running');
      case 'agents-output':
        return outputStatus === 'working' || outputStatus === 'complete';
      default:
        return false;
    }
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '2400px', height: '1200px' }}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {connections.map((conn) => {
        const fromPos = positions[conn.from];
        const toPos = positions[conn.to];
        if (!fromPos || !toPos) return null;

        return (
          <ConnectionLine
            key={`${conn.from}-${conn.to}`}
            from={fromPos}
            to={toPos}
            fromId={conn.from}
            toId={conn.to}
            color={conn.color}
            isActive={isConnectionActive(conn.from, conn.to)}
          />
        );
      })}
    </svg>
  );
}