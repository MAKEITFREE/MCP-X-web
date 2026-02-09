import { create } from 'zustand';
import type {
  Task,
  ToolCall,
  Message,
  Session,
  NodeStatus,
  AgentState,
  PlannerState,
  CanvasState,
} from '../../../types/workflow';

interface SystemStore {
  // Canvas state
  canvas: CanvasState;
  setCanvas: (canvas: Partial<CanvasState>) => void;

  // Current session
  currentSession: Session | null;
  sessions: Session[];
  startSession: (userInput: string) => void;
  endSession: (output?: string, error?: boolean) => void;

  // Messages (real-time log)
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

  // Input node
  inputStatus: NodeStatus;
  inputText: string;
  setInputText: (text: string) => void;
  setInputStatus: (status: NodeStatus) => void;

  // Planner node
  planner: PlannerState;
  setPlannerStatus: (status: NodeStatus) => void;
  setPlannerThinking: (thinking: string) => void;
  setPlannerToolCall: (toolCall: ToolCall | undefined) => void;

  // Task list
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;

  // Research Agent
  researchAgent: AgentState;
  setResearchAgentStatus: (status: NodeStatus) => void;
  setResearchAgentTask: (task: Task | undefined) => void;
  addResearchAgentToolCall: (toolCall: ToolCall) => void;
  updateResearchAgentToolCall: (id: string, updates: Partial<ToolCall>) => void;
  clearResearchAgentToolCalls: () => void;

  // WebCoder Agent
  webCoderAgent: AgentState;
  setWebCoderAgentStatus: (status: NodeStatus) => void;
  setWebCoderAgentTask: (task: Task | undefined) => void;
  addWebCoderAgentToolCall: (toolCall: ToolCall) => void;
  updateWebCoderAgentToolCall: (id: string, updates: Partial<ToolCall>) => void;
  clearWebCoderAgentToolCalls: () => void;

  // Output node
  outputStatus: NodeStatus;
  outputText: string;
  outputFiles: string[];
  setOutputStatus: (status: NodeStatus) => void;
  setOutput: (text: string, files: string[]) => void;

  // Reset all state
  reset: () => void;
}

const initialAgentState: AgentState = {
  status: 'idle',
  currentTask: undefined,
  toolCalls: [],
};

const initialPlannerState: PlannerState = {
  status: 'idle',
  thinking: undefined,
  currentToolCall: undefined,
};

export const useSystemStore = create<SystemStore>((set) => ({
  // Canvas
  canvas: { zoom: 1, panX: 0, panY: 0 },
  setCanvas: (canvas) =>
    set((state) => ({ canvas: { ...state.canvas, ...canvas } })),

  // Sessions
  currentSession: null,
  sessions: [],
  startSession: (userInput) => {
    const session: Session = {
      id: `session-${Date.now()}`,
      startTime: Date.now(),
      userInput,
      status: 'running',
    };
    set((state) => ({
      currentSession: session,
      sessions: [...state.sessions, session],
      inputText: userInput,
      inputStatus: 'active',
    }));
  },
  endSession: (output, error) => {
    set((state) => {
      if (!state.currentSession) return state;
      const updatedSession: Session = {
        ...state.currentSession,
        endTime: Date.now(),
        status: error ? 'error' : 'complete',
        finalOutput: output,
      };
      return {
        currentSession: null,
        sessions: state.sessions.map((s) =>
          s.id === updatedSession.id ? updatedSession : s
        ),
      };
    });
  },

  // Messages
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
        },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  // Input
  inputStatus: 'idle',
  inputText: '',
  setInputText: (text) => set({ inputText: text }),
  setInputStatus: (status) => set({ inputStatus: status }),

  // Planner
  planner: initialPlannerState,
  setPlannerStatus: (status) =>
    set((state) => ({ planner: { ...state.planner, status } })),
  setPlannerThinking: (thinking) =>
    set((state) => ({ planner: { ...state.planner, thinking } })),
  setPlannerToolCall: (toolCall) =>
    set((state) => ({ planner: { ...state.planner, currentToolCall: toolCall } })),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.task_id === taskId ? { ...t, ...updates } : t
      ),
    })),

  // Research Agent
  researchAgent: initialAgentState,
  setResearchAgentStatus: (status) =>
    set((state) => ({ researchAgent: { ...state.researchAgent, status } })),
  setResearchAgentTask: (task) =>
    set((state) => ({ researchAgent: { ...state.researchAgent, currentTask: task } })),
  addResearchAgentToolCall: (toolCall) =>
    set((state) => ({
      researchAgent: {
        ...state.researchAgent,
        toolCalls: [...state.researchAgent.toolCalls, toolCall],
      },
    })),
  updateResearchAgentToolCall: (id, updates) =>
    set((state) => ({
      researchAgent: {
        ...state.researchAgent,
        toolCalls: state.researchAgent.toolCalls.map((tc) =>
          tc.id === id ? { ...tc, ...updates } : tc
        ),
      },
    })),
  clearResearchAgentToolCalls: () =>
    set((state) => ({ researchAgent: { ...state.researchAgent, toolCalls: [] } })),

  // WebCoder Agent
  webCoderAgent: initialAgentState,
  setWebCoderAgentStatus: (status) =>
    set((state) => ({ webCoderAgent: { ...state.webCoderAgent, status } })),
  setWebCoderAgentTask: (task) =>
    set((state) => ({ webCoderAgent: { ...state.webCoderAgent, currentTask: task } })),
  addWebCoderAgentToolCall: (toolCall) =>
    set((state) => ({
      webCoderAgent: {
        ...state.webCoderAgent,
        toolCalls: [...state.webCoderAgent.toolCalls, toolCall],
      },
    })),
  updateWebCoderAgentToolCall: (id, updates) =>
    set((state) => ({
      webCoderAgent: {
        ...state.webCoderAgent,
        toolCalls: state.webCoderAgent.toolCalls.map((tc) =>
          tc.id === id ? { ...tc, ...updates } : tc
        ),
      },
    })),
  clearWebCoderAgentToolCalls: () =>
    set((state) => ({ webCoderAgent: { ...state.webCoderAgent, toolCalls: [] } })),

  // Output
  outputStatus: 'idle',
  outputText: '',
  outputFiles: [],
  setOutputStatus: (status) => set({ outputStatus: status }),
  setOutput: (text, files) => set({ outputText: text, outputFiles: files, outputStatus: 'complete' }),

  // Reset
  reset: () =>
    set({
      inputStatus: 'idle',
      inputText: '',
      planner: initialPlannerState,
      tasks: [],
      researchAgent: initialAgentState,
      webCoderAgent: initialAgentState,
      outputStatus: 'idle',
      outputText: '',
      outputFiles: [],
      messages: [],
    }),
}));