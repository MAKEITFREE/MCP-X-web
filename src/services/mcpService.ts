// import { toast } from '../utils/toast'; // 不在这里使用，由调用方处理提示

// MCP 工具接口定义
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

// MCP 执行结果接口
export interface MCPExecuteResult {
  ok: boolean;
  result?: any;
  message?: string;
  error?: string;
}

// MCP 探测结果接口
export interface MCPProbeResult {
  ok: boolean;
  tools?: MCPTool[];
  message?: string;
  error?: string;
}

// MCP 服务配置接口
export interface MCPServiceConfig {
  name?: string;
  command?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  transport?: {
    type: 'stdio' | 'sse' | 'websocket';
    url?: string;
    headers?: Record<string, string>;
  };
  baseUrl?: string;
  url?: string;
  server?: {
    url: string;
  };
  servers?: string[];
  tools?: MCPTool[];
  [key: string]: any;
}

/**
 * MCP 客户端服务类
 * 提供与 MCP 服务器交互的功能
 */
export class MCPService {
  private static instance: MCPService;
  private mcpClients: Map<string, any> = new Map();
  private toolCache: Map<string, MCPTool[]> = new Map();

  private constructor() {}

  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * 探测 MCP 工具列表
   */
  async probeMCPTools(serviceConfig: MCPServiceConfig): Promise<MCPProbeResult> {
    try {
      console.log('开始探测 MCP 工具:', serviceConfig);

      // 1. 优先检查是否有预定义的工具列表
      if (Array.isArray(serviceConfig.tools) && serviceConfig.tools.length > 0) {
        console.log('使用预定义工具列表:', serviceConfig.tools);
        return {
          ok: true,
          tools: serviceConfig.tools,
          message: '使用预定义工具列表'
        };
      }

      // 2. 尝试 WebSocket 连接（浏览器兼容）
      if (serviceConfig.transport?.type === 'websocket' && serviceConfig.transport.url) {
        const wsResult = await this.probeWebSocketEndpoint(serviceConfig.transport.url);
        if (wsResult.ok) {
          return wsResult;
        }
      }

      // 2.1 尝试 SSE 连接（浏览器兼容）
      if (serviceConfig.transport?.type === 'sse' && serviceConfig.transport.url) {
        const sseResult = await this.probeSSEEndpoint(serviceConfig.transport.url, serviceConfig.transport.headers);
        if (sseResult.ok) {
          return sseResult;
        }
      }

      // 3. 尝试 HTTP/HTTPS 连接
      const baseUrl = this.extractBaseUrl(serviceConfig);
      if (baseUrl && /^https?:\/\//i.test(baseUrl)) {
        const result = await this.probeHttpEndpoint(baseUrl);
        if (result.ok) {
          return result;
        }
      }

      // 4. 尝试使用 window.mcpLangchain（如果可用）
      const windowResult = await this.probeWindowMCP(serviceConfig);
      if (windowResult.ok) {
        return windowResult;
      }

      return {
        ok: false,
        message: '无法连接到 MCP 服务器，请检查配置'
      };

    } catch (error) {
      console.error('探测 MCP 工具失败:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: '探测失败'
      };
    }
  }

  /**
   * 执行 MCP 工具
   */
  async executeMCPTool(
    serviceConfig: MCPServiceConfig, 
    toolName: string, 
    args?: any
  ): Promise<MCPExecuteResult> {
    try {
      console.log('执行 MCP 工具:', { toolName, args, serviceConfig });

      // 1. 尝试使用已连接的 LangChain 客户端
      const configKey = this.getConfigKey(serviceConfig);
      const client = this.mcpClients.get(configKey);
      
      if (client && client.callTool) {
        try {
          const result = await client.callTool(toolName, args || {});
          console.log('LangChain 客户端执行结果:', result);
          return {
            ok: true,
            result: result,
            message: '执行成功'
          };
        } catch (error) {
          console.warn('LangChain 客户端执行失败:', error);
        }
      }

      // 2. 尝试使用 window.mcpLangchain
      const windowResult = await this.executeWindowMCP(serviceConfig, toolName, args);
      if (windowResult.ok) {
        return windowResult;
      }

      // 3. HTTP API 调用
      const baseUrl = this.extractBaseUrl(serviceConfig);
      if (baseUrl) {
        const httpResult = await this.executeHttpTool(baseUrl, toolName, args);
        if (httpResult.ok) {
          return httpResult;
        }
      }

      return {
        ok: false,
        message: '无法执行工具，请检查 MCP 服务器连接'
      };

    } catch (error) {
      console.error('执行 MCP 工具失败:', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : '未知错误',
        message: '执行失败'
      };
    }
  }

  /**
   * 获取缓存的工具列表
   */
  getCachedTools(serviceConfig: MCPServiceConfig): MCPTool[] | null {
    const key = this.getConfigKey(serviceConfig);
    return this.toolCache.get(key) || null;
  }

  /**
   * 清理资源
   */
  async cleanup(serviceConfig?: MCPServiceConfig) {
    if (serviceConfig) {
      const configKey = this.getConfigKey(serviceConfig);
      const client = this.mcpClients.get(configKey);
      if (client && client.disconnect) {
        try {
          await client.disconnect();
        } catch (error) {
          console.warn('断开 MCP 客户端连接失败:', error);
        }
      }
      this.mcpClients.delete(configKey);
      this.toolCache.delete(configKey);
    } else {
      // 清理所有连接
      for (const [, client] of this.mcpClients.entries()) {
        if (client && client.disconnect) {
          try {
            await client.disconnect();
          } catch (error) {
            console.warn('断开 MCP 客户端连接失败:', error);
          }
        }
      }
      this.mcpClients.clear();
      this.toolCache.clear();
    }
  }

  // 私有方法

  private getConfigKey(config: MCPServiceConfig): string {
    return JSON.stringify({
      command: config.command,
      transport: config.transport,
      baseUrl: config.baseUrl,
      url: config.url,
      server: config.server
    });
  }

  private extractBaseUrl(config: MCPServiceConfig): string | null {
    return config.baseUrl || 
           config.server?.url || 
           config.url || 
           config.transport?.url || 
           null;
  }

  private async probeHttpEndpoint(baseUrl: string): Promise<MCPProbeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const tryUrls = [
        baseUrl.replace(/\/$/, '') + '/tools',
        baseUrl.replace(/\/$/, '') + '/list-tools',
        baseUrl.replace(/\/$/, '') + '/api/tools',
        baseUrl
      ];

      for (const url of tryUrls) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            clearTimeout(timer);
            
            // 尝试解析工具列表
            let tools: MCPTool[] = [];
            if (Array.isArray(data)) {
              tools = data;
            } else if (data.tools && Array.isArray(data.tools)) {
              tools = data.tools;
            } else if (data.result && Array.isArray(data.result)) {
              tools = data.result;
            }

            return {
              ok: true,
              tools: tools,
              message: `HTTP 连接成功，发现 ${tools.length} 个工具`
            };
          }
        } catch (error) {
          console.warn(`HTTP 探测失败 ${url}:`, error);
        }
      }

      return {
        ok: false,
        message: 'HTTP 连接失败'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async probeWindowMCP(serviceConfig: MCPServiceConfig): Promise<MCPProbeResult> {
    const w = window as any;
    if (w.mcpLangchain?.probe || w.mcpLangchain?.listTools) {
      try {
        const res = w.mcpLangchain.probe
          ? await w.mcpLangchain.probe(serviceConfig)
          : await w.mcpLangchain.listTools(serviceConfig);
        
        if (res?.ok && Array.isArray(res?.tools)) {
          return {
            ok: true,
            tools: res.tools,
            message: `窗口 MCP 连接成功，发现 ${res.tools.length} 个工具`
          };
        }
      } catch (error) {
        console.warn('窗口 MCP 探测失败:', error);
      }
    }

    return {
      ok: false,
      message: '窗口 MCP 不可用'
    };
  }

  private async executeWindowMCP(
    serviceConfig: MCPServiceConfig, 
    toolName: string, 
    args?: any
  ): Promise<MCPExecuteResult> {
    const w = window as any;
    if (w.mcpLangchain?.execute) {
      try {
        const res = await w.mcpLangchain.execute({ serviceConfig, tool: toolName, args });
        return {
          ok: res?.ok || false,
          result: res?.result,
          message: res?.message || (res?.ok ? '执行成功' : '执行失败')
        };
      } catch (error) {
        console.warn('窗口 MCP 执行失败:', error);
      }
    }

    return {
      ok: false,
      message: '窗口 MCP 执行器不可用'
    };
  }

  private async executeHttpTool(
    baseUrl: string, 
    toolName: string, 
    args?: any
  ): Promise<MCPExecuteResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const tryUrls = [
        `${baseUrl.replace(/\/$/, '')}/execute/${toolName}`,
        `${baseUrl.replace(/\/$/, '')}/tools/${toolName}/execute`,
        `${baseUrl.replace(/\/$/, '')}/api/tools/${toolName}`
      ];

      for (const url of tryUrls) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(args || {})
          });

          if (response.ok) {
            const data = await response.json();
            clearTimeout(timer);
            
            return {
              ok: true,
              result: data,
              message: 'HTTP 执行成功'
            };
          }
        } catch (error) {
          console.warn(`HTTP 执行失败 ${url}:`, error);
        }
      }

      return {
        ok: false,
        message: 'HTTP 执行失败'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * WebSocket 端点探测
   */
  private async probeWebSocketEndpoint(url: string): Promise<MCPProbeResult> {
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        resolve({
          ok: false,
          message: 'WebSocket 连接超时'
        });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timer);
        // 发送 MCP 初始化消息
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.result && Array.isArray(data.result.tools)) {
            const tools: MCPTool[] = data.result.tools.map((tool: any) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }));
            
            ws.close();
            resolve({
              ok: true,
              tools: tools,
              message: `WebSocket 连接成功，发现 ${tools.length} 个工具`
            });
          } else {
            ws.close();
            resolve({
              ok: false,
              message: 'WebSocket 响应格式错误'
            });
          }
        } catch (error) {
          ws.close();
          resolve({
            ok: false,
            message: 'WebSocket 响应解析失败'
          });
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve({
          ok: false,
          message: 'WebSocket 连接失败'
        });
      };
    });
  }

  /**
   * SSE 端点探测
   */
  private async probeSSEEndpoint(url: string, headers?: Record<string, string>): Promise<MCPProbeResult> {
    return new Promise((resolve) => {
      const eventSource = new EventSource(url);
      const timer = setTimeout(() => {
        eventSource.close();
        resolve({
          ok: false,
          message: 'SSE 连接超时'
        });
      }, 5000);

      eventSource.onopen = () => {
        // SSE 连接成功，尝试获取工具列表
        // 注意：标准 SSE 不支持发送消息，这里只是示例
        // 实际实现可能需要通过其他方式获取工具列表
        clearTimeout(timer);
        eventSource.close();
        resolve({
          ok: true,
          tools: [],
          message: 'SSE 连接成功，但需要额外的 API 来获取工具列表'
        });
      };

      eventSource.onerror = () => {
        clearTimeout(timer);
        eventSource.close();
        resolve({
          ok: false,
          message: 'SSE 连接失败'
        });
      };
    });
  }
}

// 导出单例实例
export const mcpService = MCPService.getInstance();
