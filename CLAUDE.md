# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

TextRank4ZH-TS 是一个用 TypeScript 实现的 TextRank 算法库，专门用于中文文本的关键词提取和摘要生成。这是对原 Python 版本的完整重写，**完全支持浏览器环境**，采用现代 TypeScript 开发，支持多种运行环境和部署模式。

## 核心架构

### 主要组件

1. **TextRankKeyword** (`src/core/textrank-keyword.ts`) - 关键词和关键短语提取
   - 基于 PageRank 算法计算单词重要性
   - 支持滑动窗口构造单词关系图
   - 提供函数式错误处理 (Result类型)

2. **TextRankSentence** (`src/core/textrank-sentence.ts`) - 句子摘要提取
   - 基于句子相似度构造句子关系图
   - 使用 PageRank 算法计算句子重要性
   - 支持自定义相似度函数

3. **Segmentation** (`src/core/segmentation.ts`) - 文本预处理模块
   - `WordSegmentation` - 中文分词（内置轻量级分词器）
   - `SentenceSegmentation` - 句子分割
   - `Segmentation` - 统一的分词分句接口

4. **Worker系统** (`src/worker/`) - 多线程支持
   - `TextRankUniversalClient` - 智能客户端，支持三级降级
   - `TextRankWorkerClient` - 专用Worker客户端
   - 支持 SharedWorker → DedicatedWorker → 主线程调度

5. **工具模块** (`src/utils/`)
   - `data-transfer.ts` - Transferable对象优化，零拷贝传输
   - `main-thread-scheduler.ts` - 主线程调度器，60fps保护
   - `result-helpers.ts` - 函数式错误处理辅助函数

### 数据处理流程

文本被处理为四种不同格式：
- `sentences` - 句子列表
- `wordsNoFilter` - 原始分词结果（二维列表）
- `wordsNoStopWords` - 去除停用词后的分词结果
- `wordsAllFilters` - 去除停用词并过滤词性后的分词结果

## 开发命令

### 构建相关
```bash
# 开发构建（Vite 监听重建）
npm run dev

# 完整构建（所有格式）
npm run build

# 清理构建产物
npm run clean

# 类型检查
npm run typecheck
```

### 测试相关
```bash
# 运行所有测试
npm test

# 监听模式测试
npm run test:watch

# 测试UI界面
npm run test:ui

# 测试覆盖率
npm run test:coverage

# 浏览器测试（需先构建）
npm run test:browser
```

### 代码质量
```bash
# oxlint 检查
npm run lint

# oxlint 自动修复
npm run lint:fix

# oxfmt 格式化
npm run format

# oxfmt 格式检查（不写回）
npm run format:check
```

### 发布相关
```bash
# 手动发布（交互式）
npm run release

# 预览发布（不执行实际发布）
npm run release:dry

# 指定版本类型发布
npm run release:patch  # 修复版本 (0.1.0 -> 0.1.1)
npm run release:minor  # 功能版本 (0.1.0 -> 0.2.0) 
npm run release:major  # 重大版本 (0.1.0 -> 1.0.0)
```

### 开发服务器
```bash
# 启动示例服务器
npm run serve
# 然后访问 http://localhost:8000
```

## 构建系统

### 构建产物

项目使用 `vite` 构建（内置 rolldown 打包器，配置见 `vite.config.ts`），类型声明由 `unplugin-dts` + `@microsoft/api-extractor` 生成，生成多种格式：

```
dist/
├── index.cjs          # CommonJS (Node.js)
├── index.mjs          # ES Module (现代工具)
├── index.d.ts         # TypeScript类型定义
├── index.d.cts        # CJS类型定义（node16/nodenext 解析用）
├── index.d.mts        # ESM类型定义（node16/nodenext 解析用）
├── index.iife.js      # IIFE (浏览器直接引入)
├── index.worker.js    # DedicatedWorker独立文件
└── index.sharedworker.js  # SharedWorker独立文件
```

`build` 脚本依次执行三次 Vite 构建（默认 / `--mode worker` / `--mode sharedworker`），最后由 `build:dts-compat` 从 `index.d.ts` 复制出 `index.d.cts` 和 `index.d.mts`（缺失会让下游在 `moduleResolution: node16/nodenext` 下报 TS1479）。

### 关键特性
- **零外部依赖**: `typescript-result` 等依赖全部内联到 5 个 JS 产物，不带裸模块说明符
- **ES2020 目标**: `vite.config.ts` 显式设置 `build.target: 'es2020'`，维持既有浏览器兼容承诺
- **多格式支持**: CJS、ESM、IIFE、Worker文件
- **独立Worker**: Worker文件可直接复制使用
- **类型完整**: 包含完整TypeScript类型定义

## 测试系统

### 测试架构
使用 Vitest 作为测试框架，9 个测试文件共 104 个测试用例：

- `tests/integration.test.ts` - 集成测试
- `tests/textrank-keyword.test.ts` - 关键词提取测试
- `tests/textrank-sentence.test.ts` - 句子摘要测试
- `tests/segmentation.test.ts` - 分词测试
- `tests/worker.test.ts` - Worker系统测试
- `tests/performance.test.ts` - 性能基准测试
- `tests/real-world-scenarios.test.ts` - 真实场景测试
- `tests/utils.test.ts` - 工具函数测试
- `tests/async-analysis.test.ts` - 异步分析测试

### 测试配置
- **环境**: Node.js环境
- **超时**: 10秒
- **覆盖率**: 包含HTML、LCOV报告
- **全局变量**: 启用，便于编写测试

## API设计模式

### 函数式错误处理
```typescript
// 使用Result类型，避免try/catch
const result = tr4w.analyze(text, { window: 2 });

if (result.isOk()) {
  // 成功处理
} else {
  // 错误处理
  console.error(result.error.type, result.error.message);
}
```

### Worker智能降级
```typescript
// 三级智能降级: SharedWorker → DedicatedWorker → 主线程调度
const client = new TextRankUniversalClient('./worker.js', {
  preferredWorkerType: 'auto',
  fallbackToSync: true,
  syncScheduling: { timeSlice: 5 }
});
```

## 核心依赖

### 运行时依赖
- `typescript-result@^3.5.2` - 函数式错误处理

### 开发依赖
- `typescript@^7.0.2` - TypeScript编译器（Go 原生移植版）
- `@typescript/typescript6@^6.0.2` - dts 生成路径使用的 TS 6 编译器
- `vite@^8.2.2` - 构建工具（内置 rolldown 打包器）
- `unplugin-dts@^1.0.3` + `@microsoft/api-extractor@^7.59.0` - 类型声明生成与打包
- `vitest@^4.1.11` - 测试框架
- `oxlint@^1.80.0` - 代码检查
- `oxfmt@^0.65.0` - 代码格式化
- `release-it@^19.0.4` - 版本发布

## 项目特性

### 浏览器兼容
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+
- 支持 ES2020 的现代浏览器

### 性能优化
- Transferable对象优化：50-90%性能提升
- 主线程调度：60fps流畅度保证
- 四级调度算法：智能时间片管理
- 零拷贝数据传输：减少内存占用

### 开发体验
- 完整TypeScript类型支持
- 函数式错误处理
- 104个测试用例保证质量
- 多种使用示例
- 详细的API文档

## 测试数据

测试文件位于：
- `data/test-text.txt` - 测试文本
- `data/stopwords.txt` - 中文停用词
- `tests/test-helpers.ts` - 测试辅助函数

## 部署注意事项

### Worker文件部署
Worker文件需要与主页面同源或正确配置CORS：
```javascript
// 确保Worker文件路径正确
const client = new TextRankUniversalClient('./dist/index.worker.js');
```

### CDN使用
```html
<!-- 通过CDN使用 -->
<script type="module">
  import { TextRankKeyword } from 'https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.mjs';
</script>
```

### IIFE全局变量
```html
<script src="./dist/index.iife.js"></script>
<script>
  const { TextRankKeyword } = window.TextRank4ZH;
</script>
```

## 自动发布流程

项目配置了基于 Conventional Commits 的自动发布系统，当向 `main` 分支推送代码时会自动触发发布流程。

### Conventional Commits 规范

commit 前缀决定**要不要发布**；**发哪一级**由 release-it 依据「上次发布以来的全部 commit」推断，而非只看最新一条。

#### 触发发布的前缀

```bash
git commit -m "fix: 修复关键词提取的边界情况问题"
git commit -m "perf: 优化分词算法性能"
git commit -m "feat: 添加新的文本摘要算法"
git commit -m "feat(worker): 增加SharedWorker支持"
git commit -m "feat!: 重构API，移除已弃用方法"
```

#### 版本级别如何确定

在累积的未发布 commit 中：出现过破坏性变更(`!`) → major；出现过 `feat:` → minor；只有 `fix:` / `perf:` → patch。

**这意味着**：若上次发布后已有 `feat:` 提交，此后一条 `fix:` 触发的发布仍会是 minor —— 那个 feature 尚未发布，理应计入。v0.3.0 正是如此产生：累积了「词表扩充」与「自定义分词器」两个 feat，最终由一条 fix 触发。

**注意**: 感叹号(!)表示破坏性变更，会触发major版本发布。

### 自动发布工作流程

1. **提交检查**: 分析最新commit message，判断是否需要发布
2. **质量检查**: 自动运行lint、test、build
3. **版本推断**: release-it 依据全部未发布 commit 计算版本号
4. **更新日志**: 自动生成CHANGELOG.md
5. **NPM发布**: 经 Trusted Publisher (OIDC) 发布到npm registry，自动附带 SLSA provenance
6. **GitHub Release**: 创建GitHub release并上传dist产物
7. **GitHub Packages**: 同一份产物以 `@chaslui/textrank4zh-ts` 再发一份

### 跳过自动发布的场景

以下commit类型**不会**触发自动发布：
- `docs:` - 文档更新
- `style:` - 代码格式化
- `refactor:` - 重构（无功能变更）
- `test:` - 测试相关
- `chore:` - 构建工具、依赖更新等
- `build:` - 构建系统变更
- `ci:` - CI配置变更

### 手动发布

如果需要手动控制发布流程。注意 OIDC 只在 GitHub Actions 中生效，本地发布需自行 `npm login` 并在 publish 时输入 2FA 验证码：

```bash
# 预览将要发布的内容
pnpm run release:dry

# 交互式发布（推荐）
pnpm run release

# 指定版本类型
pnpm run release:patch
pnpm run release:minor  
pnpm run release:major
```

### GitHub Actions配置

npm 认证使用 **Trusted Publisher (OIDC)**，不需要 npm token：

- npm 侧：包的 Settings → Trusted Publisher 绑定 `ChasLui/textrank4zh-ts` 的 `release.yml`，权限勾选 `npm publish`
- workflow 侧：`permissions` 需含 `id-token: write`；不要给 `setup-node` 设 `registry-url`（它会写入空的 `_authToken` 反而导致认证失败）；`release-it` 需加 `--npm.skipChecks`（OIDC 凭证在 publish 时才换取，`npm whoami` 阶段尚不存在）
- `GITHUB_TOKEN`: GitHub API token（自动提供），同时用于发布 GitHub Packages

因为发布走 OIDC，npm 会自动为产物生成 **SLSA provenance** 证明，在 npm 页面显示构建来源。这要求仓库公开且经 GitHub Actions 发布，无需额外配置。

### GitHub Packages

npm registry 上的 `textrank4zh-ts` 是主入口；GitHub Packages 上另有一份 `@chaslui/textrank4zh-ts`：

- 包名必须 scoped 且 scope 等于仓库 owner，故发布前用 `npm pkg set name=` 临时改名，发布后 `git checkout -- package.json` 还原
- 发布用 `--ignore-scripts`，避免 `prepublishOnly` 把上一步刚构建的 dist 清掉重来
- 该 registry 即便对公开包也要求安装方持 PAT 认证，因此它是补充而非替代

发布工作流程位于：`.github/workflows/release.yml`

### 发布注意事项

1. **破坏性变更**: 使用`!`标记时要格外谨慎
2. **commit message**: 必须准确描述变更内容
3. **测试覆盖**: 确保新功能有对应测试
4. **文档更新**: 重大变更需要更新README和示例
5. **向后兼容**: minor版本应保持API兼容性