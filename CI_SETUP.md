# CI/CD 配置指南

本文档说明如何配置项目的 GitHub Actions CI/CD 和 Codecov 集成。

## GitHub Actions CI

### 已配置的工作流

✅ **代码质量检查** (`lint`)
- ESLint 代码规范检查
- TypeScript 类型检查

✅ **测试和覆盖率** (`test`)
- 多版本 Node.js 测试 (18.x, 20.x, 22.x)
- 生成测试覆盖率报告
- 自动上传到 Codecov

✅ **构建测试** (`build`)
- 完整项目构建
- 验证所有构建产物
- 上传构建文件为 artifacts

✅ **浏览器兼容性测试** (`browser-test`)
- 启动 HTTP 服务器测试浏览器示例
- 验证浏览器环境兼容性

✅ **发布预检查** (`release-check`)
- 测试发布流程（仅在 main 分支）
- 验证发布配置正确性

### 触发条件

- 推送到 `main` 分支
- 对 `main` 分支的 Pull Request

## Codecov 集成

### 设置步骤

1. **访问 Codecov**
   - 前往 [https://app.codecov.io/gh/ChasLui/textrank4zh-ts/new](https://app.codecov.io/gh/ChasLui/textrank4zh-ts/new)
   - 使用 GitHub 账号登录

2. **获取 Repository Token**
   ```bash
   # 在 Codecov 项目页面获取 token
   # 例如: 12345678-abcd-1234-efgh-123456789012
   ```

3. **配置 GitHub Secrets**
   - 前往 GitHub 仓库 → Settings → Secrets and variables → Actions
   - 添加新的 Repository secret:
     - Name: `CODECOV_TOKEN` 
     - Value: 从 Codecov 获取的 token

### 覆盖率配置

项目已配置 `codecov.yml` 文件：

```yaml
coverage:
  target: 80%          # 目标覆盖率
  threshold: 1%        # 允许的下降幅度
  
ignore:
  - "tests/**"         # 忽略测试文件
  - "examples/**"      # 忽略示例文件
  - "dist/**"         # 忽略构建产物
```

### 覆盖率报告

- **生成**: 自动在 CI 中生成
- **格式**: LCOV 格式 (`coverage/lcov.info`)
- **上传**: 仅在 Node.js 22.x 环境中上传（避免重复）
- **展示**: README 中的覆盖率徽章

## CI 状态

### 徽章说明

| 徽章 | 说明 | 状态页面 |
|-----|------|---------|
| ![CI](https://github.com/ChasLui/textrank4zh-ts/workflows/CI/badge.svg) | 整体 CI 状态 | [Actions](https://github.com/ChasLui/textrank4zh-ts/actions) |
| ![codecov](https://codecov.io/gh/ChasLui/textrank4zh-ts/branch/main/graph/badge.svg) | 代码覆盖率 | [Codecov](https://codecov.io/gh/ChasLui/textrank4zh-ts) |

### 查看详情

1. **CI 运行日志**
   - GitHub → Actions 标签页
   - 点击具体的 workflow run

2. **覆盖率详情**
   - 访问 Codecov 项目页面
   - 查看文件级别的覆盖率
   - 查看覆盖率趋势图

## 故障排除

### CI 失败常见原因

1. **代码质量检查失败**
   ```bash
   # 本地运行检查
   pnpm run lint
   npx tsc --noEmit
   ```

2. **测试失败**
   ```bash
   # 本地运行测试
   pnpm run test
   pnpm run test:coverage
   ```

3. **构建失败**
   ```bash
   # 本地构建测试
   pnpm run build
   ```

### Codecov 上传失败

1. **检查 Token 配置**
   - 确认 `CODECOV_TOKEN` secret 已正确设置
   - Token 应该是项目专用的，不是个人 token

2. **检查覆盖率文件**
   ```bash
   # 确认本地生成覆盖率文件
   pnpm run test:coverage
   ls -la coverage/lcov.info
   ```

3. **网络问题**
   - Codecov 服务偶尔不稳定
   - CI 中已设置 `fail_ci_if_error: false` 避免阻塞

### Node.js 版本兼容性

如果某个 Node.js 版本测试失败：

1. **检查依赖兼容性**
   ```bash
   # 查看 package.json engines 字段
   cat package.json | grep -A3 "engines"
   ```

2. **更新支持的版本范围**
   ```yaml
   # .github/workflows/ci.yml
   strategy:
     matrix:
       node-version: [18.x, 20.x, 22.x]  # 移除不兼容的版本
   ```

## 本地开发

### 预提交检查

建议在提交前运行：

```bash
# 完整的 CI 检查流程
pnpm run lint        # 代码规范
npx tsc --noEmit     # 类型检查
pnpm run test        # 运行测试
pnpm run build       # 构建验证
```

### 设置 Git Hooks

可以使用 husky 等工具自动运行预提交检查：

```bash
# 安装 husky (可选)
npm install --save-dev husky

# 设置 pre-commit hook
echo "pnpm run lint && pnpm run test" > .husky/pre-commit
```

## 维护

### 定期检查

1. **依赖更新**
   - 定期更新 GitHub Actions 版本
   - 检查 Node.js LTS 版本变化

2. **覆盖率监控**
   - 关注覆盖率变化趋势
   - 确保新功能有对应测试

3. **性能监控**
   - 监控 CI 运行时间
   - 优化缓存策略

### CI 配置更新

修改 `.github/workflows/ci.yml` 时需要注意：

1. **测试更改**
   - 在个人分支测试 CI 更改
   - 确认所有 job 正常运行

2. **向后兼容**
   - 避免破坏现有的 CI 流程
   - 保持徽章 URL 稳定

3. **安全考虑**
   - 不在日志中暴露敏感信息
   - 正确使用 GitHub Secrets