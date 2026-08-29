# TextRank4ZH-TS

TextRank算法的TypeScript实现，专门用于中文文本的关键词提取和摘要生成。这是对原Python版本[TextRank4ZH](https://github.com/someus/TextRank4ZH)的TypeScript重写，**完全支持浏览器环境**。

[![npm version](https://badge.fury.io/js/textrank4zh-ts.svg)](https://badge.fury.io/js/textrank4zh-ts)
[![CI](https://github.com/ChasLui/textrank4zh-ts/workflows/CI/badge.svg)](https://github.com/ChasLui/textrank4zh-ts/actions)
[![codecov](https://codecov.io/gh/ChasLui/textrank4zh-ts/branch/main/graph/badge.svg)](https://codecov.io/gh/ChasLui/textrank4zh-ts)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Browser Support](https://img.shields.io/badge/Browser-ES2020+-green.svg)](https://caniuse.com/es6)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 特性

- 🌐 **浏览器兼容**: 完全支持浏览器环境，无需Node.js依赖
- 🚀 **高性能**: 基于TypeScript，提供类型安全和优秀的性能
- ⚡ **异步支持**: async/await API，支持进度回调和非阻塞处理
- 🧠 **智能分词**: 内置轻量级中文分词器，支持词性过滤
- 🔍 **关键词提取**: 基于TextRank算法提取文本关键词和关键短语
- 📄 **文本摘要**: 自动生成文本摘要，提取最重要的句子
- 🎛️ **主线程调度**: 智能时间片控制，保证60fps流畅度
- 🔄 **函数式错误处理**: 使用Result类型，消除传统try/catch异常处理
- 🏗️ **多格式构建**: 支持CJS、ESM、IIFE、独立Worker文件
- ⚙️ **灵活配置**: 支持多种参数配置，满足不同场景需求
- 📊 **性能优化**: Transferable对象优化，零拷贝数据传输
- 🧪 **完整测试**: 包含完整测试用例，保证代码质量
- 📦 **开箱即用**: 轻量级依赖，便于集成和部署

## 安装

### npm 安装（推荐）

来自 npm 官方源，包名 `textrank4zh-ts`，无需任何认证：

```bash
npm install textrank4zh-ts
```

> Node.js 版本要求：`^20.19.0 || >=22.12.0`（浏览器端使用不受此限制）。

### 浏览器直接引入
```html
<!-- 通过 jsDelivr 的 npm 源引入：省略版本号即最新发布版本 -->
<script type="module">
  import { TextRankKeyword, TextRankSentence } from 'https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.mjs';
  // 使用库...
</script>

<!-- 生产环境建议锁定版本：在包名后加 @<version>，例如 @0.3.0 -->
<!-- https://cdn.jsdelivr.net/npm/textrank4zh-ts@0.3.0/dist/index.mjs -->
```

### 从 GitHub Packages 安装

同一份产物也发布到 GitHub Packages，但**包名不同**：那里叫 `@chaslui/textrank4zh-ts` —— 该 registry 强制要求 scope 与仓库 owner 一致。两个包名指向完全相同的产物，按你使用的源二选一即可，**不要同时安装**。

先配置 registry 与认证：

```ini
# .npmrc
@chaslui:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<你的 GitHub PAT>
```

然后用命令行安装：

```bash
npm install @chaslui/textrank4zh-ts@0.3.0
```

或在 `package.json` 中声明：

```json
{
  "dependencies": {
    "@chaslui/textrank4zh-ts": "0.3.0"
  }
}
```

> GitHub Packages 即便对公开包也要求 PAT（`read:packages`）认证才能安装 —— 这是该 registry 的固有限制，与包是否公开无关。没有这个需求就用上面的 npm 源。

### 在线演示
🔗 [浏览器在线演示](https://chaslui.github.io/textrank4zh-ts/browser/) - 无需安装，直接在浏览器中体验  
⚡ [Web Worker 演示](https://chaslui.github.io/textrank4zh-ts/worker/) - 后台线程处理，性能优化演示  
🔧 [构建集成示例](https://chaslui.github.io/textrank4zh-ts/build-usage/) - 各种构建方式和部署示例  
🚀 [完整演示中心](https://chaslui.github.io/textrank4zh-ts/) - 所有功能和示例的综合展示

## 快速开始

### 关键词提取 - 同步模式

```typescript
import { TextRankKeyword } from 'textrank4zh-ts';

const text = '北京是中华人民共和国的首都，是全国政治中心、文化中心';
const tr4w = new TextRankKeyword();

// 同步分析
const result = tr4w.analyze(text, {
  lower: true,
  window: 2
});

if (result.ok) {
  // 获取关键词
  const keywords = tr4w.getKeywords(10, 1);
  keywords.forEach(item => {
    console.log(`${item.word}: ${item.weight.toFixed(4)}`);
  });

  // 获取关键短语  
  const keyphrases = tr4w.getKeyphrases(10, 2);
  console.log('关键短语:', keyphrases);
} else {
  console.error('分析失败:', result.error!.message);
}
```

### 关键词提取 - 异步模式（推荐用于大文本）

```typescript
import { TextRankKeyword } from 'textrank4zh-ts';

const text = '北京是中华人民共和国的首都，是全国政治中心、文化中心...'; // 大量文本
const tr4w = new TextRankKeyword();

// 异步分析，支持进度回调，不阻塞主线程
const result = await tr4w.analyzeAsync(text, {
  lower: true,
  window: 2,
  // 进度回调
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.progress.toFixed(1)}% - ${progress.message}`);
    
    if (progress.details?.iterations) {
      console.log(`PageRank迭代: ${progress.details.iterations}/${progress.details.maxIterations}`);
    }
  },
  // 异步配置
  timeSlice: 5,          // 5ms时间片
  maxContinuousTime: 16, // 60fps保护
  priority: 'background'  // 后台任务
});

if (result.ok) {
  const keywords = tr4w.getKeywords(10, 1);
  console.log('关键词:', keywords);
} else {
  console.error('异步分析失败:', result.error!);
}
```

### 文本摘要 - 同步模式

```typescript
import { TextRankSentence } from 'textrank4zh-ts';

const text = `
北京是中华人民共和国的首都，是全国政治中心、文化中心。
上海是中华人民共和国直辖市，是中国最大的经济中心。
深圳是中国改革开放的前沿城市，经济发展迅速。
`;

const tr4s = new TextRankSentence();

// 分析文本
tr4s.analyze(text, {
  lower: true,
  source: 'all_filters'
});

// 获取关键句子
const sentences = tr4s.getKeySentences(2);
sentences.forEach(item => {
  console.log(`权重: ${item.weight.toFixed(4)}`);
  console.log(`句子: ${item.sentence}`);
});

// 生成摘要
const summary = tr4s.getSummary(2, 10, true);
console.log('摘要:', summary);
```

### 文本摘要 - 异步模式

```typescript
import { TextRankSentence } from 'textrank4zh-ts';

const longText = `
北京是中华人民共和国的首都，全国政治中心、文化中心、国际交往中心、科技创新中心...
// 大量文本内容
`;

const tr4s = new TextRankSentence();

// 异步分析，避免阻塞主线程
const result = await tr4s.analyzeAsync(longText, {
  lower: true,
  source: 'no_stop_words',
  onProgress: (progress) => {
    console.log(`句子分析进度: ${progress.progress}% - ${progress.message}`);
    
    if (progress.phase === 'pagerank' && progress.details) {
      console.log(`句子图计算: ${progress.details.processedItems}/${progress.details.totalItems}`);
    }
  },
  // 针对大文本优化的配置
  timeSlice: 3,           // 较小的时间片
  maxContinuousTime: 10,  // 更短的连续执行时间
  priority: 'normal'      // 普通优先级
});

if (result.ok) {
  // 获取关键句子
  const sentences = tr4s.getKeySentences(3);
  console.log('重要句子:', sentences);
  
  // 生成摘要
  const summary = tr4s.getSummary(3, 15, true);
  console.log('文本摘要:', summary);
} else {
  console.error('异步分析失败:', result.error!);
}

// 使用自定义相似度函数的异步分析
const customSimilarity = (words1: string[], words2: string[]): number => {
  // 自定义Jaccard相似度
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

const customResult = await tr4s.analyzeWithSimilarityFuncAsync(
  longText,
  customSimilarity,
  {
    lower: true,
    onProgress: (progress) => {
      console.log(`自定义相似度分析: ${progress.progress}%`);
    }
  }
);

if (customResult.ok) {
  const customSummary = tr4s.getSummary(3);
  console.log('自定义相似度摘要:', customSummary);
}
```

### 智能Worker使用（推荐用于大文本）

```typescript
import { TextRankUniversalClient, WorkerType } from 'textrank4zh-ts';

// 创建通用客户端 - 自动选择最佳Worker类型
const client = new TextRankUniversalClient('./textrank.worker.js', {
  timeout: 30000,               // 超时时间
  maxConcurrent: 10,           // 最大并发任务数
  preferredWorkerType: 'auto', // 'shared' | 'dedicated' | 'auto'
  fallbackToSync: true,        // 允许降级到同步模式
  syncScheduling: {            // 同步模式调度配置
    timeSlice: 5,              // 5ms时间片
    maxContinuousTime: 16,     // 16ms最大连续执行(60fps保护)
    priority: 'background'     // 后台任务优先级
  }
});

// 检查当前使用的Worker类型和状态
const status = client.getStatus();
console.log(`当前模式: ${status.type}, 可用: ${status.available}`);

// 智能关键词分析 - 自动选择执行模式
const keywordResult = await client.analyzeKeywords(text, {
  window: 2,
  lower: true
}, {
  keywords: { num: 10 },
  keyphrases: { keywordsNum: 15 }
});

if (keywordResult.success) {
  console.log('关键词:', keywordResult.data.keywords);
  console.log('执行时间:', keywordResult.duration);
} else {
  console.error('分析失败:', keywordResult.error);
}

// 并行处理多个文档
const texts = ['文档1', '文档2', '文档3'];
const results = await Promise.all(
  texts.map(text => client.analyzeKeywords(text))
);

// 获取详细状态（包含调度器信息）
const detailedStatus = await client.getDetailedStatus();
if (detailedStatus.schedulerStatus) {
  console.log('调度器状态:', detailedStatus.schedulerStatus);
  console.log('主线程繁忙程度:', detailedStatus.mainThreadBusyness);
}

// 根据主线程繁忙程度自动优化调度策略
await client.optimizeSyncScheduling();

// 检查浏览器支持情况
if (TextRankUniversalClient.supportsWorkerType(WorkerType.SHARED)) {
  console.log('支持 SharedWorker');
}

const recommended = TextRankUniversalClient.getRecommendedWorkerType();
console.log('推荐Worker类型:', recommended);

// 清理资源
client.terminate();
```

## API 文档

### TextRankKeyword

#### 构造函数
```typescript
new TextRankKeyword(config?: SegmentationConfig)
```

#### analyze(text: string, config?: TextRankKeywordConfig): TextRankResult<void>
同步分析文本并提取关键词，返回 Result 类型以支持函数式错误处理。

**参数:**
- `text`: 要分析的文本
- `config.window`: 滑动窗口大小 (默认: 2)
- `config.lower`: 是否转换为小写 (默认: false)
- `config.vertexSource`: 构建图节点的词源 (默认: 'all_filters')
- `config.edgeSource`: 构建图边的词源 (默认: 'no_stop_words')
- `config.pageRankConfig`: PageRank算法配置

**返回值:**
- `Result<void, TextRankError>`: 成功返回 Ok(void)，失败返回 Err(TextRankError)

#### analyzeAsync(text: string, config?: AsyncTextRankKeywordConfig): Promise<Result<void, TextRankError>>
异步分析文本并提取关键词，推荐用于大文本处理。使用主线程调度器避免阻塞UI，支持进度回调。

**参数:**
- `text`: 要分析的文本  
- `config`: 包含所有同步配置选项，plus:
- `config.onProgress`: 进度回调函数 `(progress: AnalysisProgress) => void`
- `config.timeSlice`: 时间片大小（毫秒，默认: 5ms）
- `config.maxContinuousTime`: 最大连续执行时间（毫秒，默认: 16ms for 60fps）
- `config.yieldInterval`: 让出控制权间隔（迭代次数，默认: 100）
- `config.priority`: 任务优先级 `'background' | 'normal' | 'user-blocking'` (默认: 'background')

**返回值:**
- `Promise<Result<void, TextRankError>>`: 异步返回分析结果

**使用场景:**
- ✅ 处理大量文本（>1000字符）
- ✅ 需要进度反馈的场景
- ✅ 避免阻塞UI的单页应用
- ✅ 需要取消分析的场景

#### getKeywords(num?: number, wordMinLen?: number): KeywordItem[]
获取关键词列表。

**参数:**
- `num`: 返回的关键词数量 (默认: 6)
- `wordMinLen`: 关键词最小长度 (默认: 1)

#### getKeyphrases(keywordsNum?: number, minOccurNum?: number): string[]
获取关键短语列表。

**参数:**
- `keywordsNum`: 用于构造短语的关键词数量 (默认: 12)
- `minOccurNum`: 短语最少出现次数 (默认: 2)

### TextRankSentence

#### 构造函数
```typescript
new TextRankSentence(config?: SegmentationConfig)
```

#### analyze(text: string, config?: TextRankSentenceConfig): void
同步分析文本并计算句子重要性。

**参数:**
- `text`: 要分析的文本
- `config.lower`: 是否转换为小写 (默认: false)
- `config.source`: 计算相似度的词源 (默认: 'no_stop_words')
- `config.pageRankConfig`: PageRank算法配置

#### analyzeAsync(text: string, config?: AsyncTextRankSentenceConfig): Promise<Result<void, TextRankError>>
异步分析文本并计算句子重要性，推荐用于大文本处理。

**参数:**
- `text`: 要分析的文本
- `config`: 包含所有同步配置选项，plus:
- `config.onProgress`: 进度回调函数
- `config.timeSlice`: 时间片大小（默认: 5ms）
- `config.maxContinuousTime`: 最大连续执行时间（默认: 16ms）
- `config.yieldInterval`: 让出控制权间隔（默认: 100）
- `config.priority`: 任务优先级（默认: 'background'）

**返回值:**
- `Promise<Result<void, TextRankError>>`: 异步返回分析结果

#### analyzeWithSimilarityFunc(text: string, similarityFunc: SimilarityFunction, config?: TextRankSentenceConfig): void
使用自定义相似度函数同步分析文本。

**参数:**
- `text`: 要分析的文本
- `similarityFunc`: 自定义相似度计算函数
- `config`: 其他配置参数

#### analyzeWithSimilarityFuncAsync(text: string, similarityFunc: SimilarityFunction, config?: AsyncTextRankSentenceConfig): Promise<Result<void, TextRankError>>
使用自定义相似度函数异步分析文本。

**参数:**
- `text`: 要分析的文本
- `similarityFunc`: 自定义相似度计算函数 `(words1: string[], words2: string[]) => number`
- `config`: 异步配置参数（同analyzeAsync）

**返回值:**
- `Promise<Result<void, TextRankError>>`: 异步返回分析结果

#### getKeySentences(num?: number, sentenceMinLen?: number): SentenceItem[]
获取关键句子列表。

**参数:**
- `num`: 返回的句子数量 (默认: 6)
- `sentenceMinLen`: 句子最小长度 (默认: 6)

#### getSummary(num?: number, sentenceMinLen?: number, sortByIndex?: boolean): string
生成摘要文本。

**参数:**
- `num`: 摘要句子数量 (默认: 3)
- `sentenceMinLen`: 句子最小长度 (默认: 6)
- `sortByIndex`: 是否按原文顺序排序 (默认: true)

#### getSentenceWeights(): Array<{index: number, sentence: string, weight: number}>
获取所有句子的权重分布，用于调试和分析。

### TextRankUniversalClient

#### 构造函数
```typescript
new TextRankUniversalClient(workerUrl: string, options?: WorkerOptions)
```

**三级智能降级架构:**
1. **SharedWorker** (首选) - 多标签页共享，最佳性能
2. **DedicatedWorker** (降级) - 单标签页专用Worker
3. **SyncMode** (兜底) - 主线程调度，60fps保护

#### analyzeKeywords(text: string, config?: any, options?: any): Promise<WorkerResult>
智能关键词分析，自动选择最佳执行模式。

**参数:**
- `text`: 要分析的文本
- `config`: 关键词分析配置
- `options.keywords`: 关键词选项 `{num?, wordMinLen?}`
- `options.keyphrases`: 关键短语选项 `{keywordsNum?, minOccurNum?}`

**返回:** `WorkerResult<{keywords?, keyphrases?, duration}>`

#### analyzeSentences(text: string, config?: any, options?: any): Promise<WorkerResult>
智能句子分析和摘要生成。

**参数:**
- `text`: 要分析的文本
- `config`: 句子分析配置
- `options.sentences`: 句子选项 `{num?, sentenceMinLen?}`
- `options.summary`: 摘要选项 `{num?, sentenceMinLen?, sortByIndex?}`

**返回:** `WorkerResult<{sentences?, summary?, duration}>`

#### getStatus(): WorkerStatus
获取当前Worker状态和类型。

**返回:** `{type: WorkerType, supported: boolean, available: boolean, connectionCount?}`

#### getDetailedStatus(): Promise<WorkerStatus & {schedulerStatus?, mainThreadBusyness?}>
获取详细状态，包含主线程调度器信息。

#### optimizeSyncScheduling(): Promise<void>
根据主线程繁忙程度自动优化同步模式调度策略。

#### getPendingTasksCount(): number
获取当前待处理任务数量。

#### terminate(): void
终止Worker并清理资源，支持SharedWorker连接计数。

#### 静态方法

##### TextRankUniversalClient.supportsWorkerType(type: WorkerType): boolean
检查浏览器是否支持指定Worker类型。

##### TextRankUniversalClient.getRecommendedWorkerType(): WorkerType
获取当前环境推荐的Worker类型。

## 配置选项

### PageRankConfig
```typescript
interface PageRankConfig {
  alpha?: number;        // 阻尼因子 (默认: 0.85)
  maxIterations?: number; // 最大迭代次数 (默认: 100)
  tolerance?: number;     // 收敛阈值 (默认: 1e-6)
}
```

### AsyncAnalysisConfig
```typescript
interface AsyncAnalysisConfig {
  onProgress?: ProgressCallback;              // 进度回调函数
  timeSlice?: number;                        // 时间片大小（毫秒，默认: 5ms）
  maxContinuousTime?: number;                // 最大连续执行时间（毫秒，默认: 16ms）
  yieldInterval?: number;                    // 让出控制权间隔（迭代次数，默认: 100）
  priority?: 'background' | 'normal' | 'user-blocking'; // 任务优先级（默认: 'background'）
}
```

### AsyncTextRankKeywordConfig
```typescript
interface AsyncTextRankKeywordConfig extends TextRankKeywordConfig, AsyncAnalysisConfig {}
```

### AsyncTextRankSentenceConfig
```typescript  
interface AsyncTextRankSentenceConfig extends TextRankSentenceConfig, AsyncAnalysisConfig {}
```

### AnalysisProgress
```typescript
interface AnalysisProgress {
  phase: 'segmentation' | 'graph_building' | 'pagerank' | 'sorting' | 'complete';
  progress: number;        // 0-100进度百分比
  message: string;         // 当前阶段描述
  details?: {              // 可选的详细信息
    totalItems?: number;     // 总处理项目数
    processedItems?: number; // 已处理项目数  
    iterations?: number;     // 当前迭代次数
    maxIterations?: number;  // 最大迭代次数
  };
}
```

### SegmentationConfig
```typescript
interface SegmentationConfig {
  stopWordsFile?: string;    // 停用词文件路径
  allowSpeechTags?: string[]; // 允许的词性标签
  delimiters?: string[];      // 句子分隔符
}
```

### WorkerOptions
```typescript
interface WorkerOptions {
  timeout?: number;                    // 任务超时时间（毫秒，默认: 30000）
  maxConcurrent?: number;              // 最大并发任务数（默认: 10）
  preferredWorkerType?: 'shared' | 'dedicated' | 'auto';  // 首选Worker类型（默认: 'auto'）
  fallbackToSync?: boolean;            // 是否允许降级到同步模式（默认: true）
  syncScheduling?: {                   // 同步模式调度配置
    timeSlice?: number;                // 时间片大小（毫秒，默认: 5ms）
    maxContinuousTime?: number;        // 最大连续执行时间（默认: 16ms，60fps）
    idleTimeout?: number;              // requestIdleCallback超时（默认: 50ms）
    yieldInterval?: number;            // 让出控制权间隔（默认: 1000次迭代）
    priority?: 'background' | 'normal' | 'user-blocking'; // 任务优先级（默认: 'background'）
  };
}
```

### TextRankError
```typescript
interface TextRankError {
  type: ErrorType;              // 错误类型枚举
  message: string;              // 错误消息
  cause?: Error;                // 原始错误
  context?: Record<string, any>; // 错误上下文
}
```

### ErrorType 枚举
```typescript
enum ErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',   // 初始化错误
  WORKER_ERROR = 'WORKER_ERROR',                   // Worker 错误
  COMPUTATION_ERROR = 'COMPUTATION_ERROR',         // 计算错误
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',     // 序列化错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',           // 验证错误
  NETWORK_ERROR = 'NETWORK_ERROR',                 // 网络错误
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',                 // 超时错误
  UNSUPPORTED_ERROR = 'UNSUPPORTED_ERROR'          // 不支持的操作
}
```

### WorkerResult
```typescript
interface WorkerResult {
  id: string;           // 任务ID
  success: boolean;     // 执行是否成功
  data?: any;          // 结果数据
  error?: string;      // 错误信息
  duration?: number;   // 执行时长（毫秒）
}
```

### WorkerStatus
```typescript
interface WorkerStatus {
  type: WorkerType;          // 当前Worker类型
  supported: boolean;        // 是否支持
  available: boolean;        // 是否可用
  connectionCount?: number;  // SharedWorker连接数
}
```

## 错误处理

### Result 类型系统

本项目采用 `typescript-result` 库实现函数式错误处理，完全消除传统 try/catch 异常处理的问题。

#### 基本用法

```typescript
import { TextRankKeyword } from 'textrank4zh-ts';
import { handleResult, logError } from 'textrank4zh-ts/utils';

const tr4w = new TextRankKeyword();

// analyze 方法返回 Result<void, TextRankError>
const result = tr4w.analyze('测试文本');

// 方式1：使用 handleResult 辅助函数
handleResult(
  result,
  () => {
    // 成功处理逻辑
    const keywords = tr4w.getKeywords();
    console.log('关键词:', keywords);
  },
  (error) => {
    // 错误处理逻辑
    logError(error, 'KeywordAnalysis');
  }
);

// 方式2：直接检查 Result
if (result.ok) {
  console.log('分析成功');
} else {
  const error = result.error!;
  console.error(`错误: ${error.type} - ${error.message}`);
  
  // 查看错误上下文
  if (error.context) {
    console.error('上下文:', error.context);
  }
  
  // 查看原始错误
  if (error.cause) {
    console.error('原因:', error.cause);
  }
}
```

#### 错误类型

```typescript
enum ErrorType {
  INITIALIZATION_ERROR,   // 初始化错误 - 分词器、Worker等初始化失败
  WORKER_ERROR,          // Worker 错误 - Worker创建、通信失败
  COMPUTATION_ERROR,     // 计算错误 - 算法执行过程中的错误
  SERIALIZATION_ERROR,   // 序列化错误 - 数据传输序列化失败
  VALIDATION_ERROR,      // 验证错误 - 输入参数验证失败
  NETWORK_ERROR,         // 网络错误 - Worker脚本加载失败
  TIMEOUT_ERROR,         // 超时错误 - 任务执行超时
  UNSUPPORTED_ERROR      // 不支持的操作 - 浏览器API不支持
}
```

#### Worker 错误处理

```typescript
import { TextRankUniversalClient } from 'textrank4zh-ts';

const client = new TextRankUniversalClient('./worker.js');

try {
  const result = await client.analyzeKeywords('测试文本');
  
  if (result.success) {
    console.log('分析成功:', result.data);
  } else {
    // Worker 内部错误
    console.error('Worker 错误:', result.error!);
  }
} catch (error) {
  // 客户端错误（网络、超时等）
  console.error('客户端错误:', error.message);
}
```

#### 自定义错误处理

```typescript
import { createError, ErrorType, safeSync } from 'textrank4zh-ts/utils';

// 创建自定义错误
const customError = createError(
  ErrorType.VALIDATION_ERROR,
  '自定义验证失败',
  undefined,
  { input: 'invalid data', expected: 'string' }
);

// 安全执行函数
const result = safeSync(() => {
  // 可能抛出异常的代码
  return JSON.parse(invalidJson);
}, ErrorType.SERIALIZATION_ERROR, { data: 'context info' });

if (!result.ok) {
  console.error('执行失败:', result.error!);
}
```

#### 链式错误处理

```typescript
import { mapResult, chainResult, withDefault } from 'textrank4zh-ts/utils';

const tr4w = new TextRankKeyword();

// 链式处理
const finalResult = chainResult(
  tr4w.analyze('测试文本'),
  () => {
    // 分析成功后获取关键词
    const keywords = tr4w.getKeywords(5);
    return Result.ok(keywords);
  }
);

// 映射结果
const wordCount = mapResult(finalResult, keywords => keywords.length);

// 提供默认值
const count = withDefault(wordCount, 0);
console.log('关键词数量:', count);
```

## 开发

### 基础命令

```bash
# 安装依赖
npm install

# 开发构建（Vite 监听重建）
npm run dev

# 完整构建
npm run build

# 运行测试
npm test

# 类型检查
npm run typecheck

# 代码检查和格式化（oxlint + oxfmt）
npm run lint
npm run format
```

### 项目结构

```
src/
├── core/              # 核心算法实现
│   ├── segmentation.ts       # 文本分词和句子分割
│   ├── textrank-keyword.ts   # 关键词提取
│   └── textrank-sentence.ts  # 句子摘要
├── utils/             # 工具函数
│   ├── async-analysis.ts     # 异步分析执行器
│   ├── main-thread-scheduler.ts  # 主线程调度器
│   └── result-helpers.ts     # Result类型辅助函数
├── worker/            # Worker 多线程支持
└── types/             # TypeScript 类型定义
```

## 浏览器兼容性

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+
- 支持 ES2020 的现代浏览器

## 与 Node.js 版本的区别

| 特性 | Node.js 版本 | 浏览器版本 |
|-----|-------------|-----------|
| 中文分词 | nodejieba (C++ 绑定) | 内置轻量级分词器 |
| 外部依赖 | 需要 C++ 编译 | 零外部依赖 |
| 性能 | 高性能 | 良好性能 |
| 安装大小 | 较大 | 轻量级 |
| 运行环境 | Node.js only | 浏览器 + Node.js |
| 停用词 | 外部文件 | 内置数据 |
| 部署难度 | 较复杂 | 简单 |

## 🐛 常见问题

### Q: Worker 文件加载失败？
**A:** 检查文件路径和 CORS 设置。Worker 文件需要与页面同源或正确配置 CORS。

```javascript
// 确保路径正确
const client = new TextRankUniversalClient('./dist/index.worker.js');

// 检查浏览器开发者工具中的网络请求
```

### Q: IIFE 版本全局变量未定义？
**A:** 确认 `index.iife.js` 正确加载，全局变量名为 `TextRank4ZH`。

```html
<script src="./dist/index.iife.js"></script>
<script>
  console.log(window.TextRank4ZH); // 检查是否存在
  const { TextRankKeyword } = window.TextRank4ZH;
</script>
```

### Q: 构建后文件过大？
**A:** 检查是否有不必要的依赖被打包，考虑使用 `external` 配置排除。当前构建产物大小合理：
- 主库文件: ~100KB (包含所有功能)
- Worker文件: ~60KB (独立运行)

### Q: Node.js 环境导入失败？
**A:** 确认使用正确的文件格式并检查 `package.json` 配置。

```javascript
// ES Module (推荐)
import { TextRankKeyword } from 'textrank4zh-ts';

// CommonJS
const { TextRankKeyword } = require('textrank4zh-ts');
```

### Q: TypeScript 类型提示不工作？
**A:** 确认项目包含类型定义文件 `dist/index.d.ts`，并检查 TypeScript 配置。

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "types": ["node"]
  }
}
```

### Q: 浏览器兼容性问题？
**A:** 项目需要 ES2020+ 支持。对于老版本浏览器，考虑使用 Babel 转译：

```javascript
// 检查浏览器支持
if (typeof Worker === 'undefined') {
  console.warn('当前浏览器不支持 Worker');
  // 使用同步模式
}
```

## 分词器

库内置一份 2658 条的常用词表（2–4 字），采用正向最大匹配。它覆盖日常与常见技术词汇，
但**不是完整词典**：词表外的中文会退化为逐字切分，而 TextRank 依赖词语共现构图，
这会直接影响提取质量。

对分词质量要求较高时，可通过 `tokenizer` 注入专业分词库（不使用内置词表）：

```typescript
import nodejieba from 'nodejieba';

const tr4w = new TextRankKeyword({
  tokenizer: (text) => nodejieba.cut(text),
});
```

注入的分词器只需返回 `string[]`。由于该形式不携带词性，内部会将所有词标记为 `n`（名词），
因此 `allowSpeechTags` 过滤在此模式下不会误删词。

## 算法原理

TextRank算法基于Google的PageRank算法，将文本中的词语或句子看作图中的节点，通过计算节点的重要性来提取关键词或关键句子。

### 关键词提取
1. 将文本分割为句子，并对每个句子进行分词
2. 过滤停用词和指定词性的词语
3. 构建词语共现图，滑动窗口内的词语之间建立边
4. 使用PageRank算法计算每个词语的重要性分数
5. 按分数排序，提取top-k个关键词

### 句子摘要
1. 将文本分割为句子，并对每个句子进行分词
2. 计算句子之间的相似度，构建句子关系图
3. 使用PageRank算法计算每个句子的重要性分数
4. 按分数排序，提取top-k个重要句子作为摘要

## 依赖

### 运行时依赖
- `typescript-result@^3.5.2` - 函数式错误处理

### 开发依赖
- TypeScript: 类型支持
- Vite: 构建工具（内置 rolldown 打包器）
- unplugin-dts + api-extractor: 类型声明生成
- vitest: 测试框架
- oxlint + oxfmt: 代码质量保证

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 致谢

本项目参考了[TextRank4ZH](https://github.com/someus/TextRank4ZH)的实现思路，特此致谢。

### 数据来源

内置常用词表（2658 条）取自以下两个 MIT 项目，完整许可证见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)：

- [jieba](https://github.com/fxsjy/jieba) — Copyright (c) 2013 Sun Junyi
- [HSK 3.0 词表](https://github.com/elkmovie/hsk30) — Copyright (c) 2021 Pleco Inc.，源自教育部《国际中文教育中文水平等级标准》(GF 0025-2021)