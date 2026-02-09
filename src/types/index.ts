export type ServerTag = 'Remote' | 'Local' | 'Scanned';
export type Category = 
  | '精选MCP' 
  | '网络搜索' 
  | '内存管理' 
  | '浏览器自动化' 
  | '编码助手' 
  | '数据处理' 
  | '地图服务'
  | '办公软件'
  | '开发工具'
  | '支付服务'
  | '云计算服务';

// Agent相关类型定义
export interface AgentCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sort?: number;
  status: number;
  agentCount?: number;
  createTime?: string;
  updateTime?: string;
  // 向后兼容的字段
  nameEn?: string;
  sortOrder?: number;
}

export interface Agent {
  id: number;
  name: string;
  avatar: string;
  description: string;
  author: string;
  githubUrl?: string;
  categoryId: number;
  tags: string[];
  systemRole?: string;
  systemPromote?: string;
  usageCount: number;
  likeCount: number;
  starCount: number;
  viewCount: number;
  status: number;
  isFeatured: number;
  publishTime: string;
  openSay?: string;
  questions?: string;
  createTime?: string;
  updateTime?: string;
  // 前端计算字段
  usageLabel?: string;
  categoryName?: string;
  verified?: boolean;
  new?: boolean;
  //适配英文
  
  nameEn: string;
  openSayEn?: string;
  questionsEn?: string;
  systemRoleEn?: string;
  systemPromoteEn?: string;
  descriptionEn: string;
}

export interface DetailedAgent extends Agent {
  overview?: string;
  capabilities?: string[];
  prompt?: string;
  demoMessages?: {
    user: string;
    assistant: string;
  }[];
  relatedAgents?: Agent[];
}

export interface Server {
  id: string;
  name: string;
  nameEn?: string;
  nameCn?: string;
  handle: string;
  description: string;
  descriptionEn?: string;
  descriptionCn?: string;
  chineseName?: string;
  category: Category;
  tags: ServerTag[];
  usage: number;
  usageLabel: string;
  verified?: boolean;
  new?: boolean;
}

export interface DetailedServer extends Server {
  overview: string;
  tools?: any[];
  serverConfig?: any;
  deployedEnvs?: any;
  readme?: string;
  readmeCn?: string;
  readmeEn?: string;
  createdDate?: string;
  gmtCreated?: number;
  gmtUpdated?: number;
  installation: {
    command: string;
    platforms: string[];
  };
  security: {
    level: 'secure' | 'moderate' | 'unknown';
    details?: string;
  };
  statistics: {
    monthlyCalls: number;
    license: string;
    published: string;
    local: boolean;
  };
}

// 知识库相关类型定义
export interface KnowledgeInfo {
  id?: number | string;
  kid?: string;
  uid?: number;
  kname: string;
  share: number; // 0 否 1是
  description?: string;
  knowledgeSeparator?: string;
  questionSeparator?: string;
  overlapChar?: number;
  retrieveLimit: number;
  textBlockSize: number;
  vectorModelName: string;
  embeddingModelName: string;
  systemPrompt?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface KnowledgeAttach {
  id?: number;
  kid: string;
  // 旧接口字段
  attachName?: string;
  attachType?: string;
  attachSize?: number;
  attachPath?: string;
  status?: number; // 处理状态
  // 新接口字段（与后端detail返回兼容）
  docId?: string;
  docName?: string;
  docType?: string;
  content?: string;
  ossId?: string | number | null;
  picStatus?: number;
  picAnysStatus?: number;
  vectorStatus?: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface KnowledgeFragment {
  id?: number;
  docId: string;
  content: string;
  metadata?: string;
  vectorId?: string;
  createTime?: string;
  updateTime?: string;
}

// 导出人工反馈相关类型
export * from './human-feedback';

// 导出画布编辑器相关类型
export * from './types';