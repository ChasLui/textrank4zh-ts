# GitHub Pages 在线演示设置指南

本文档说明如何启用 GitHub Pages 并部署在线演示。

## 🚀 自动部署已配置完成

✅ **GitHub Actions 工作流**: 已创建 `.github/workflows/deploy-pages.yml`  
✅ **在线演示页面**: 已创建完整的演示中心和各种示例  
✅ **构建优化**: 自动构建并使用实际的库文件  
✅ **多格式支持**: 支持各种模块格式和集成方式  

## 📋 手动设置步骤

由于 GitHub Pages 需要手动启用，请按以下步骤操作：

### 1. 启用 GitHub Pages

1. 前往 GitHub 仓库页面
2. 点击 **Settings** 标签页
3. 在左侧菜单中找到 **Pages** 
4. 在 **Source** 部分选择 **GitHub Actions**
5. 点击 **Save** 保存设置

### 2. 确认部署权限

GitHub Actions 需要部署权限：

1. 在 **Settings** → **Actions** → **General**
2. 找到 **Workflow permissions** 部分
3. 选择 **Read and write permissions**
4. 勾选 **Allow GitHub Actions to create and approve pull requests**
5. 点击 **Save** 保存

### 3. 触发首次部署

由于 Pages 刚启用，需要触发一次构建：

1. 前往 **Actions** 标签页
2. 找到 **Deploy to GitHub Pages** 工作流
3. 点击 **Run workflow** 按钮
4. 选择 `main` 分支
5. 点击绿色的 **Run workflow** 按钮

### 4. 查看部署状态

1. 在 **Actions** 标签页可以查看部署进度
2. 部署完成后，在 **Settings** → **Pages** 可以看到网站地址
3. 通常格式为: `https://chaslui.github.io/textrank4zh-ts/`

## 🌐 在线演示地址

部署完成后，以下链接将可以访问：

| 演示类型 | 地址 | 说明 |
|----------|------|------|
| 🏠 **演示中心** | `https://chaslui.github.io/textrank4zh-ts/` | 主页面，包含所有演示的导航 |
| 🌐 **浏览器演示** | `https://chaslui.github.io/textrank4zh-ts/browser/` | 基础功能演示，使用实际构建的库 |
| ⚡ **Worker 演示** | `https://chaslui.github.io/textrank4zh-ts/worker/` | 多线程处理演示和架构说明 |
| 🔧 **构建集成** | `https://chaslui.github.io/textrank4zh-ts/build-usage/` | 各种构建方式和集成示例 |

## 🔧 部署工作流说明

### 自动触发条件

- 推送到 `main` 分支
- 手动触发 (workflow_dispatch)

### 部署过程

1. **构建项目**: 运行 `pnpm run build` 生成所有格式的构建产物
2. **准备页面**: 创建 `_site` 目录并复制所有需要的文件
3. **路径调整**: 自动更新示例中的文件引用路径
4. **创建演示**: 生成使用实际库文件的演示脚本
5. **部署上传**: 上传到 GitHub Pages

### 构建产物

部署包含以下文件：

```
_site/
├── index.html              # 演示中心主页
├── browser/                # 浏览器演示
│   ├── index.html
│   ├── demo-live.js        # 使用实际库的演示脚本
│   └── demo.js             # 原始演示脚本
├── worker/                 # Worker 演示
│   ├── index.html          # Worker 演示导航页
│   ├── universal-demo.html
│   └── ...
├── build-usage/            # 构建集成示例
│   ├── index.html          # 构建示例导航页
│   ├── iife-example.html
│   └── ...
└── dist/                   # 构建产物
    ├── index.mjs           # ES Module
    ├── index.cjs           # CommonJS
    ├── index.iife.js       # IIFE
    ├── index.d.ts          # TypeScript 类型
    ├── index.worker.js     # DedicatedWorker
    └── index.sharedworker.js # SharedWorker
```

## 🎯 功能特性

### 📱 演示中心

- **美观的用户界面**: 现代化的渐变背景和卡片设计
- **响应式布局**: 适配各种设备和屏幕尺寸  
- **导航系统**: 清晰的分类和链接导航
- **技术展示**: 详细的特性说明和技术栈展示

### 🌐 浏览器演示

- **实际库文件**: 使用 `demo-live.js` 调用真实的构建产物
- **交互式界面**: 完整的文本分析配置和结果展示
- **错误处理**: 完善的错误处理和用户反馈
- **示例文本**: 预置的中文示例文本便于测试

### ⚡ Worker 演示

- **架构说明**: 详细的三级降级策略说明
- **多种演示**: 通用客户端、专用Worker、共享Worker
- **性能对比**: 不同执行模式的性能比较
- **代码示例**: 完整的使用代码和配置说明

### 🔧 构建集成

- **多格式展示**: IIFE、ES Module、CommonJS、CDN
- **集成指南**: 详细的构建工具集成说明
- **文件信息**: 各种构建产物的大小和用途说明
- **快速开始**: 针对不同环境的快速集成指南

## 🔄 更新和维护

### 自动更新

- 每次推送到 `main` 分支都会自动重新部署
- 确保在线演示始终使用最新版本的库

### 手动更新

如需手动触发部署：

1. 前往 **Actions** 标签页
2. 选择 **Deploy to GitHub Pages** 工作流
3. 点击 **Run workflow**

### 自定义域名

如需使用自定义域名：

1. 在 **Settings** → **Pages** 中设置 **Custom domain**
2. 添加 CNAME 记录指向 `chaslui.github.io`
3. 等待 DNS 传播完成

## 🐛 故障排除

### 部署失败

1. 检查 **Actions** 标签页的错误日志
2. 确认构建命令 `pnpm run build` 能正常执行
3. 检查文件路径和引用是否正确

### 页面无法访问

1. 确认 GitHub Pages 已正确启用
2. 检查仓库是否为公开状态
3. 等待几分钟让 CDN 缓存更新

### 演示功能异常

1. 检查浏览器控制台错误信息
2. 确认文件路径引用正确
3. 验证构建产物是否完整

## 📚 相关文档

- [GitHub Pages 官方文档](https://docs.github.com/en/pages)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [项目构建文档](BUILD.md)
- [CI/CD 配置指南](CI_SETUP.md)