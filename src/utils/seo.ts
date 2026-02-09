// SEO 工具函数
export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  canonicalUrl?: string;
}

// 默认 SEO 配置
export const defaultSEO: SEOConfig = {
  title: 'MCP-X - 专业的MCP智能体平台 | Model Context Protocol扩展中心',
  description: 'MCP-X是领先的Model Context Protocol(MCP)智能体平台，提供丰富的MCP扩展、AI智能体和工具集成。探索MCP协议的无限可能，提升AI应用开发效率。',
  keywords: 'MCP, MCP-X, Model Context Protocol, AI智能体, AI助手, 人工智能, MCP扩展, AI工具, 智能对话, Claude MCP, OpenAI, AI平台',
  ogTitle: 'MCP-X - 专业的MCP智能体平台',
  ogDescription: '领先的Model Context Protocol智能体平台，提供丰富的MCP扩展和AI工具集成',
  ogImage: 'https://www.mcp-x.com/assets/wechat-qrcode.jpg',
  twitterTitle: 'MCP-X - 专业的MCP智能体平台',
  twitterDescription: '领先的Model Context Protocol智能体平台，提供丰富的MCP扩展和AI工具集成',
  canonicalUrl: 'https://www.mcp-x.com'
};

// 页面特定的 SEO 配置
export const pageSEO: Record<string, SEOConfig> = {
  '/': {
    title: 'MCP-X - 专业的MCP智能体平台 | Model Context Protocol扩展中心',
    description: 'MCP-X是领先的Model Context Protocol(MCP)智能体平台，提供丰富的MCP扩展、AI智能体和工具集成。探索MCP协议的无限可能，提升AI应用开发效率。',
    keywords: 'MCP, MCP-X, Model Context Protocol, AI智能体, AI助手, 人工智能, MCP扩展, AI工具, 智能对话, Claude MCP, OpenAI, AI平台',
    canonicalUrl: 'https://www.mcp-x.com'
  },
  '/agents': {
    title: 'AI智能体 - MCP智能体平台 | MCP-X',
    description: '发现和使用各种专业的AI智能体，基于Model Context Protocol(MCP)协议开发，提供文档分析、代码生成、数据处理等强大功能。',
    keywords: 'AI智能体, MCP智能体, 人工智能助手, AI助手, Model Context Protocol, MCP-X智能体, AI工具',
    canonicalUrl: 'https://www.mcp-x.com/agents'
  },
  '/chat': {
    title: '智能对话 - AI聊天助手 | MCP-X',
    description: '与强大的AI助手进行智能对话，支持MCP扩展，提供专业的AI聊天体验和智能问答服务。',
    keywords: 'AI聊天, 智能对话, AI助手, MCP聊天, 人工智能对话, AI问答',
    canonicalUrl: 'https://www.mcp-x.com/chat'
  },
  '/servers': {
    title: 'MCP服务器 - Model Context Protocol扩展 | MCP-X',
    description: '探索丰富的MCP服务器和扩展，为你的AI应用添加强大的功能模块，支持各种专业领域的AI工具集成。',
    keywords: 'MCP服务器, MCP扩展, Model Context Protocol服务器, AI扩展, MCP工具',
    canonicalUrl: 'https://www.mcp-x.com/servers'
  },
  '/pricing': {
    title: '价格方案 - MCP-X智能体平台定价 | MCP-X',
    description: '查看MCP-X平台的价格方案，提供免费和付费版本，满足个人用户和企业用户的不同需求。',
    keywords: 'MCP-X价格, AI平台定价, MCP服务价格, 智能体平台费用',
    canonicalUrl: 'https://www.mcp-x.com/pricing'
  },
  '/about': {
    title: '关于我们 - MCP-X团队介绍 | MCP-X',
    description: '了解MCP-X团队，我们致力于推广Model Context Protocol技术，为用户提供最优质的AI智能体服务。',
    keywords: 'MCP-X团队, 关于MCP-X, Model Context Protocol开发者, AI平台团队',
    canonicalUrl: 'https://www.mcp-x.com/about'
  },
  '/download': {
    title: '下载MCP-X - 桌面版客户端下载 | MCP-X',
    description: '下载MCP-X桌面版客户端，享受更好的MCP智能体使用体验，支持Windows、macOS和Linux系统。',
    keywords: 'MCP-X下载, MCP客户端下载, AI助手下载, MCP桌面版',
    canonicalUrl: 'https://www.mcp-x.com/download'
  }
};

// 动态设置页面 SEO
export const setSEO = (path: string, customConfig?: Partial<SEOConfig>) => {
  const pageConfig = pageSEO[path] || defaultSEO;
  const finalConfig = { ...pageConfig, ...customConfig };

  // 设置 title
  if (finalConfig.title) {
    document.title = finalConfig.title;
  }

  // 设置 meta 标签
  const setMetaTag = (name: string, content: string, property = false) => {
    const attribute = property ? 'property' : 'name';
    let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, name);
      document.head.appendChild(meta);
    }
    meta.content = content;
  };

  if (finalConfig.description) {
    setMetaTag('description', finalConfig.description);
  }

  if (finalConfig.keywords) {
    setMetaTag('keywords', finalConfig.keywords);
  }

  if (finalConfig.ogTitle) {
    setMetaTag('og:title', finalConfig.ogTitle, true);
  }

  if (finalConfig.ogDescription) {
    setMetaTag('og:description', finalConfig.ogDescription, true);
  }

  if (finalConfig.ogImage) {
    setMetaTag('og:image', finalConfig.ogImage, true);
  }

  if (finalConfig.twitterTitle) {
    setMetaTag('twitter:title', finalConfig.twitterTitle);
  }

  if (finalConfig.twitterDescription) {
    setMetaTag('twitter:description', finalConfig.twitterDescription);
  }

  // 设置 canonical URL
  if (finalConfig.canonicalUrl) {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = finalConfig.canonicalUrl;
  }

  // 设置 og:url
  if (finalConfig.canonicalUrl) {
    setMetaTag('og:url', finalConfig.canonicalUrl, true);
  }
};

// MCP 相关关键词生成器
export const generateMCPKeywords = (baseKeywords: string[] = []) => {
  const mcpKeywords = [
    'MCP', 'MCP-X', 'Model Context Protocol',
    'AI智能体', 'AI助手', '人工智能',
    'MCP扩展', 'AI工具', '智能对话',
    'Claude MCP', 'OpenAI', 'AI平台',
    'MCP服务器', 'AI应用', '智能助手'
  ];
  
  return [...new Set([...mcpKeywords, ...baseKeywords])].join(', ');
};
