import { Server, DetailedServer } from '../types';

export const servers: Server[] = [];

export const detailedServers: Record<string, DetailedServer> = {
  '1': {
    ...servers[0],
    overview: 'An MCP server implementation that provides a tool for dynamic and reflective problem-solving through a structured thinking process.',
    installation: {
      command: 'npx -y @smithery/cli@latest install @smithery-ai/server-sequential-thinking',
      platforms: ['Claude', 'Cursor', 'Windsurf', 'Vac']
    },
    security: {
      level: 'secure',
      details: 'End-to-end encryption for all data transfers'
    },
    statistics: {
      monthlyCalls: 515071,
      license: 'MIT',
      published: '12/13/2024',
      local: false
    }
  }
};

export const getServerById = (id: string): DetailedServer => {
  const baseServer = servers.find(server => server.id === id);
  
  if (!baseServer) {
    throw new Error(`Server with id ${id} not found`);
  }
  
  if (detailedServers[id]) {
    return detailedServers[id];
  }
  
  // Create a generic detailed server if not specifically defined
  return {
    ...baseServer,
    overview: baseServer.description,
    installation: {
      command: `npx -y @smithery/cli@latest install ${baseServer.handle}`,
      platforms: ['Claude', 'Cursor', 'Windsurf', 'Vac']
    },
    security: {
      level: 'unknown'
    },
    statistics: {
      monthlyCalls: baseServer.usage,
      license: 'MIT',
      published: '01/01/2025',
      local: baseServer.tags.includes('Local')
    }
  };
};

export const getServersByCategory = (category: string): Server[] => {
  return servers.filter(server => server.category === category);
};

export const categories = ['精选MCP', '浏览器自动化', '办公软件', '安全软件', '变成助手', '设计软件'];