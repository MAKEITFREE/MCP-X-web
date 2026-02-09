import { Server, DetailedServer } from '../types';
import api from '../services/api';

// 定义服务器列表（初始为空，将通过API获取）
export let servers: Server[] = [];
export let mcp: Server[] = [];
// 定义分类列表（初始为空，将通过API获取）
export let categories: any[] = [];

// 从后台API获取服务器数据
export const fetchServers = async () => {
  try {
    // 使用统一的API服务获取服务器数据
    const serversData = await api.server.fetchServers();
    
    // 更新数据
    servers = serversData.servers;
      // 同步更新mcp数组
      mcp = [...servers];
      
      console.log('成功获取服务器数据:', servers.length);
      return servers;
  } catch (error) {
    console.error('获取服务器数据失败:', error);
    return [];
  }
};

// 从后台API获取分类数据
export const fetchCategories = async () => {
  try {
    // 使用统一的API服务获取分类数据
    const categoriesData = await api.category.fetchCategories();
      
    // 更新数据
    categories = categoriesData;
      
      console.log('成功获取分类数据:', categories);
      return categories;
  } catch (error) {
    console.error('获取分类数据失败:', error);
    return categories;
  }
};

// 获取某个类别的所有服务器
export const getServersByCategory = (categoryName: string): Server[] => {
  return servers.filter(server => server.category === categoryName);
};

// 初始化所有数据
const initAllData = async () => {
  try {
    await Promise.all([
      fetchServers(),
      fetchCategories()
    ]);
    console.log('所有数据初始化完成');
  } catch (err) {
    console.error('数据初始化失败:', err);
  }
};

// 初始化时自动获取数据
initAllData();

// 获取服务器详情数据
export const getServerById = async (id: string): Promise<DetailedServer> => {
  try {
    // 使用统一的API服务获取服务器详情
    return await api.server.getServerById(id);
  } catch (error) {
    console.error('获取服务器详情失败:', error);
    
    // 如果API请求失败，尝试从本地服务器列表中查找
    const baseServer = servers.find(server => server.id === id);
    
    if (!baseServer) {
      throw new Error(`服务器ID ${id} 不存在`);
    }
    
    // 创建一个通用的详细服务器对象作为备选
    return {
      ...baseServer,
      overview: baseServer.description,
      installation: {
        command: `npx -y @mcpx/cli@latest install ${baseServer.handle}`,
        platforms: ['MCP-X', 'Claude', 'Cursor', 'Windsurf']
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
  }
}; 