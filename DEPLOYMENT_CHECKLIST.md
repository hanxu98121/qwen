# ✅ 部署前检查清单

## 🔒 安全检查

- [x] 已移除硬编码的API密钥 (`aliyun-api/src/app/page.tsx`)
- [x] 创建了 `.env.example` 文件
- [x] 确保 `.gitignore` 包含 `.env*` 文件
- [x] 检查代码中是否有其他敏感信息泄露

## 📁 项目配置检查

- [x] `aliyun-api/vercel.json` 配置文件已创建
- [x] `qwen3-asr-studio/vercel.json` 配置文件已创建
- [x] `aliyun-api/next.config.ts` 已针对Vercel优化
- [x] `package.json` 构建脚本已调整
- [x] 添加了 `postinstall` 脚本用于Prisma生成

## 🌐 API功能检查

- [x] API路由正确配置
- [x] CORS设置正确
- [x] 环境变量引用正确
- [x] 错误处理完善

## 🔧 构建测试

在部署前，请运行以下测试：

```bash
# 测试aliyun-api构建
cd aliyun-api
npm install
npm run build

# 测试前端构建
cd ../qwen3-asr-studio
npm install
npm run build
```

## 📋 部署准备清单

### 环境变量准备
- [ ] 阿里云Qwen API Key
- [ ] 豆包App Key和Access Key
- [ ] NextAuth Secret
- [ ] 数据库URL (可选)

### GitHub仓库准备
- [ ] 代码已提交到GitHub
- [ ] README文件已更新
- [ ] License文件已添加
- [ ] Contributing指南已创建 (可选)

### Vercel账号准备
- [ ] Vercel账号已创建
- [ ] GitHub已连接到Vercel
- [ ] 支付方式已设置 (即使使用免费版)

## 🚀 部署顺序

1. **部署API服务** (`aliyun-api`)
2. **配置环境变量**
3. **测试API功能**
4. **部署前端应用** (`qwen3-asr-studio`)
5. **配置前端API连接**
6. **端到端测试**

## 📊 部署后验证

### 功能测试
- [ ] 主页可以正常访问
- [ ] API文档页面正常显示
- [ ] 音频上传功能正常
- [ ] 转录功能正常工作
- [ ] 错误处理正常

### 性能检查
- [ ] 页面加载速度正常
- [ ] API响应时间合理
- [ ] 内存使用正常
- [ ] 错误率正常

## 🔄 常见问题排查

如果部署失败，请检查：

1. **构建失败**
   - 检查 `package.json` 脚本是否正确
   - 确认所有依赖都已安装
   - 检查TypeScript配置

2. **API调用失败**
   - 环境变量是否正确设置
   - API密钥是否有效
   - 网络连接是否正常

3. **前端无法访问API**
   - CORS配置是否正确
   - API URL是否正确
   - 域名是否正确配置

## 📞 技术支持

如果遇到问题，可以：
1. 查看 [Vercel文档](https://vercel.com/docs)
2. 检查项目日志
3. 提交GitHub Issue
4. 联系技术支持

---

## 🎉 完成部署！

恭喜！如果所有检查项都已完成，你的项目已经准备好部署到Vercel了！

记住：**永远不要在代码中硬编码敏感信息！** 🚀