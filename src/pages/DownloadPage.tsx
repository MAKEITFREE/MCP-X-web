import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Download, Terminal, Bot, Cpu, Zap, Shield, Globe, Github } from 'lucide-react';
import mcpxImg from '../components/ui/mcpx.png';
import { useLanguage } from '../contexts/LanguageContext';

export const DownloadPage: React.FC = () => {
  const { currentLanguage, t } = useLanguage();
  const [selectedPlatform, setSelectedPlatform] = useState<'windows' | 'mac' | 'linux'>('windows');
  //,
  // { id: 'linux', name: 'Linux', version: '0.0.1', size: '79.8 MB' }
  const platforms = [
    { id: 'windows', name: 'Windows', version: '0.0.4', size: '208.69 MB',
      downloadUrl: 'https://www.mcp-x.com/download/MCP-X-0.0.4-win-x64.exe'
    },
    { id: 'mac', name: 'macOS', version: '0.0.4',
      archs: [
        {
          arch: 'x64',
          label: currentLanguage === 'zh' ? 'Intel 芯片 (x64)' : 'Intel Chip (x64)',
          size: '329 MB',
          downloadUrl: 'https://www.mcp-x.com/download/MCP-X-0.0.4-mac-x64.dmg'
        },
        {
          arch: 'arm64',
          label: currentLanguage === 'zh' ? 'Apple 芯片 (arm64)' : 'Apple Chip (arm64)',
          size: '311 MB',
          downloadUrl: 'https://www.mcp-x.com/download/MCP-X-0.0.4-mac-arm64.dmg'
        }
      ] }
  ];

  const supportedModels = [
    { name: 'KIMI', version: 'K2', status: currentLanguage === 'zh' ? '稳定' : 'Stable' },
    { name: 'Deepseek', version: 'R1', status: currentLanguage === 'zh' ? '稳定' : 'Stable' },
    { name: 'QWEN 3', version: currentLanguage === 'zh' ? '最新' : 'Latest', status: currentLanguage === 'zh' ? '稳定' : 'Stable' },
    { name: 'Claude', version: '3.7', status: currentLanguage === 'zh' ? '稳定' : 'Stable' },
    { name: 'GPT-4.1', version: currentLanguage === 'zh' ? '最新' : 'Latest', status: currentLanguage === 'zh' ? '稳定' : 'Stable' },
    { name: 'Gemini2.5', version: 'Pro', status: currentLanguage === 'zh' ? '测试' : 'Testing' },
    { name: 'Mistral', version: '7B', status: currentLanguage === 'zh' ? '测试' : 'Testing' },
    { name: 'Llama 2', version: '70B', status: currentLanguage === 'zh' ? '稳定' : 'Stable' }
  ];

  const features = [
    {
      icon: <Terminal className="w-6 h-6" />,
      title: t('download.featureList.userInterface'),
      description: t('download.featureList.userInterfaceDesc')
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: t('download.featureList.multiModel'),
      description: t('download.featureList.multiModelDesc')
    },
    {
      icon: <Cpu className="w-6 h-6" />,
      title: t('download.featureList.localProcessing'),
      description: t('download.featureList.localProcessingDesc')
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: t('download.featureList.fastResponse'),
      description: t('download.featureList.fastResponseDesc')
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: t('download.featureList.openSource'),
      description: t('download.featureList.openSourceDesc')
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: t('download.featureList.serverMarket'),
      description: t('download.featureList.serverMarketDesc')
    }
  ];

  const currentPlatform = platforms.find(p => p.id === selectedPlatform);
  let downloadUrl = '';
  let size = '';
  if (selectedPlatform === 'mac' && currentPlatform && 'archs' in currentPlatform) {
    // Mac平台现在直接显示两个下载按钮，不需要默认值
    downloadUrl = '';
    size = '';
  } else {
    downloadUrl = currentPlatform?.downloadUrl || '';
    size = currentPlatform?.size || '';
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">{t('download.title')}</h1>
            <p className="text-xl text-gray-300">
              {t('download.subtitle')}
            </p>
            {/* GitHub 链接 */}
            <div className="mt-4">
                <a
                  href="https://github.com/TimeCyber/MCP-X"
                  className="inline-flex items-center text-gray-300 hover:text-white transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="w-5 h-5 mr-2" />
                  {t('download.githubSource')}
                </a>
              </div>
          </div>

          {/* 下载区域 */}
          <div className="bg-gray-900 rounded-xl p-8 mb-12">
            <div className="flex flex-wrap gap-4 mb-6">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id as any)}
                  className={`flex-1 p-4 rounded-lg border ${selectedPlatform === platform.id
                      ? 'border-orange-500 bg-gray-800'
                      : 'border-gray-700 hover:border-gray-600'
                    }`}
                >
                  <h3 className="font-medium mb-1">{platform.name}</h3>
                  <p className="text-sm text-gray-400">{t('download.version')} {platform.version}</p>
                </button>
              ))}
            </div>

            <div className="text-center">
              {selectedPlatform === 'mac' && currentPlatform && 'archs' in currentPlatform ? (
                <div className="flex justify-center gap-4">
                  {currentPlatform.archs?.map((arch: any) => (
                    <a
                      key={arch.arch}
                      href={arch.downloadUrl}
                      className="bg-orange-500 text-black font-medium rounded-lg px-6 py-3 inline-flex items-center hover:bg-orange-600 transition-colors"
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      {t('download.downloadFor')} {arch.label}
                      <span className="text-black/60 ml-2">
                        （{arch.size}）
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  href={downloadUrl || '#'}
                  className="bg-orange-500 text-black font-medium rounded-lg px-6 py-3 inline-flex items-center hover:bg-orange-600 transition-colors"
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {t('download.downloadFor')} {currentPlatform?.name} {t('download.versionSuffix')}
                  <span className="text-black/60 ml-2">
                    （{size}）
                  </span>
                </a>
              )}
              
              
              
              <p className="mt-4 text-sm text-gray-400">
                {t('download.downloadAgreement')}
              </p>
            </div>
          </div>

          {/* 支持的模型 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t('download.supportedModels')}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {supportedModels.map((model, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{model.name}</h3>
                    <p className="text-sm text-gray-400">{model.version}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${model.status === (currentLanguage === 'zh' ? '稳定' : 'Stable')
                      ? 'bg-green-900 text-green-400'
                      : 'bg-yellow-900 text-yellow-400'
                    }`}>
                    {model.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 功能特性 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t('download.features')}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-6">
                  <div className="text-orange-500 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="font-medium mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 快速开始 */}
          <section className="bg-gray-900 rounded-xl p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6">{t('download.quickStart')}</h2>
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="p-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="font-medium mb-2">1. {t('download.downloadStep')}</h3>
                  <p className="text-sm text-gray-400">{t('download.downloadStepDesc')}</p>
                </div>
                <div className="p-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Terminal className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="font-medium mb-2">2. {t('download.installStep')}</h3>
                  <p className="text-sm text-gray-400">{t('download.installStepDesc')}</p>
                </div>
                <div className="p-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="font-medium mb-2">3. {t('download.launchStep')}</h3>
                  <p className="text-sm text-gray-400">{t('download.launchStepDesc')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Client Screenshot */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t('download.clientInterface')}</h2>
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <img
                src={mcpxImg}
                alt="MCP-X Client"
                className="w-full h-auto"
              />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};