# 发布指南

本项目集成了 release-it 来自动化发布流程，支持手动发布到 npm 包和创建 GitHub releases。

## 发布前准备

### 1. 确保环境配置
```bash
# 确保已登录 npm
npm login

# 确保已配置 GitHub token (可选，用于创建 GitHub releases)
# 在 GitHub 创建 Personal Access Token 并设置环境变量
export GITHUB_TOKEN=your_github_token
```

### 2. 确保代码质量
```bash
# 运行代码检查和测试
pnpm run lint
pnpm run test
pnpm run build
```

## 发布命令

### 预览发布流程（不实际发布）
```bash
# 干跑模式，查看将要执行的操作
pnpm run release:dry
```

### 手动发布不同版本

#### 补丁版本发布 (x.y.Z)
```bash
# 适用于：bug 修复、小的改进
pnpm run release:patch
```

#### 小版本发布 (x.Y.z)
```bash
# 适用于：新功能、向后兼容的改动
pnpm run release:minor
```

#### 大版本发布 (X.y.z)
```bash
# 适用于：不兼容的API改动、重大重构
pnpm run release:major
```

#### 交互式发布
```bash
# 交互式选择版本号
pnpm run release
```

## 发布流程说明

release-it 会自动执行以下步骤：

### 1. 预发布检查
- ✅ 运行 ESLint 代码检查
- ✅ 运行所有测试用例
- ✅ 检查工作目录是否干净
- ✅ 验证 npm 登录状态

### 2. 版本管理
- 🏷️ 自动更新 `package.json` 中的版本号
- 📝 基于 conventional commits 生成 `CHANGELOG.md`
- 🏷️ 创建 git tag (格式：v1.2.3)

### 3. 构建和发布
- 🧹 清理旧的构建产物
- 🔨 重新构建所有产物 (CJS、ESM、IIFE、Worker 文件)
- 📦 发布到 npm registry
- 🚀 创建 GitHub release (包含构建产物)

### 4. Git 操作
- 📝 提交版本更新 (commit message: "chore: release vX.Y.Z")
- 🏷️ 推送代码和标签到 GitHub
- 📋 上传构建产物到 GitHub releases

## 发布配置

项目的发布配置位于 `.release-it.json`：

```json
{
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}",
    "pushArgs": ["--follow-tags"]
  },
  "github": {
    "release": true,
    "releaseName": "Release v${version}",
    "assets": ["dist/**"]
  },
  "npm": {
    "publish": true,
    "publishArgs": ["--access", "public"]
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "conventionalcommits",
      "infile": "CHANGELOG.md"
    }
  }
}
```

## 提交信息规范

为了生成有意义的 CHANGELOG，请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
# 功能更新
feat: add support for custom similarity functions

# Bug 修复  
fix: resolve memory leak in worker threads

# 性能优化
perf: optimize PageRank algorithm performance

# 文档更新
docs: update API documentation

# 构建配置
build: update build configuration for better browser support

# 测试相关
test: add comprehensive worker system tests
```

## 故障排除

### npm 发布失败
```bash
# 检查登录状态
npm whoami

# 重新登录
npm login
```

### GitHub release 创建失败
```bash
# 设置 GitHub token
export GITHUB_TOKEN=your_github_token

# 或者跳过 GitHub release
pnpm run release -- --no-github
```

### 权限问题
```bash
# 检查包权限
npm access list collaborators textrank4zh-ts

# 设置包为公开
npm access public textrank4zh-ts
```

## 发布清单

在发布前，请确认：

- [ ] 所有测试通过 (104/104)
- [ ] 代码通过 ESLint 检查
- [ ] 构建成功且无错误
- [ ] 工作目录干净 (无未提交的更改)
- [ ] 已登录 npm
- [ ] (可选) 已配置 GitHub token
- [ ] 版本号符合语义化版本规范
- [ ] CHANGELOG.md 生成正确

## 发布后验证

发布成功后，验证：

- [ ] npm 包版本更新: `npm view textrank4zh-ts version`
- [ ] GitHub release 创建成功
- [ ] 构建产物正确上传
- [ ] CHANGELOG.md 内容准确
- [ ] git 标签推送成功

## 回滚发布

如需回滚发布：

```bash
# 撤销 npm 包 (24小时内)
npm unpublish textrank4zh-ts@version

# 删除 GitHub release 和 tag
gh release delete vX.Y.Z
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```