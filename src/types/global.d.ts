declare module 'jsencrypt/bin/jsencrypt.min' {
  export default class JSEncrypt {
    constructor();
    setPublicKey(key: string): void;
    setPrivateKey(key: string): void;
    encrypt(text: string): string | false;
    decrypt(text: string): string | false;
  }
}

// 添加SpeechRecognition类型声明
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    /**
     * 本地 LangChain 探测桥接（由桌面端/扩展/本地代理注入）
     * 返回 { ok: boolean; tools?: any[]; message?: string }
     */
    mcpLangchain?: {
      probe: (serviceConfig: any) => Promise<{ ok: boolean; tools?: any[]; message?: string }>;
      listTools?: (serviceConfig: any) => Promise<{ ok: boolean; tools?: any[]; message?: string }>;
      execute?: (params: { serviceConfig: any; tool: string; args?: any }) => Promise<{ ok: boolean; result?: any; message?: string }>;
    };
  }
}