# GitHub Pages 部署配置指南

本文档说明如何为 TextRank4ZH-TS 项目正确配置 GitHub Pages 自动部署。

## 问题描述

如果遇到以下错误：
```
Error: Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions
```

这表示 GitHub 仓库的 Pages 功能需要手动启用和配置。

## 解决步骤

### 1. 启用 GitHub Pages

1. 进入你的 GitHub 仓库页面
2. 点击 **Settings** 标签
3. 在左侧导航栏中找到 **Pages** 选项
4. 在 **Source** 部分选择 **GitHub Actions**
5. 点击 **Save** 保存设置

### 2. 配置仓库权限

确保 Actions 有足够的权限：

1. 在 **Settings** > **Actions** > **General** 中
2. 找到 **Workflow permissions** 部分
3. 选择 **Read and write permissions**
4. 勾选 **Allow GitHub Actions to create and approve pull requests**
5. 点击 **Save** 保存

### 3. 验证部署配置

确认以下配置正确：

1. 在 **Settings** > **Pages** 中确认：
   - Source: GitHub Actions
   - Branch: 没有分支选择（因为使用 Actions）

2. 检查 Actions 标签页，确认工作流可以正常运行

### 4. 手动触发部署

如果配置完成后还没有自动部署：

1. 进入 **Actions** 标签页
2. 找到 "Deploy to GitHub Pages" 工作流
3. 点击 **Run workflow** 手动触发

## 预期结果

配置成功后，你将看到：

1. 每次推送到 `main` 分支时自动触发部署
2. 在 Actions 标签页可以看到部署状态
3. 部署成功后，Pages URL 将可以访问：
   - 在线演示：`https://<username>.github.io/<repository-name>/`
   - 浏览器示例：`https://<username>.github.io/<repository-name>/browser/`
   - Worker 示例：`https://<username>.github.io/<repository-name>/worker/`

## 常见问题

### Q: 为什么需要手动启用 Pages？

A: GitHub Pages 默认是禁用的，需要仓库管理员手动启用并选择部署方式。

### Q: 可以使用分支部署吗？

A: 可以，但推荐使用 GitHub Actions 部署，这样可以自动构建和优化资源文件。

### Q: 部署失败怎么办？

A: 
1. 检查 Actions 标签页的错误日志
2. 确认权限设置正确
3. 确保 Pages 功能已启用
4. 如果是首次部署，可能需要等待几分钟生效

## 部署内容

成功部署后，Pages 将包含：

- **在线演示首页** - 展示所有功能的入口
- **浏览器基础演示** - 直接在浏览器中使用 TextRank4ZH-TS
- **Web Worker 演示** - 展示多线程处理能力
- **构建集成示例** - 展示不同模块格式的使用方法
- **API 文档链接** - 链接到详细的使用文档

## 技术说明

部署工作流会自动：

1. 构建 TypeScript 项目
2. 生成所有格式的 JavaScript 文件
3. 创建优化的演示页面
4. 处理资源文件路径
5. 部署到 GitHub Pages

无需手动干预，一切都是自动化的。