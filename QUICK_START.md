# ⚡ Vercel快速部署指南

## 🚀 5分钟快速部署

### 第一步：准备代码
```bash
# 1. 确保已修复安全问题 (已完成✅)
# 2. 已创建Vercel配置文件 (已完成✅)
# 3. 已调整构建脚本 (已完成✅)

# 4. 提交代码到Git
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### 第二步：部署API服务
1. 访问 [vercel.com](https://vercel.com)
2. 用GitHub登录
3. 点击 **"New Project"**
4. 选择你的GitHub仓库
5. 选择 `aliyun-api` 文件夹
6. 设置环境变量：
   ```
   QWEN_API_KEY=sk-your-api-key
   DOUBAO_APP_KEY=your-app-key
   DOUBAO_ACCESS_KEY=your-access-key
   NEXTAUTH_SECRET=your-secret
   ```
7. 点击 **"Deploy"**

### 第三步：部署前端
1. 再次点击 **"New Project"**
2. 选择同一仓库
3. 选择 `qwen3-asr-studio` 文件夹
4. 点击 **"Deploy"**

## ✅ 部署完成！

你的应用现在运行在：
- **API**: `https://your-api-name.vercel.app`
- **前端**: `https://your-frontend-name.vercel.app`

## 🔧 如需帮助

查看详细文档：
- [完整部署指南](./VERCEL_DEPLOYMENT_GUIDE.md)
- [环境变量配置](./ENV_SETUP.md)
- [安全注意事项](./SECURITY_CHECKLIST.md)

## 💡 提示

- 首次部署可能需要2-3分钟
- 记得在Vercel中设置所有必需的环境变量
- 免费额度对个人使用完全足够