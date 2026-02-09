import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { getServerById } from '../data/servers_api';
import { Badge } from '../components/ui/Badge';
import { VerifiedBadge } from '../components/ui/VerifiedBadge';
import { ArrowLeft, Copy, ZapIcon, AlertTriangle, Bug, HelpCircle, Terminal, Code2, BookOpen, Download } from 'lucide-react';
import { DetailedServer } from '../types';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { useLanguage } from '../contexts/LanguageContext';

// 用于将HTML表格内容转换为可视化表格的组件
const HtmlTable: React.FC<{ content: string }> = ({ content }) => {
  // 预处理u003c格式的编码
  const preProcessRawText = (text: string): string => {
    // 将文本中的u003c等特殊序列转换为正常的HTML标签
    return text
      .replace(/u003ctable/g, '<table')
      .replace(/u003e\/table/g, '>/table')
      .replace(/u003cthead/g, '<thead')
      .replace(/u003e\/thead/g, '>/thead')
      .replace(/u003ctbody/g, '<tbody')
      .replace(/u003e\/tbody/g, '>/tbody')
      .replace(/u003ctr/g, '<tr')
      .replace(/u003e\/tr/g, '>/tr')
      .replace(/u003cth/g, '<th')
      .replace(/u003e\/th/g, '>/th')
      .replace(/u003ctd/g, '<td')
      .replace(/u003e\/td/g, '>/td')
      .replace(/u003cspan/g, '<span')
      .replace(/u003e\/span/g, '>/span')
      .replace(/u003cp/g, '<p')
      .replace(/u003e\/p/g, '>/p')
      .replace(/u002f/g, '/');
  };

  // 使用dangerouslySetInnerHTML添加表格，但要确保已经进行了安全处理
  const processTableContent = (html: string) => {
    if (!html) return '';
    
    // 预先处理u003c编码
    let processedHtml = preProcessRawText(html);
    
    // 首先处理所有编码问题，便于后续查找
    let processedContent = processedHtml
      // 字符转换
      .replace(/u003c/g, '<')
      .replace(/u003e/g, '>')
      .replace(/u002f/g, '/')
      .replace(/u003d/g, '=')
      .replace(/u0026nbsp;/g, ' ')
      // HTML实体
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#39;/g, "'")
      .replace(/&#47;/g, '/');
    
    // 特定表格类型的内容提取
    let tableContent = '';
    
    if (processedContent.includes('能力介绍')) {
      const titleIndex = processedContent.indexOf('能力介绍');
      const startIndex = processedContent.indexOf('<table', titleIndex);
      const endIndex = processedContent.indexOf('</table>', startIndex) + 8;
      
      if (startIndex !== -1 && endIndex !== -1) {
        tableContent += '<h2 class="text-xl font-bold mt-5 mb-3 text-white">能力介绍</h2>';
        tableContent += processedContent.substring(startIndex, endIndex);
      }
    }
    
    if (processedContent.includes('地理编码')) {
      const titleIndex = processedContent.indexOf('地理编码');
      const startIndex = processedContent.indexOf('<table', titleIndex);
      const endIndex = processedContent.indexOf('</table>', startIndex) + 8;
      
      if (startIndex !== -1 && endIndex !== -1) {
        tableContent += '<h2 class="text-xl font-bold mt-5 mb-3 text-white">地理编码</h2>';
        tableContent += processedContent.substring(startIndex, endIndex);
      }
    }
    
    if (processedContent.includes('逆地理编码')) {
      const titleIndex = processedContent.indexOf('逆地理编码');
      const startIndex = processedContent.indexOf('<table', titleIndex);
      const endIndex = processedContent.indexOf('</table>', startIndex) + 8;
      
      if (startIndex !== -1 && endIndex !== -1) {
        tableContent += '<h2 class="text-xl font-bold mt-5 mb-3 text-white">逆地理编码</h2>';
        tableContent += processedContent.substring(startIndex, endIndex);
      }
    }
    
    if (processedContent.includes('IP 定位')) {
      const titleIndex = processedContent.indexOf('IP 定位');
      const startIndex = processedContent.indexOf('<table', titleIndex);
      const endIndex = processedContent.indexOf('</table>', startIndex) + 8;
      
      if (startIndex !== -1 && endIndex !== -1) {
        tableContent += '<h2 class="text-xl font-bold mt-5 mb-3 text-white">IP 定位</h2>';
        tableContent += processedContent.substring(startIndex, endIndex);
      }
    }
    
    if (processedContent.includes('天气查询')) {
      const titleIndex = processedContent.indexOf('天气查询');
      const startIndex = processedContent.indexOf('<table', titleIndex);
      const endIndex = processedContent.indexOf('</table>', startIndex) + 8;
      
      if (startIndex !== -1 && endIndex !== -1) {
        tableContent += '<h2 class="text-xl font-bold mt-5 mb-3 text-white">天气查询</h2>';
        tableContent += processedContent.substring(startIndex, endIndex);
      }
    }
    
    // 如果没有找到任何表格，但原始内容包含表格标签，则尝试直接提取表格
    if (!tableContent && processedContent.includes('<table')) {
      const startIndex = processedContent.indexOf('<table');
      const endIndex = processedContent.lastIndexOf('</table>') + 8;
      
      if (startIndex !== -1 && endIndex !== -1) {
        tableContent = processedContent.substring(startIndex, endIndex);
      }
    }
    
    // 如果没有找到任何表格，返回空字符串
    if (!tableContent) return '';
      
    // 添加样式类到表格标签
    let styledContent = tableContent
      .replace(/<table/g, '<table class="min-w-full border border-gray-700 bg-gray-800 rounded-lg mb-4"')
      .replace(/<tr/g, '<tr class="border-b border-gray-700"')
      .replace(/<th/g, '<th class="px-4 py-2 text-left text-white border-r border-gray-700 bg-gray-700"')
      .replace(/<td/g, '<td class="px-4 py-2 text-gray-300 border-r border-gray-700"')
      .replace(/colspan/g, 'colSpan')
      .replace(/rowspan/g, 'rowSpan');
      
    return styledContent;
  };
  
  const html = processTableContent(content);
  
  if (!html) return null;
  
  return (
    <div className="overflow-x-auto my-4">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export const ServerDetailPage: React.FC = () => {
  const { currentLanguage, t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const searchQ = params.get('q');
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'api'>('overview');

  const [isCopiedConfig, setIsCopiedConfig] = useState(false);
  const [server, setServer] = useState<DetailedServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);

  // 支持的开发工具配置
  const devTools = [
    {
      id: 'mcp-x-desktop',
      name: 'MCP-X Desktop',
      icon: '🚀',
      supportsDeepLink: false,
      description: currentLanguage === 'zh' ? '复制配置到 MCP-X Desktop' : 'Copy config for MCP-X Desktop'
    },
    {
      id: 'cursor',
      name: 'Cursor',
      icon: '🖱️',
      supportsDeepLink: true,
      description: currentLanguage === 'zh' ? '一键安装到 Cursor' : 'One-click install to Cursor'
    },
    {
      id: 'vscode',
      name: 'VS Code',
      icon: '💻',
      supportsDeepLink: false,
      description: currentLanguage === 'zh' ? '复制配置到 VS Code' : 'Copy config for VS Code'
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      icon: '🤖',
      supportsDeepLink: true,
      description: currentLanguage === 'zh' ? '一键安装到 Claude Desktop' : 'One-click install to Claude Desktop'
    },
    {
      id: 'windsurf',
      name: 'Windsurf',
      icon: '🏄',
      supportsDeepLink: false,
      description: currentLanguage === 'zh' ? '复制配置到 Windsurf' : 'Copy config for Windsurf'
    },
    {
      id: 'cline',
      name: 'Cline',
      icon: '📟',
      supportsDeepLink: false,
      description: currentLanguage === 'zh' ? '复制配置到 Cline' : 'Copy config for Cline'
    }
  ];

  // 获取MCP服务器配置
  const getMcpConfig = () => {
    if (!server?.serverConfig) return null;
    
    try {
      let config = server.serverConfig;
      if (typeof config === 'string') {
        config = config.replace(/```json?/g, '').replace(/```/g, '').trim();
        config = JSON.parse(config);
      }
      return config;
    } catch (e) {
      console.error('解析配置失败:', e);
      return null;
    }
  };

  // 获取服务器名称（从配置中提取）
  const getServerName = () => {
    const config = getMcpConfig();
    if (config?.mcpServers) {
      const serverNames = Object.keys(config.mcpServers);
      return serverNames[0] || server?.name || 'mcp-server';
    }
    return server?.name || 'mcp-server';
  };

  // 获取单个服务器配置
  const getServerConfig = () => {
    const config = getMcpConfig();
    if (config?.mcpServers) {
      const serverNames = Object.keys(config.mcpServers);
      if (serverNames.length > 0) {
        return config.mcpServers[serverNames[0]];
      }
    }
    return config;
  };

  // 一键安装到指定工具
  const handleInstallToTool = async (toolId: string) => {
    const config = getMcpConfig();
    if (!config) {
      setInstallStatus(currentLanguage === 'zh' ? '配置解析失败' : 'Config parse failed');
      setTimeout(() => setInstallStatus(null), 3000);
      return;
    }

    const serverName = getServerName();
    const serverConfig = getServerConfig();
    const configStr = JSON.stringify(config, null, 2);

    // Base64 编码函数
    const base64Encode = (str: string): string => {
      try {
        return btoa(unescape(encodeURIComponent(str)));
      } catch (e) {
        return btoa(str);
      }
    };

    // 根据不同工具执行不同操作
    switch (toolId) {
      case 'cursor': {
        // Cursor 深度链接安装 MCP
        // config 需要 Base64 编码
        try {
          const encodedName = encodeURIComponent(serverName);
          const encodedConfig = base64Encode(JSON.stringify(serverConfig));
          const deepLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodedName}&config=${encodedConfig}`;
          console.log('Cursor deep link:', deepLink);
          console.log('Server name:', serverName);
          console.log('Server config:', JSON.stringify(serverConfig));
          console.log('Encoded config:', encodedConfig);
          window.location.href = deepLink;
          setInstallStatus(currentLanguage === 'zh' 
            ? '正在打开 Cursor 并安装 MCP 服务器...' 
            : 'Opening Cursor and installing MCP server...');
        } catch (e) {
          console.error('Cursor deep link error:', e);
          await navigator.clipboard.writeText(configStr);
          setInstallStatus(currentLanguage === 'zh' 
            ? '深度链接失败，已复制配置到剪贴板' 
            : 'Deep link failed, config copied to clipboard');
        }
        break;
      }
        
      case 'vscode': {
        // VS Code 目前不支持 MCP 深度链接，复制配置
        await navigator.clipboard.writeText(configStr);
        setInstallStatus(currentLanguage === 'zh' 
          ? '已复制配置，请粘贴到 .vscode/mcp.json 或使用 Copilot MCP 扩展' 
          : 'Config copied, please paste to .vscode/mcp.json or use Copilot MCP extension');
        break;
      }
        
      case 'windsurf': {
        // Windsurf 暂不支持深度链接，复制配置
        await navigator.clipboard.writeText(configStr);
        setInstallStatus(currentLanguage === 'zh' 
          ? '已复制配置到剪贴板，请手动粘贴到 Windsurf 的 MCP 设置中' 
          : 'Config copied to clipboard, please paste to Windsurf MCP settings manually');
        break;
      }
        
      case 'claude-desktop': {
        // Claude Desktop 深度链接安装 MCP
        try {
          const encodedConfig = base64Encode(JSON.stringify(config));
          const deepLink = `claude://mcp/install?config=${encodedConfig}`;
          window.location.href = deepLink;
          setInstallStatus(currentLanguage === 'zh' 
            ? '正在打开 Claude Desktop 并安装 MCP 服务器...' 
            : 'Opening Claude Desktop and installing MCP server...');
        } catch (e) {
          await navigator.clipboard.writeText(configStr);
          setInstallStatus(currentLanguage === 'zh' 
            ? '深度链接失败，已复制配置。Mac: ~/Library/Application Support/Claude/claude_desktop_config.json，Windows: %APPDATA%\\Claude\\claude_desktop_config.json' 
            : 'Deep link failed, config copied. Mac: ~/Library/Application Support/Claude/claude_desktop_config.json, Windows: %APPDATA%\\Claude\\claude_desktop_config.json');
        }
        break;
      }
        
      case 'cline': {
        // Cline 复制配置
        await navigator.clipboard.writeText(configStr);
        setInstallStatus(currentLanguage === 'zh' 
          ? '已复制配置，请在 Cline 设置中添加 MCP 服务器' 
          : 'Config copied, please add MCP server in Cline settings');
        break;
      }

      case 'mcp-x-desktop': {
        // MCP-X Desktop 复制配置
        await navigator.clipboard.writeText(configStr);
        setInstallStatus(currentLanguage === 'zh' 
          ? '已复制配置，请在 MCP-X Desktop 中粘贴配置' 
          : 'Config copied, please paste in MCP-X Desktop');
        break;
      }
        
      default:
        await navigator.clipboard.writeText(configStr);
        setInstallStatus(currentLanguage === 'zh' ? '已复制配置到剪贴板' : 'Config copied to clipboard');
    }

    setTimeout(() => setInstallStatus(null), 5000);
  };
  
  useEffect(() => {
    const fetchServerData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const serverData = await getServerById(id);
        
        // 打印服务器说明到控制台da
        console.log('============= 服务器说明 =============');
        console.log('服务器ID:', serverData.id);
        console.log('服务器名称:', serverData.name);
        console.log('中文名称:', serverData.chineseName);
        console.log('描述:', serverData.description);
        console.log('中文描述:', serverData.descriptionCn);
        console.log('Readme:', serverData.readme);
        console.log('中文Readme:', serverData.readmeCn);
        console.log('创建日期 createdDate:', serverData.createdDate);
        console.log('创建时间戳 gmtCreated:', serverData.gmtCreated);
        console.log('统计信息:', serverData.statistics);
        console.log('============= 服务器说明结束 =============');
        
        setServer(serverData);
        setError(null);
      } catch (err) {
        console.error(t('serverDetail.getServerDetailError'), err);
        setError(t('serverDetail.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchServerData();
  }, [id]);
  
  if (!id) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">{t('serverDetail.serverNotFound')}</h1>
        <button 
          onClick={() => {
            if (searchQ) {
              navigate(`/mcp?q=${encodeURIComponent(searchQ)}`);
            } else {
              navigate('/mcp');
            }
          }}
          className="text-orange-500 hover:text-orange-400 flex items-center"
        >
          <ArrowLeft size={16} className="mr-1" />
          {t('serverDetail.backToHome')}
        </button>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">{t('serverDetail.loading')}</h1>
      </div>
    );
  }
  
  if (error || !server) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">{error || t('serverDetail.loadFailed')}</h1>
        <button 
          onClick={() => {
            if (searchQ) {
              navigate(`/mcp?q=${encodeURIComponent(searchQ)}`);
            } else {
              navigate('/mcp');
            }
          }}
          className="text-orange-500 hover:text-orange-400 flex items-center"
        >
          <ArrowLeft size={16} className="mr-1" />
          {t('serverDetail.backToHome')}
        </button>
      </div>
    );
  }
  

  
  const copyConfigToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(server.serverConfig, null, 2));
    setIsCopiedConfig(true);
    setTimeout(() => setIsCopiedConfig(false), 2000);
  };
  
  // 格式化输入参数的JSON
  const formatSchema = (schema: any) => {
    try {
      // 如果已经是对象，直接格式化
      if (typeof schema === 'object' && schema !== null) {
        return JSON.stringify(schema, null, 2);
      }
      
      // 如果是字符串，尝试解析为JSON
      if (typeof schema === 'string') {
        try {
          const parsedSchema = JSON.parse(schema);
          return JSON.stringify(parsedSchema, null, 2);
        } catch (e) {
          // 如果不是有效的JSON字符串，直接返回原字符串
          return schema;
        }
      }
      
      // 其他情况直接返回
      return String(schema);
    } catch (e) {
      console.error('格式化schema失败:', e);
      return String(schema);
    }
  };
  
  // 处理HTML转义字符
  const unescapeHTML = (html: string): string => {
    if (!html) return '';
    
    // 移除特殊字符序列
    html = html.replace(/u003c/g, '<');
    html = html.replace(/u003e/g, '>');
    html = html.replace(/u002f/g, '/');
    html = html.replace(/u003d/g, '=');
    html = html.replace(/u0026nbsp;/g, ' ');
    
    // 预处理表格属性
    html = html.replace(/colspan="(\d+)"/g, 'colSpan="$1"');
    html = html.replace(/rowspan="(\d+)"/g, 'rowSpan="$1"');
    html = html.replace(/width="(\d+)"/g, 'width="$1"');
    
    // 处理其他HTML实体
    return html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&#39;/g, "'")
      .replace(/&#47;/g, '/');
  };
  
  // 处理复杂的HTML表格转换为React组件友好的格式
  const processRawHTML = (html: string): string => {
    if (!html) return '';
    
    // 特殊处理原始HTML表格
    let processedHtml = html;
    
    // 处理表格标签
    processedHtml = processedHtml
      .replace(/u003ctable/g, '<table')
      .replace(/u003e\/table/g, '>/table')
      .replace(/u003cthead/g, '<thead')
      .replace(/u003e\/thead/g, '>/thead')
      .replace(/u003ctbody/g, '<tbody')
      .replace(/u003e\/tbody/g, '>/tbody')
      .replace(/u003ctr/g, '<tr')
      .replace(/u003e\/tr/g, '>/tr')
      .replace(/u003cth/g, '<th')
      .replace(/u003e\/th/g, '>/th')
      .replace(/u003ctd/g, '<td')
      .replace(/u003e\/td/g, '>/td')
      .replace(/u003cspan/g, '<span')
      .replace(/u003e\/span/g, '>/span')
      .replace(/u003cp/g, '<p')
      .replace(/u003e\/p/g, '>/p');
    
    return processedHtml;
  };
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <button 
            onClick={() => {
              if (searchQ) {
                navigate(`/mcp?q=${encodeURIComponent(searchQ)}`);
              } else {
                navigate('/mcp');
              }
            }}
            className="text-gray-400 hover:text-white flex items-center mb-6 transition-colors"
          >
            <ArrowLeft size={16} className="mr-1" />
            {t('serverDetail.backToList')}
          </button>
          
          <div className="bg-gray-900 rounded-xl p-6 mb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold mr-2">
                    {currentLanguage === 'zh' 
                      ? (server.chineseName || server.nameCn || server.name) 
                      : (server.name || server.nameEn || server.chineseName || server.nameCn)
                    }
                  </h1>
                  {server.verified && <VerifiedBadge />}
                </div>
                <p className="text-gray-400 font-mono text-sm">{server.handle}</p>
              </div>
              
              <div className="flex space-x-2">
                {server.tags.map((tag, index) => (
                  <Badge key={index} type={tag} />
                ))}
              </div>
            </div>
            
            <p className="text-gray-300 text-lg mb-8">
              {currentLanguage === 'zh' 
                ? (server.descriptionCn || server.overview || server.description) 
                : (server.description || server.descriptionEn || server.overview)
              }
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">{t('serverDetail.callCount')}</h3>
                <div className="flex items-center">
                  <ZapIcon size={16} className="text-orange-500 mr-2" />
                  <span className="text-xl font-bold">{server.statistics.monthlyCalls.toLocaleString()}</span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">{t('serverDetail.license')}</h3>
                <p className="text-xl font-bold">{server.statistics.license}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">{t('serverDetail.published')}</h3>
                <p className="text-xl font-bold">{
                  (() => {
                    console.log('=== 发布日期调试 ===');
                    console.log('server.createdDate:', server.createdDate);
                    console.log('server.gmtCreated:', server.gmtCreated);
                    console.log('server.statistics.published:', server.statistics.published);
                    
                    // 优先使用 createdDate 字符串
                    if (server.createdDate) {
                      try {
                        const date = new Date(server.createdDate);
                        console.log('解析 createdDate 结果:', date);
                        console.log('是否有效:', !isNaN(date.getTime()));
                        if (!isNaN(date.getTime())) {
                          const formatted = date.toLocaleDateString(currentLanguage === 'zh' ? 'zh-CN' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });
                          console.log('格式化后:', formatted);
                          return formatted;
                        }
                      } catch (e) {
                        console.error('Failed to parse createdDate:', e);
                      }
                    }
                    
                    // 尝试使用 gmtCreated 时间戳（秒级，需要乘以1000）
                    if (server.gmtCreated) {
                      try {
                        // gmtCreated 是秒级时间戳，需要乘以 1000 转换为毫秒
                        const date = new Date(server.gmtCreated * 1000);
                        console.log('解析 gmtCreated 结果:', date);
                        console.log('是否有效:', !isNaN(date.getTime()));
                        if (!isNaN(date.getTime())) {
                          const formatted = date.toLocaleDateString(currentLanguage === 'zh' ? 'zh-CN' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          });
                          console.log('格式化后:', formatted);
                          return formatted;
                        }
                      } catch (e) {
                        console.error('Failed to parse gmtCreated:', e);
                      }
                    }
                    
                    // 回退到 statistics.published
                    console.log('使用 statistics.published:', server.statistics.published);
                    return server.statistics.published || 'N/A';
                  })()
                }</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">{t('serverDetail.security')}</h3>
                <div className="flex items-center">
                  <span className={`text-sm px-2 py-0.5 rounded-full ${
                    server.security.level === 'secure' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'
                  }`}>
                    {server.security.level === 'secure' 
                      ? t('serverDetail.secure') 
                      : server.security.level === 'moderate' 
                        ? t('serverDetail.moderate') 
                        : t('serverDetail.unknown')
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="border-b border-gray-800">
              <div className="flex">
                <button 
                  className={`px-6 py-4 font-medium text-sm flex items-center border-r border-gray-800 ${
                    activeTab === 'overview' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveTab('overview')}
                >
                  <Terminal size={16} className="mr-2" />
                  {t('serverDetail.quickStart')}
                </button>
                <button 
                  className={`px-6 py-4 font-medium text-sm flex items-center border-r border-gray-800 ${
                    activeTab === 'tools' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveTab('tools')}
                >
                  <Code2 size={16} className="mr-2" />
                  {t('serverDetail.description')}
                </button>
                <button 
                  className={`px-6 py-4 font-medium text-sm flex items-center ${
                    activeTab === 'api' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveTab('api')}
                >
                  <BookOpen size={16} className="mr-2" />
                  {t('serverDetail.api')}
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {activeTab === 'overview' && (
                <div>
                  {/* 快速安装区域 - 移到最顶部 */}
                  <div className="mb-6">
                    <div className="flex items-center space-x-2 mb-4">
                      {t('serverDetail.supportedClients')}{server.installation.platforms.map((platform) => (
                        <span
                          key={platform}
                          className={`text-sm px-3 py-1 rounded-lg bg-gray-800`}
                        >
                          {platform}
                        </span>
                      ))}
                    </div>
                    
                    {/* 配置代码块 */}
                    {server.serverConfig && (
                      <div className="mb-6">
                        <p className="text-sm text-gray-400 mb-2">
                          {t('serverDetail.installCommand')}
                        </p>
                        <div className="relative">
                          <div className="bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                            <pre className="text-gray-300 whitespace-pre-wrap">{
                              typeof server.serverConfig === 'string'
                                ? server.serverConfig.replace(/```/g, '')
                                : JSON.stringify(server.serverConfig, null, 2)
                            }</pre>
                          </div>
                          <button 
                            className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                            onClick={copyConfigToClipboard}
                          >
                            {isCopiedConfig ? (
                              <span className="text-green-500">{t('serverDetail.copied')}</span>
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* 一键安装按钮区域 */}
                    {server.serverConfig && (
                      <div className="mb-6">
                        <p className="text-sm text-gray-400 mb-3">
                          {currentLanguage === 'zh' ? '一键安装到开发工具：' : 'One-click install to:'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {devTools.map((tool) => (
                            <button
                              key={tool.id}
                              onClick={() => handleInstallToTool(tool.id)}
                              className={`px-4 py-2 border rounded-lg text-sm transition-all duration-200 ${
                                tool.supportsDeepLink 
                                  ? 'bg-orange-600 hover:bg-orange-500 border-orange-500 text-white' 
                                  : 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white'
                              }`}
                              title={tool.description}
                            >
                              {tool.name}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {currentLanguage === 'zh' 
                            ? '橙色按钮支持一键安装，灰色按钮将复制配置到剪贴板' 
                            : 'Orange buttons support one-click install, gray buttons copy config to clipboard'}
                        </p>
                        
                        {/* 安装状态提示 */}
                        {installStatus && (
                          <div className="mt-3 p-3 bg-green-900/30 border border-green-700 rounded-lg">
                            <p className="text-sm text-green-400">{installStatus}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <p className="text-sm text-yellow-500 mt-4 flex items-center">
                      <AlertTriangle size={14} className="mr-1" />
                      {t('serverDetail.securityNote')}
                    </p>
                  </div>
                  
                  {/* deployedEnvs 展示 */}
                  {server.deployedEnvs &&
                    server.deployedEnvs.trim() !== '' && 
                    server.deployedEnvs.trim().toLowerCase() !== 'null' && (
                    <div className="mb-6">
                      <div className="bg-gray-800 rounded-lg overflow-hidden">
                        <div className="p-6">
                      <article className="markdown-content prose prose-invert prose-headings:mt-5 prose-headings:mb-3 prose-p:my-3 prose-a:text-orange-500 prose-code:bg-gray-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-li:my-1 prose-table:border-collapse max-w-none">
                        <ReactMarkdown 
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                          components={{
                                pre: ({node, ...props}) => (
                                  <pre className="bg-gray-900 rounded p-3 overflow-x-auto my-4" {...props} />
                                ),
                                code: ({node, className, children, ...props}) => {
                                  // 判断是否为多行代码块
                                  let isMultiline = false;
                                  if (typeof children === 'string') {
                                    isMultiline = children.includes('\n');
                                  } else if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
                                    isMultiline = children[0].includes('\n');
                                  }
                                  if (!isMultiline) {
                                    // 行内代码
                                    return (
                                      <code className="bg-gray-900 rounded px-1 py-0.5 text-orange-400 font-mono text-sm" {...props}>
                                        {children}
                                      </code>
                                    );
                                  }
                                  // 多行代码块
                                  return (
                                    <code className="text-orange-400 font-mono text-sm" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                blockquote: ({node, ...props}) => (
                                  <blockquote 
                                    style={{
                                      borderLeft: '4px solid #f97316',
                                      backgroundColor: '#4b5563',
                                      paddingLeft: '16px',
                                      paddingTop: '8px',
                                      paddingBottom: '8px',
                                      marginTop: '16px',
                                      marginBottom: '16px',
                                      fontStyle: 'italic',
                                      color: '#d1d5db'
                                    }}
                                    {...props} 
                                  />
                                ),
                            table: ({ node, ...props }) => (
                              <div className="overflow-x-auto my-4">
                                <table className="min-w-full border border-gray-700 rounded-lg bg-gray-800" {...props} />
                              </div>
                            ),
                            thead: ({ node, ...props }) => <thead className="bg-gray-700" {...props} />, 
                            tr: ({ node, ...props }) => <tr className="border-b border-gray-700" {...props} />, 
                            th: ({ node, ...props }) => {
                              const { rowSpan = 1, colSpan = 1, ...otherProps } = props;
                              const hasSpan = rowSpan > 1 || colSpan > 1;
                              return (
                                <th 
                                  className={`px-4 py-2 font-semibold text-left text-sm text-white border-r border-gray-700 ${hasSpan ? 'bg-gray-700' : ''}`}
                                  rowSpan={rowSpan}
                                  colSpan={colSpan}
                                  {...otherProps} 
                                />
                              );
                            },
                            td: ({ node, ...props }) => {
                              const { rowSpan = 1, colSpan = 1, ...otherProps } = props;
                              const hasSpan = rowSpan > 1 || colSpan > 1;
                              return (
                                <td 
                                  className={`px-4 py-2 text-sm text-gray-300 border-r border-gray-700 ${hasSpan ? 'bg-gray-700' : ''}`}
                                  rowSpan={rowSpan}
                                  colSpan={colSpan}
                                  {...otherProps} 
                                />
                              );
                            },
                            tbody: ({ node, ...props }) => <tbody {...props} />, 
                            p: ({ node, children, ...props }) => {
                              const childrenStr = String(children);
                              if (childrenStr.includes('<table') || childrenStr.includes('u003ctable')) {
                                return <>{children}</>;
                              }
                              return <p {...props}>{children}</p>;
                            },
                            span: ({ node, ...props }) => <span className="text-gray-300" {...props} />, 
                            a: ({ node, ...props }) => <a className="text-orange-500 hover:text-orange-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />, 
                            h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-white" {...props} />, 
                            h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 text-white" {...props} />, 
                            ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-3 space-y-1 text-gray-300" {...props} />, 
                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-3 space-y-1 text-gray-300" {...props} />
                          }}
                        >
                              {processRawHTML(unescapeHTML(server.deployedEnvs))}
                        </ReactMarkdown>
                      </article>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-4">
                    <button className="text-sm text-gray-400 hover:text-white flex items-center">
                      <Bug size={16} className="mr-1" />
                      {t('serverDetail.reportIssue')}
                    </button>
                    <button className="text-sm text-gray-400 hover:text-white flex items-center">
                      <HelpCircle size={16} className="mr-1" />
                      {t('serverDetail.troubleshooting')}
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === 'tools' && (
                <div className="tools-content">
                  {server.readmeCn || server.readme ? (
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                      <div className="px-6 py-5 border-b border-gray-700">
                        <h3 className="font-medium text-xl text-white">{t('serverDetail.serverDescription')}</h3>
                      </div>
                      <div className="p-6">
                        {/* 根据当前语言选择合适的 readme 内容 */}
                        {(() => {
                          const readmeContent = currentLanguage === 'zh' 
                            ? (server.readmeCn || server.readme || '') 
                            : (server.readme || server.readmeEn || server.readmeCn || '');
                          
                          // 如果内容中包含特定的表格关键词，则使用HTML表格组件
                          return readmeContent.includes('能力介绍') || 
                                 readmeContent.includes('地理编码') ||
                                 readmeContent.includes('逆地理编码') ||
                                 readmeContent.includes('IP 定位') ||
                                 readmeContent.includes('天气查询') ? (
                            <div className="markdown-content prose prose-invert max-w-none">
                              <HtmlTable content={readmeContent} />
                            </div>
                          ) : (
                          <article className="markdown-content prose prose-invert prose-headings:mt-5 prose-headings:mb-3 prose-p:my-3 prose-a:text-orange-500 prose-code:bg-gray-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-li:my-1 prose-table:border-collapse max-w-none">
                            <ReactMarkdown 
                              rehypePlugins={[rehypeRaw, rehypeSanitize]}
                              components={{
                                pre: ({node, ...props}) => (
                                  <pre className="bg-gray-900 rounded p-3 overflow-x-auto my-4" {...props} />
                                ),
                                code: ({node, className, children, ...props}) => {
                                  // 判断是否为多行代码块
                                  let isMultiline = false;
                                  if (typeof children === 'string') {
                                    isMultiline = children.includes('\n');
                                  } else if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
                                    isMultiline = children[0].includes('\n');
                                  }
                                  if (!isMultiline) {
                                    // 行内代码
                                    return (
                                      <code className="bg-gray-900 rounded px-1 py-0.5 text-orange-400 font-mono text-sm" {...props}>
                                        {children}
                                      </code>
                                    );
                                  }
                                  // 多行代码块
                                  return (
                                    <code className="text-orange-400 font-mono text-sm" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                blockquote: ({node, ...props}) => (
                                  <blockquote 
                                    style={{
                                      borderLeft: '4px solid #f97316',
                                      backgroundColor: '#4b5563',
                                      paddingLeft: '16px',
                                      paddingTop: '8px',
                                      paddingBottom: '8px',
                                      marginTop: '16px',
                                      marginBottom: '16px',
                                      fontStyle: 'italic',
                                      color: '#d1d5db'
                                    }}
                                    {...props} 
                                  />
                                ),
                                table: ({ node, ...props }) => (
                                  <div className="overflow-x-auto my-4">
                                    <table className="min-w-full border border-gray-700 rounded-lg bg-gray-800" {...props} />
                                  </div>
                                ),
                                thead: ({ node, ...props }) => <thead className="bg-gray-700" {...props} />,
                                tr: ({ node, ...props }) => <tr className="border-b border-gray-700" {...props} />,
                                th: ({ node, ...props }) => {
                                  const { rowSpan = 1, colSpan = 1, ...otherProps } = props;
                                  const hasSpan = rowSpan > 1 || colSpan > 1;
                                  return (
                                    <th 
                                      className={`px-4 py-2 font-semibold text-left text-sm text-white border-r border-gray-700 ${hasSpan ? 'bg-gray-700' : ''}`} 
                                      rowSpan={rowSpan}
                                      colSpan={colSpan}
                                      {...otherProps} 
                                    />
                                  );
                                },
                                td: ({ node, ...props }) => {
                                  const { rowSpan = 1, colSpan = 1, ...otherProps } = props;
                                  const hasSpan = rowSpan > 1 || colSpan > 1;
                                  return (
                                    <td 
                                      className={`px-4 py-2 text-sm text-gray-300 border-r border-gray-700 ${hasSpan ? 'bg-gray-700' : ''}`} 
                                      rowSpan={rowSpan}
                                      colSpan={colSpan}
                                      {...otherProps} 
                                    />
                                  );
                                },
                                tbody: ({ node, ...props }) => <tbody {...props} />,
                                p: ({ node, children, ...props }) => {
                                  const childrenStr = String(children);
                                  if (childrenStr.includes('<table') || childrenStr.includes('u003ctable')) {
                                    return <>{children}</>;
                                  }
                                  return <p {...props}>{children}</p>;
                                },
                                span: ({ node, ...props }) => <span className="text-gray-300" {...props} />,
                                a: ({ node, ...props }) => <a className="text-orange-500 hover:text-orange-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-white" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-5 mb-3 text-white" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-3 space-y-1 text-gray-300" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-3 space-y-1 text-gray-300" {...props} />
                              }}
                            >
                             {processRawHTML(unescapeHTML(readmeContent))}
                            </ReactMarkdown>
                          </article>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-800 rounded-lg p-6">
                      <h3 className="font-medium mb-4 text-xl text-white">{t('serverDetail.serverDescription')}</h3>
                      <p className="text-gray-400 text-sm">
                        {t('serverDetail.noDescription')}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'api' && (
                <div>
                  <p className="text-gray-400 mb-6">
                    {currentLanguage === 'zh' 
                      ? (server.chineseName || server.nameCn || server.name) 
                      : (server.name || server.nameEn || server.chineseName || server.nameCn)
                    }{t('serverDetail.apiDocumentationFor')}
                  </p>
                  
                  <div className="space-y-4">
                    {server.tools && server.tools.length > 0 ? (
                      server.tools.map((tool, index) => (
                        <div key={index} className="bg-gray-800 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="bg-blue-900 text-blue-400 text-xs px-2 py-0.5 rounded mr-2">TOOL</span>
                            <code className="text-gray-300">{tool.name}</code>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{tool.description}</p>
                          {tool.inputSchema && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <p className="text-xs text-gray-500 mb-1">{t('serverDetail.inputParameters')}</p>
                              <pre className="text-xs text-gray-300 whitespace-pre-wrap bg-gray-900 p-2 rounded overflow-x-auto">
                                {formatSchema(tool.inputSchema)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="bg-gray-800 rounded-lg p-4">
                        <p className="text-sm text-gray-400">{t('serverDetail.noApiDoc')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};