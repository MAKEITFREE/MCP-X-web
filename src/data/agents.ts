import { Agent, AgentCategory, DetailedAgent } from '../types';
import { api } from '../services/api';

// 模拟Agent数据
export const mockAgents: Agent[] = [];

// 模拟分类数据
export const mockCategories: AgentCategory[] = [
  { id: 1, name: '游戏', nameEn: 'game', sortOrder: 1, status: 1 },
  { id: 2, name: '娱乐', nameEn: 'entertainment', sortOrder: 2, status: 1 },
  { id: 3, name: '学术', nameEn: 'academic', sortOrder: 3, status: 1 },
  { id: 4, name: '编程', nameEn: 'programming', sortOrder: 4, status: 1 }
];

// 按分类获取Agent
export const getAgentsByCategory = (categoryId?: number) => {
  if (!categoryId) {
    return mockAgents;
  }
  return mockAgents.filter(agent => agent.categoryId === categoryId);
};

// 按分类名称获取Agent
export const getAgentsByCategoryName = (categoryName: string) => {
  if (categoryName === '全部') {
    return mockAgents;
  }
  return mockAgents.filter(agent => agent.categoryName === categoryName);
};

// 获取分类列表和数量
export const agentCategories: { name: string; count: number; id?: number }[] = [
  { name: '全部', count: mockAgents.length },
  ...mockCategories.map(cat => ({
    name: cat.name,
    id: cat.id,
    count: getAgentsByCategory(cat.id).length
  }))
].filter(category => category.count > 0);

// 获取详细Agent信息（模拟）
export const getAgentDetail = (id: string | number): DetailedAgent | null => {
  const numId = typeof id === 'string' ? parseInt(id) : id;
  const agent = mockAgents.find(a => a.id === numId);
  if (!agent) return null;

  // 模拟详细信息
  return {
    ...agent,
    overview: '作为海龟汤主持人，这个AI Agent专注于引导用户通过提问逐步推理复杂的虚构情境。它拥有完整的汤面（谜题描述）、汤底（真相）和关键点（核心线索），并通过结构化的互动方式，引导玩家提出"是/否/无关"的问题，帮助他们逐步还原故事背后的真相。',
    capabilities: [
      '引导用户通过提问逐步推理',
      '维护游戏逻辑连贯性',
      '提供"是/否/无关"的准确回答',
      '确保游戏的趣味性和挑战性',
      '适应不同难度的谜题'
    ],
    prompt: agent.systemPromote || '你是一个专业的海龟汤主持人，擅长引导玩家通过逻辑推理解开谜题。你需要根据提供的汤面、汤底和关键点，回答玩家的问题，只能回答"是"、"否"或"无关"。',
    demoMessages: [
      {
        user: '汤面是：我在黑暗中醒来，发现自己被绑在一张椅子上，四周没有出口。',
        assistant: '我们来玩海龟汤吧：汤面是：我在黑暗中醒来，发现自己被绑在一张椅子上，四周没有出口。'
      },
      {
        user: '我被绑在椅子上与外界没有联系有关吗？',
        assistant: '是'
      },
      {
        user: '我被绑在椅子上是因为有人想要我保持沉默？',
        assistant: '否'
      }
    ],
    relatedAgents: mockAgents.filter(a => a.categoryName === agent.categoryName && a.id !== numId).slice(0, 6)
  };
}; 