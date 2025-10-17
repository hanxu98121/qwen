# 📝 环境变量配置指南

## 🚀 必需的环境变量

### 1. 阿里云通义千问配置
```bash
QWEN_API_KEY=sk-your-actual-api-key-here
```
**获取方式：**
1. 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/)
2. 注册并登录账号
3. 在控制台 -> API密钥管理中创建新密钥
4. 复制API Key，格式通常为 `sk-xxxxxxxx`

### 2. 字节跳动豆包配置
```bash
DOUBAO_APP_KEY=your-actual-app-key-here
DOUBAO_ACCESS_KEY=your-actual-access-key-here
```
**获取方式：**
1. 访问 [字节跳动火山引擎](https://console.volcengine.com/)
2. 注册并登录账号
3. 开通语音技术服务
4. 在应用管理中创建应用
5. 获取App Key和Access Key

### 3. 数据库配置 (可选)
```bash
DATABASE_URL=postgresql://user:password@host:port/database
```
**推荐免费数据库：**
- **Supabase**: [supabase.com](https://supabase.com) (推荐)
  - 创建新项目
  - 在设置 -> 数据库中获取连接字符串
- **PlanetScale**: [planetscale.com](https://planetscale.com)
  - 创建数据库
  - 获取连接URL

### 4. NextAuth密钥
```bash
NEXTAUTH_SECRET=your-random-secret-string
```
**生成方式：**
```bash
# 在终端运行生成随机密钥
openssl rand -base64 32
# 或者访问 https://generate-secret.vercel.app/32
```

## 🔧 Vercel部署环境变量设置

### 步骤1：在Vercel中设置环境变量
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 **Settings** → **Environment Variables**
4. 添加上述所有必需的环境变量

### 步骤2：配置环境变量
```
# Vercel环境变量名称
QWEN_API_KEY
DOUBAO_APP_KEY
DOUBAO_ACCESS_KEY
DATABASE_URL
NEXTAUTH_SECRET
NODE_ENV=production
```

## 🌍 环境区分

### Development (.env.local)
```bash
QWEN_API_KEY=sk-dev-key-here
NODE_ENV=development
```

### Production (Vercel)
```bash
QWEN_API_KEY=sk-production-key-here
NODE_ENV=production
```

## ⚠️ 安全注意事项

### ✅ 正确做法
- ✅ 在Vercel中设置环境变量
- ✅ 使用`.env.example`作为模板
- ✅ 绝不提交`.env`文件到Git
- ✅ 定期轮换API密钥

### ❌ 错误做法
- ❌ 在代码中硬编码密钥
- ❌ 提交`.env`文件到版本控制
- ❌ 在前端代码中暴露密钥
- ❌ 使用不安全的默认值

## 🔍 验证配置

### 检查环境变量是否正确设置
```bash
# 在项目根目录运行
npm run build
```

如果构建成功且没有相关错误，说明环境变量配置正确。

### 测试API连接
1. 部署后访问应用
2. 在API配置页面输入你的密钥
3. 上传音频文件测试转录功能

## 🛠️ 故障排除

### 常见问题及解决方案

**问题1：构建失败**
```
Error: API key is missing
```
**解决方案：** 检查Vercel环境变量是否正确设置

**问题2：API调用失败**
```
Error: Invalid credentials
```
**解决方案：** 验证API密钥是否正确，是否有足够的权限

**问题3：数据库连接失败**
```
Error: Database connection failed
```
**解决方案：** 检查数据库URL格式是否正确，数据库是否可访问

## 📚 相关文档

- [Vercel环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js环境变量](https://nextjs.org/docs/basic-features/environment-variables)
- [Supabase快速开始](https://supabase.com/docs/guides/getting-started)