# 🚀 Vercel部署完整指南

## 📋 部署概览

本指南将帮助你将Qwen3-ASR-Studio项目部署到Vercel，包括前端应用和API服务。

### 🏗️ 项目结构
```
Qwen3-ASR-Studio1/
├── aliyun-api/           # Next.js API服务 (主要部署目标)
├── qwen3-asr-studio/     # React前端应用
├── modelscope-api/       # 另一个API服务 (可选)
├── sauc_python/          # Python组件 (可选)
└── .env.example          # 环境变量模板
```

## 🎯 部署策略

### 推荐方案：分离部署
1. **aliyun-api** → Vercel (主要API服务)
2. **qwen3-asr-studio** → Vercel (静态前端)

## 📝 部署步骤

### 步骤1：准备GitHub仓库

#### 1.1 初始化Git仓库
```bash
# 在项目根目录
git init
git add .
git commit -m "Initial commit: Ready for Vercel deployment"
```

#### 1.2 创建GitHub仓库
1. 访问 [GitHub](https://github.com)
2. 创建新仓库：`Qwen3-ASR-Studio`
3. 推送代码到GitHub

```bash
git remote add origin https://github.com/yourusername/Qwen3-ASR-Studio.git
git branch -M main
git push -u origin main
```

### 步骤2：配置Vercel

#### 2.1 注册Vercel账号
1. 访问 [Vercel](https://vercel.com)
2. 使用GitHub账号登录
3. 完成邮箱验证

#### 2.2 导入项目

**部署aliyun-api (API服务)**
1. 点击 **"Add New..."** → **"Project"**
2. 选择GitHub仓库
3. 导入 `aliyun-api` 文件夹
4. 配置项目设置：

```
Project Name: qwen-asr-api
Framework Preset: Next.js
Root Directory: ./aliyun-api
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

#### 2.3 设置环境变量

在Vercel项目设置中添加以下环境变量：

```bash
# 必需变量
QWEN_API_KEY=sk-your-actual-api-key
DOUBAO_APP_KEY=your-doubao-app-key
DOUBAO_ACCESS_KEY=your-doubao-access-key
NEXTAUTH_SECRET=your-random-secret
NODE_ENV=production

# 可选变量
DATABASE_URL=your-database-url
```

#### 2.4 部署
点击 **"Deploy"** 按钮，等待部署完成。

### 步骤3：部署前端应用

#### 3.1 新建项目
1. 在Vercel Dashboard点击 **"Add New..."** → **"Project"**
2. 选择同一仓库
3. 导入 `qwen3-asr-studio` 文件夹

#### 3.2 配置前端项目
```
Project Name: qwen-asr-frontend
Framework Preset: Vite
Root Directory: ./qwen3-asr-studio
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

#### 3.3 配置API连接
在Vercel环境变量中设置：
```bash
VITE_API_URL=https://your-api-domain.vercel.app
```

#### 3.4 部署前端
点击 **"Deploy"** 按钮。

## 🔧 高级配置

### 自定义域名

#### 配置步骤
1. 在项目设置中点击 **"Domains"**
2. 添加你的域名，如 `api.yourdomain.com`
3. 配置DNS记录：
```
Type: CNAME
Name: api
Value: cname.vercel-dns.com
```

### SSL证书
Vercel自动提供免费SSL证书，无需手动配置。

## 📊 部署监控

### 检查部署状态
1. 访问Vercel Dashboard
2. 查看项目状态和日志
3. 监控函数执行时间

### 性能优化
- 启用Vercel Analytics
- 配置CDN缓存
- 优化图片和静态资源

## 🛠️ 故障排除

### 常见问题

#### 问题1：构建失败
**症状：** `Build failed` 错误
**解决方案：**
```bash
# 检查本地构建
cd aliyun-api
npm run build

# 检查依赖版本
npm ls

# 清理缓存
rm -rf .next node_modules
npm install
npm run build
```

#### 问题2：API调用失败
**症状：** `500 Internal Server Error`
**解决方案：**
1. 检查环境变量设置
2. 验证API密钥有效性
3. 查看Vercel函数日志

#### 问题3：CORS错误
**症状：** `CORS policy error`
**解决方案：**
检查Next.js配置中的CORS设置：
```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' }
      ]
    }
  ];
}
```

#### 问题4：内存超限
**症状：** `Function exceeded memory limit`
**解决方案：**
1. 优化代码，减少内存使用
2. 升级Vercel套餐
3. 分解大型函数

### 调试技巧

#### 本地测试
```bash
# 使用Vercel CLI本地测试
npm i -g vercel
cd aliyun-api
vercel dev
```

#### 查看日志
```bash
# 实时查看函数日志
vercel logs --follow
```

## 📈 扩展部署

### 多环境部署

#### 开发环境
- 自动部署到 `*.vercel.app` 域名
- 连接开发数据库

#### 生产环境
- 自定义域名
- 连接生产数据库
- 启用监控和告警

### CI/CD集成

#### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 💰 成本分析

### Vercel免费额度
- **带宽**: 100GB/月
- **函数调用**: 100,000次/月
- **构建时间**: 6,000分钟/月
- **并发执行**: 1个函数

### 升级建议
- **Hobby**: $20/月 - 适合个人项目
- **Pro**: $100/月 - 适合商业应用

## 🔗 有用链接

- [Vercel文档](https://vercel.com/docs)
- [Next.js部署指南](https://nextjs.org/docs/deployment)
- [环境变量配置](./ENV_SETUP.md)
- [项目仓库](https://github.com/yourusername/Qwen3-ASR-Studio)

## 🎉 部署完成

恭喜！你的Qwen3-ASR-Studio现在已经成功部署到Vercel了。

### 下一步
1. 测试所有API功能
2. 配置监控和告警
3. 设置自动备份
4. 优化性能和用户体验

### 技术支持
如果遇到问题，可以：
1. 查看 [Vercel文档](https://vercel.com/docs)
2. 提交 [GitHub Issue](https://github.com/yourusername/Qwen3-ASR-Studio/issues)
3. 联系技术支持