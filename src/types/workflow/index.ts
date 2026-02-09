// System state types

export type NodeStatus = 'idle' | 'active' | 'working' | 'complete' | 'error';

export type NodeType =
  | 'input'
  | 'planner'
  | 'taskList'
  | 'researchAgent'
  | 'webCoderAgent'
  | 'output';

export interface Task {
  task_id: string;
  agent: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: string; // Minimal display: navigate(url), type(text), etc.
  timestamp: number;
  status: 'calling' | 'complete' | 'error';
  result?: string;
}

export interface AgentState {
  status: NodeStatus;
  currentTask?: Task;
  toolCalls: ToolCall[];
}

export interface PlannerState {
  status: NodeStatus;
  thinking?: string;
  currentToolCall?: ToolCall;
}

export interface Message {
  id: string;
  type: 'user_input' | 'planner' | 'agent' | 'tool' | 'tool_result' | 'output' | 'error';
  content: string;
  timestamp: number;
  agent?: string;
  tool?: string;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  userInput: string;
  status: 'running' | 'complete' | 'error';
  finalOutput?: string;
}

// WebSocket event types
export type SystemEvent =
  | { type: 'user_input'; data: { text: string } }
  | { type: 'planner_thinking'; data: { content: string } }
  | { type: 'planner_tool_call'; data: { tool: string; args: Record<string, unknown> } }
  | { type: 'task_list_update'; data: { tasks: Task[] } }
  | { type: 'agent_start'; data: { agent: string; taskId: string; description: string } }
  | { type: 'agent_tool_call'; data: { agent: string; tool: string; args: Record<string, unknown> } }
  | { type: 'agent_tool_result'; data: { agent: string; tool: string; result: string } }
  | { type: 'agent_complete'; data: { agent: string; taskId: string; result: string } }
  | { type: 'agent_error'; data: { agent: string; taskId: string; error: string } }
  | { type: 'final_output'; data: { response: string; files: string[] } }
  | { type: 'system_error'; data: { message: string } };

// Node positions for auto-layout
export interface NodePosition {
  x: number;
  y: number;
}

export interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
}