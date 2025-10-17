# 豆包API集成说明

本文档说明如何使用集成到Qwen3-ASR-Studio中的字节跳动豆包语音识别API。

## 🎯 功能特点

- **双API支持**: 同时支持阿里云通义千问和字节跳动豆包
- **实时流式识别**: 基于WebSocket的低延迟语音转录
- **统一界面**: 两个API使用相同的用户界面
- **自动切换**: 根据选择的API提供商自动调用相应的服务

## 🚀 快速开始

### 1. 获取豆包API密钥

1. 访问[字节跳动火山引擎控制台](https://console.volcengine.com/)
2. 创建语音识别应用
3. 获取以下信息：
   - **App Key**: 应用标识
   - **Access Key**: 访问密钥

### 2. 配置应用

1. 启动应用：
   ```bash
   cd aliyun-api
   npm run dev
   ```

2. 在浏览器中访问 `http://localhost:3000`

3. 在API配置部分：
   - 选择"字节跳动豆包"作为API提供商
   - 输入您的App Key和Access Key

### 3. 使用豆包API

#### 方式一：批量转录
1. 上传音频文件或输入音频URL
2. 配置识别参数（可选）
3. 点击"开始转录"

#### 方式二：实时流式转录
1. 启用"启用流式输出"选项
2. 上传音频文件
3. 点击"开始豆包流式转录"
4. 实时查看转录结果

## 📋 支持的音频格式

- **输入格式**: WAV, MP3, M4A, FLAC, AAC, AMR, AVI, AIFF, FLV, MKV, MPEG, OGG, OPUS, WebM, WMA, WMV
- **目标格式**: 自动转换为WAV (16kHz, 单声道, 16位)
- **文件大小**: 最大10MB
- **音频时长**: 建议不超过3分钟

## ⚙️ 配置选项

### 基础配置
- **上下文增强**: 输入相关词汇提高识别准确率
- **识别语言**: 支持中文、英文、日语、韩语等多种语言
- **逆文本规范化**: 将口语化数字转换为书面格式

### 高级选项
- **标点符号**: 自动添加标点符号
- **分段输出**: 按语义分段返回结果
- **置信度**: 提供识别结果的置信度分数

## 🔧 API端点

### 批量转录
```
POST /api/doubao/transcribe
Content-Type: multipart/form-data

参数:
- appKey: 豆包App Key
- accessKey: 豆包Access Key
- audio: 音频文件
- context: 上下文文本（可选）
- enableItn: 是否启用ITN（可选）
- language: 识别语言（可选）
```

### 流式转录
```
POST /api/doubao/stream
Content-Type: multipart/form-data

参数:
- appKey: 豆包App Key
- accessKey: 豆包Access Key
- audio: 音频文件
- context: 上下文文本（可选）
- enableItn: 是否启用ITN（可选）
- language: 识别语言（可选）

返回: Server-Sent Events (SSE) 流
```

## 📊 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "text": "转录后的文本内容",
    "language": "zh",
    "confidence": 0.95,
    "provider": "doubao"
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误描述",
  "details": "详细错误信息",
  "provider": "doubao"
}
```

## 🛠️ 技术实现

### 核心组件
- **doubao-protocol.ts**: 豆包二进制协议实现
- **doubao-client.ts**: WebSocket客户端封装
- **doubao-utils.ts**: 音频处理工具函数
- **APISelector.tsx**: API选择器组件
- **DoubaoStreamingTranscription.tsx**: 豆包流式转录组件

### 协议特性
- **二进制协议**: 基于豆包SAUC协议
- **GZIP压缩**: 减少网络传输数据量
- **序列化管理**: 支持音频分片传输
- **错误处理**: 完善的错误处理和重连机制

## 🔍 故障排除

### 常见问题

**1. 连接失败**
- 检查网络连接是否正常
- 确认App Key和Access Key是否正确
- 验证防火墙是否阻止WebSocket连接

**2. 音频格式不支持**
- 确保音频文件格式在支持列表中
- 检查文件大小是否超过10MB限制
- 验证音频文件是否损坏

**3. 识别结果不准确**
- 尝试添加上下文信息
- 使用高质量的音频文件
- 选择正确的识别语言

### 调试模式

启用调试模式查看详细日志：
```bash
DEBUG=doubao:* npm run dev
```

## 📈 性能优化

- **音频压缩**: 自动压缩音频文件减少传输时间
- **并发处理**: 支持多个并发转录请求
- **缓存机制**: 避免重复处理相同音频文件
- **连接池**: 复用WebSocket连接提高效率

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进豆包API集成：

1. Fork本项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。