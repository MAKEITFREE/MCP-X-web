# MCP-X API 接口文档

本文档详细描述了 MCP-X 平台的所有后端 API 接口。

## 目录

1. [认证相关](#1-认证相关)
2. [用户相关](#2-用户相关)
3. [AI 对话](#3-ai-对话)
4. [MCP 服务](#4-mcp-服务)
5. [Agent 市场](#5-agent-市场)
6. [图像生成](#6-图像生成)
7. [视频生成](#7-视频生成)
8. [应用构建](#8-应用构建)
9. [知识库](#9-知识库)
10. [支付系统](#10-支付系统)
11. [其他接口](#11-其他接口)

---

## 通用说明

### 基础 URL
```
{API_BASE_URL}
```

### 认证方式
大部分接口需要在请求头中携带 Bearer Token：
```
Authorization: Bearer {token}
```

### 响应格式
```json
{
  "code": 200,
  "msg": "操作成功",
  "data": {}
}
```

### 错误码说明
| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 401 | 认证失败/Token 过期 |
| 403 | 权限不足 |
| 500 | 服务器错误 |

---

## 1. 认证相关

### 1.1 用户登录
```
POST /auth/login
```

**请求参数**
```json
{
  "username": "string",  // 用户名/邮箱
  "password": "string"   // 密码
}
```

**响应**
```json
{
  "code": 200,
  "data": {
    "access_token": "string",
    "token": "string",
    "userInfo": {
      "userId": "string",
      "username": "string",
      "nickName": "string",
      "avatar": "string",
      "tenantId": "string",
      "userType": "string"
    }
  }
}
```

### 1.2 用户注册
```
POST /auth/register
```

**请求参数**
```json
{
  "username": "string",  // 邮箱
  "password": "string",  // 密码
  "code": "string"       // 邮箱验证码
}
```

### 1.3 发送邮箱验证码
```
POST /resource/email/code
```

**请求参数**
```json
{
  "username": "string"  // 邮箱地址
}
```

### 1.4 GitHub OAuth 登录
```
POST /web/auth/github/login
```

**请求参数**
```json
{
  "code": "string"  // GitHub OAuth 授权码
}
```

### 1.5 验证 Token
```
GET /web/feedback/my
```

**说明**：通过获取用户反馈记录来验证 Token 有效性

---

## 2. 用户相关

### 2.1 用户 MCP 配置

#### 新增配置
```
POST /user/userMcpServer
```

#### 更新配置
```
PUT /user/userMcpServer
```

#### 获取配置列表
```
GET /user/userMcpServer/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| pageNum | number | 页码，默认 1 |
| pageSize | number | 每页数量，默认 20 |

#### 删除配置
```
DELETE /user/userMcpServer/{ids}
```

#### 启动 MCP 服务
```
POST /user/userMcpServer/start/{ids}
```

---

## 3. AI 对话

### 3.1 发送消息（流式）
```
POST /chat/send
```

**请求参数**
```json
{
  "messages": [
    {
      "role": "user|assistant|system",
      "content": "string"
    }
  ],
  "model": "string",           // 模型名称
  "stream": true,              // 是否流式
  "userId": "number",          // 用户ID
  "sessionId": "string",       // 会话ID
  "appId": "string",           // 应用ID（可选）
  "sysPrompt": "string",       // 系统提示词（可选）
  "isMcp": false,              // 是否启用MCP
  "mcpConfig": {},             // MCP配置（可选）
  "internet": false,           // 是否启用网络搜索
  "deepResearch": false,       // 是否深度研究
  "kid": "string",             // 知识库ID（可选）
  "agent": "string"            // Agent名称（可选）
}
```

**响应格式（SSE）**
```
data: {"choices":[{"delta":{"content":"响应内容"}}]}
data: [DONE]
```

### 3.2 带文件发送消息
```
POST /chat/send-with-files
Content-Type: multipart/form-data
```

**表单参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| file | File[] | 文件列表 |
| messages | string | JSON 格式的消息数组 |
| model | string | 模型名称 |
| stream | string | "true" |
| userId | string | 用户ID |
| sessionId | string | 会话ID |

### 3.3 会话管理

#### 创建会话
```
POST /system/session
```

**请求参数**
```json
{
  "userId": "string",
  "sessionContent": "string",
  "sessionTitle": "string",
  "remark": "string",
  "appId": "string"
}
```

#### 获取会话列表
```
GET /system/session/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| userId | string | 用户ID |
| appId | string | 应用ID（可选） |
| isDelete | number | 是否删除，默认 0 |

#### 删除会话
```
DELETE /web/session/{sessionId}
```

#### 更新会话
```
PUT /system/session
```

#### 更新会话内容
```
PUT /web/session/content
```

**请求参数**
```json
{
  "id": "string",
  "content": "string",
  "sessionTitle": "string"
}
```

### 3.4 获取聊天记录
```
GET /system/message/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| sessionId | string | 会话ID |
| userId | string | 用户ID |

### 3.5 获取模型列表
```
GET /system/model/modelList
```

**响应**
```json
{
  "code": 200,
  "data": [
    {
      "id": "string",
      "category": "chat|text2image|text2video|deepseek|qianwen",
      "modelName": "string",
      "modelDescribe": "string",
      "modelPrice": 0,
      "modelType": "1|2",
      "remark": "string"
    }
  ]
}
```

---

## 4. MCP 服务

### 4.1 获取服务列表
```
GET /web/mcp/server/list
```

### 4.2 获取服务详情
```
GET /web/mcp/server/detail/{id}
```

**响应**
```json
{
  "code": 200,
  "data": {
    "id": "string",
    "name": "string",
    "chineseName": "string",
    "handle": "string",
    "descriptionEn": "string",
    "descriptionCn": "string",
    "category": "string",
    "usageCount": 0,
    "verified": false,
    "isNew": false,
    "serverdetailVo": {
      "toolList": [],
      "envSchema": "string",
      "serverConfig": "string",
      "readme": "string",
      "readmeCn": "string"
    }
  }
}
```

### 4.3 获取首页服务
```
GET /web/mcp/home/server
```

### 4.4 获取分类列表
```
GET /web/mcp/home/category
```

### 4.5 搜索服务
```
GET /web/mcp/search
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 搜索关键词 |

### 4.6 添加服务
```
POST /web/mcp/member/addserver
```

**请求参数**
```json
{
  "name": "string",
  "handle": "string",
  "description": "string",
  "documentation": "string"
}
```

---

## 5. Agent 市场

### 5.1 获取分类列表
```
GET /web/agent/categories
```

### 5.2 获取 Agent 列表
```
GET /web/agent/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| pageNum | number | 页码 |
| pageSize | number | 每页数量 |
| categoryId | number | 分类ID（可选） |
| status | number | 状态，默认 1 |

### 5.3 获取 Agent 详情
```
GET /web/agent/detail/{id}
```

### 5.4 搜索 Agent
```
GET /web/agent/search
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | 搜索关键词 |
| pageNum | number | 页码 |
| pageSize | number | 每页数量 |

### 5.5 获取精选 Agent
```
GET /web/agent/featured
```

### 5.6 获取最新 Agent
```
GET /web/agent/recent
```

### 5.7 按分类获取 Agent
```
GET /web/agent/category/{categoryId}
```

### 5.8 记录 Agent 活动
```
GET /web/agent/activity/{id}
```

---

## 6. 图像生成

### 6.1 文生图
```
POST /ai/image/generate
```

**请求参数**
```json
{
  "prompt": "string",           // 提示词
  "userId": "string",           // 用户ID
  "model": "z-image-turbo",     // 模型名称
  "appId": "mcpx-text2image",   // 应用ID
  "sessionId": "string",        // 会话ID（可选）
  "size": "1024*1024",          // 图片尺寸（可选）
  "watermark": false            // 是否添加水印
}
```

**响应**
```json
{
  "code": 200,
  "data": {
    "imageUrl": "string",
    "imageBase64": "string"
  }
}
```

### 6.2 图生图/图像编辑
```
POST /ai/image/edit
```

**请求参数**
```json
{
  "userId": "string",
  "prompt": "string",
  "images": [
    {
      "data": "base64字符串",
      "mimeType": "image/png"
    }
  ],
  "model": "flux-dev",
  "appId": "mcpx-text2image",
  "sessionId": "string",
  "size": "1024*1024",
  "mask": {
    "data": "base64字符串",
    "mimeType": "image/png"
  }
}
```

---

## 7. 视频生成

### 7.1 生成视频
```
POST /ai/video/generate
Content-Type: application/json
Accept: text/event-stream
```

**请求参数**
```json
{
  "model": "kling-v1.6-standard",  // 视频模型
  "userId": "number",              // 用户ID
  "sessionId": "number",           // 会话ID
  "prompt": "string",              // 视频描述
  "duration": 5,                   // 时长（秒）
  "aspectRatio": "16:9",           // 宽高比
  "imageUrl": "string",            // 起始帧图片URL（可选）
  "tailImageUrl": "string",        // 结束帧图片URL（可选）
  "resolution": "1080p",           // 分辨率（可选）
  "audioUrl": "string",            // 音频URL（可选）
  "audioData": "base64",           // 音频数据（可选）
  "seed": "number"                 // 随机种子（可选）
}
```

**三种生成模式**
1. **文生视频**：仅提供 prompt
2. **图生视频**：提供 prompt + imageUrl
3. **首尾帧生成**：提供 prompt + imageUrl + tailImageUrl

**响应格式（SSE）**
```
data: {"choices":[{"delta":{"content":"{\"status\":\"processing\",\"progress\":30}"}}]}
data: {"choices":[{"delta":{"content":"{\"videoUrl\":\"https://...\"}"}}]}
data: [DONE]
```

### 7.2 上传文件到 OSS
```
POST /public/oss/upload
Content-Type: multipart/form-data
```

**表单参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| file | File | 要上传的文件 |

**响应**
```json
{
  "code": 200,
  "data": {
    "url": "string",
    "fileName": "string",
    "ossId": "string"
  }
}
```

---

## 8. 应用构建

### 8.1 创建应用
```
POST /app/webgen/add
```

**请求参数**
```json
{
  "appName": "string",
  "message": "string",
  "initPrompt": "string",
  "codeGenType": "HTML|REACT|VUE|STATIC",
  "userId": "string"
}
```

### 8.2 获取应用信息
```
GET /app/webgen/{appId}
```

### 8.3 获取应用列表
```
GET /app/webgen/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| pageNum | number | 页码 |
| pageSize | number | 每页数量 |
| appName | string | 应用名称（可选） |
| isDelete | number | 是否删除 |

### 8.4 对话生成代码（流式）
```
GET /app/webgen/chat/gen/code
Accept: text/event-stream
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| appId | string | 应用ID |
| message | string | 用户消息 |
| stream | string | "true" |

**响应格式（SSE）**
```
data: {"d": "生成的代码内容"}
data: [DONE]
```

### 8.5 获取聊天历史
```
GET /app/webgen/chat/history
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| appId | string | 应用ID |
| pageSize | number | 每页数量 |
| lastCreateTime | string | 最后创建时间 |

### 8.6 部署应用
```
POST /app/webgen/deploy
Content-Type: application/json
```

**请求体**
```
"appId"  // 直接传递应用ID字符串
```

### 8.7 下载代码
```
GET /app/webgen/download/{appId}
```

**响应**：Blob 文件

### 8.8 删除应用
```
POST /app/webgen/delete
```

**请求参数**
```json
{
  "id": "string"
}
```

### 8.9 更新应用
```
POST /app/webgen/update
```

**请求参数**
```json
{
  "id": "string",
  "appName": "string",
  "cover": "string",
  "priority": 0
}
```

---

## 9. 知识库

### 9.1 获取知识库列表
```
GET /knowledge/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| pageNum | number | 页码 |
| pageSize | number | 每页数量 |

### 9.2 新增知识库
```
POST /knowledge/save
```

### 9.3 编辑知识库
```
POST /knowledge/edit
```

### 9.4 删除知识库
```
POST /knowledge/remove/{id}
```

### 9.5 获取知识库附件
```
GET /knowledge/detail/{id}
```

### 9.6 上传附件
```
POST /knowledge/attach/upload
Content-Type: multipart/form-data
```

**表单参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| file | File | 文件 |
| kid | string | 知识库ID |

### 9.7 删除附件
```
POST /knowledge/attach/remove/{kid}
```

### 9.8 获取知识片段
```
GET /knowledge/fragment/list/{docId}
```

### 9.9 文件翻译
```
POST /knowledge/translationByFile
Content-Type: multipart/form-data
```

**表单参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| file | File | 文件 |
| targetLanguage | string | 目标语言 |

---

## 10. 支付系统

### 10.1 获取 VIP 套餐
```
GET /web/package/vip
```

### 10.2 创建微信支付订单
```
POST /web/pay/wechat/create
```

**请求参数**
```json
{
  "planId": "number"
}
```

### 10.3 继续微信支付
```
POST /web/pay/wechat/continue
```

**请求参数**
```json
{
  "orderNo": "string"
}
```

### 10.4 查询订单详情
```
GET /web/pay/order/detail/{orderNo}
```

### 10.5 获取订单列表
```
GET /web/pay/order/list
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| pageNum | number | 页码 |
| pageSize | number | 每页数量 |

### 10.6 获取余额和套餐信息
```
GET /web/pay/me/balance-plan
```

---

## 11. 其他接口

### 11.1 提交反馈
```
POST /web/feedback/submit
```

**请求参数**
```json
{
  "contactInfo": "string",
  "contributionDescription": "string",
  "detailedDescription": "string",
  "feedbackType": "number",
  "githubForkUrl": "string",
  "issueType": "string",
  "releaseUrl": "string"
}
```

### 11.2 获取我的反馈
```
GET /web/feedback/my
```

### 11.3 联系我们
```
POST /web/contact
```

**请求参数**
```json
{
  "name": "string",
  "email": "string",
  "subject": "string",
  "message": "string"
}
```

### 11.4 获取 AI 查询结果（参考链接）
```
GET /web/ai-query/results/{queryId}/page
```

**查询参数**
| 参数 | 类型 | 说明 |
|------|------|------|
| pageNum | number | 页码 |
| pageSize | number | 每页数量 |

---

## 附录

### A. 支持的视频模型
| 模型名称 | 说明 |
|----------|------|
| kling-v1.6-standard | 可灵标准版 |
| kling-v1.6-pro | 可灵专业版 |
| runway-gen3 | Runway Gen-3 |
| pika-v1 | Pika Labs |

### B. 支持的图像模型
| 模型名称 | 说明 |
|----------|------|
| z-image-turbo | 快速图像生成 |
| flux-dev | Flux 开发版 |

### C. 支持的文字模型分类
| 分类 | 说明 |
|------|------|
| chat | 通用对话模型 |
| deepseek | DeepSeek 系列 |
| qianwen | 通义千问系列 |

### D. 视频分辨率选项
- 480p
- 720p
- 1080p

### E. 视频宽高比选项
- 16:9（横屏）
- 9:16（竖屏）
- 1:1（方形）

---

**文档版本**：1.0.0  
**更新时间**：2026-02-09
