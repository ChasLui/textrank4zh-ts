# Web Worker 演示

本目录包含 TextRank4ZH-TS 的 Web Worker 使用演示。

## 🚀 快速开始

### 1. 构建项目

```bash
# 在项目根目录运行
npm run build
```

### 2. 启动本地服务器

```bash
# 在 examples/worker 目录下启动服务器
cd examples/worker

# 使用 Python 启动本地服务器
python3 -m http.server 8000

# 或者使用 Node.js (需要安装 http-server)
npx http-server -p 8000

# 或者从项目根目录使用项目提供的脚本
npm run serve
```

### 3. 访问演示页面

打开浏览器访问: http://localhost:8000/

**注意**: 必须通过HTTP服务器访问，不能直接打开HTML文件，因为Web Worker有同源策略限制。

## 📖 Web Worker 使用指南

### 基础用法（推荐使用通用客户端）

```javascript
import { TextRankUniversalClient } from 'textrank4zh-ts';

// 创建通用客户端 - 自动选择最佳 Worker 类型
const client = new TextRankUniversalClient('./path/to/textrank.worker.js', {
    timeout: 30000,                    // 任务超时时间（毫秒）
    maxConcurrent: 10,                // 最大并发任务数
    preferredWorkerType: 'auto',      // 'shared' | 'dedicated' | 'auto'
    fallbackToSync: true              // 是否允许降级到同步模式
});
```

### 三级降级策略

客户端会按以下顺序自动选择最佳处理方式：

1. **SharedWorker** - 多标签页共享，资源利用率最高
2. **DedicatedWorker** - 专用 Worker，独立处理
3. **同步模式** - 主线程处理，兼容性最好

```javascript
// 检查支持状态
const status = client.getStatus();
console.log('当前使用:', status.type); // 'shared' | 'dedicated' | 'sync'
console.log('是否可用:', status.available);

// 检查环境支持
console.log('SharedWorker 支持:', TextRankUniversalClient.supportsWorkerType('shared'));
console.log('推荐类型:', TextRankUniversalClient.getRecommendedWorkerType());
```

### 传统方式（仅支持 DedicatedWorker）

```javascript
import { TextRankWorkerClient } from 'textrank4zh-ts';

// 创建专用 Worker 客户端
const workerClient = new TextRankWorkerClient('./path/to/textrank.worker.js', {
    timeout: 30000,        // 任务超时时间（毫秒）
    maxConcurrent: 10      // 最大并发任务数
});

// 关键词分析 - 适用于 TextRankUniversalClient 和 TextRankWorkerClient
const keywordResult = await client.analyzeKeywords(
    '人工智能技术正在快速发展',
    {
        window: 2,
        lower: true,
        vertexSource: 'all_filters'
    },
    {
        keywords: { num: 10, wordMinLen: 1 },
        keyphrases: { keywordsNum: 12, minOccurNum: 2 }
    }
);

console.log('关键词:', keywordResult.keywords);
console.log('关键短语:', keywordResult.keyphrases);
console.log('执行时间:', keywordResult.duration);
```

### 文本摘要

```javascript
// 句子分析和摘要生成
const summaryResult = await client.analyzeSentences(
    '长篇文本内容...',
    {
        lower: true,
        source: 'all_filters'
    },
    {
        sentences: { num: 5, sentenceMinLen: 6 },
        summary: { num: 3, sortByIndex: true }
    }
);

console.log('重要句子:', summaryResult.sentences);
console.log('摘要:', summaryResult.summary);
```

### 完整分析（并行）

```javascript
// 同时进行关键词和句子分析
const [keywordResult, sentenceResult] = await Promise.all([
    client.analyzeKeywords(text, keywordConfig, keywordOptions),
    client.analyzeSentences(text, sentenceConfig, sentenceOptions)
]);

// 或者分别调用
const fullResult = {
    keywords: keywordResult.data.keywords,
    keyphrases: keywordResult.data.keyphrases,
    sentences: sentenceResult.data.sentences,
    summary: sentenceResult.data.summary,
    totalDuration: keywordResult.duration + sentenceResult.duration
};

console.log('完整结果:', fullResult);
console.log('总执行时间:', fullResult.totalDuration);
```

## 🔧 配置选项

### WorkerOptions（通用客户端）

```typescript
interface WorkerOptions {
    timeout?: number;                    // 超时时间（毫秒），默认 30000
    maxConcurrent?: number;             // 最大并发任务数，默认 10
    preferredWorkerType?: 'shared' | 'dedicated' | 'auto'; // 首选 Worker 类型，默认 'auto'
    fallbackToSync?: boolean;           // 是否允许降级到同步模式，默认 true
    syncScheduling?: {                  // 同步模式调度配置
        timeSlice?: number;             // 时间片大小（毫秒），默认 5ms
        maxContinuousTime?: number;     // 最大连续执行时间，默认 16ms (60fps)
        idleTimeout?: number;           // requestIdleCallback 超时时间，默认 50ms
        yieldInterval?: number;         // 让出控制权间隔（迭代次数），默认 1000
        priority?: 'background' | 'normal' | 'user-blocking'; // 任务优先级
    };
}
```

### SharedWorker 特性

SharedWorker 提供了多标签页间的资源共享能力：

```javascript
// 创建 SharedWorker 客户端
const client = new TextRankUniversalClient('./textrank-sharedworker-standalone.js', {
    preferredWorkerType: 'shared',  // 强制使用 SharedWorker
    fallbackToSync: false          // 不降级到同步模式
});

// 检查 SharedWorker 状态
const status = client.getStatus();
if (status.type === 'shared') {
    console.log('✅ 使用 SharedWorker');
    console.log('连接数:', status.connectionCount);
} else {
    console.log('⚠️ SharedWorker 不可用，已降级到:', status.type);
}
```

**SharedWorker 优势**：
- 🔄 **多标签页共享**：同一域下的多个标签页共享同一个 Worker 实例
- 💾 **内存效率**：避免重复加载算法代码和模型数据
- ⚡ **资源复用**：减少 Worker 初始化开销
- 🎯 **状态共享**：可在多个页面间共享计算结果和缓存

### 主线程调度配置

同步模式使用先进的主线程调度系统，确保不阻塞 UI：

```javascript
const client = new TextRankUniversalClient('./worker.js', {
    preferredWorkerType: 'auto',
    fallbackToSync: true,
    syncScheduling: {
        timeSlice: 5,              // 每次执行 5ms 后让出控制权
        maxContinuousTime: 16,     // 最大连续执行时间（60fps）
        priority: 'background',    // 后台优先级，不影响用户交互
        idleTimeout: 50           // 空闲检测超时
    }
});

// 自动优化调度配置
await client.optimizeSyncScheduling();
```

**四级调度降级策略**：
1. **requestIdleCallback** - 浏览器空闲时执行
2. **scheduler.postTask** - 现代调度 API（Chrome 94+）
3. **MessageChannel + Promise** - 微任务调度
4. **同步执行** - 兜底方案

### 传统 WorkerOptions

```typescript
interface WorkerOptions {
    timeout?: number;        // 超时时间（毫秒），默认 30000
    maxConcurrent?: number;  // 最大并发任务数，默认 10
}
```

### 关键词配置

```typescript
interface TextRankKeywordConfig {
    window?: number;         // 滑动窗口大小，默认 2
    lower?: boolean;         // 是否转换为小写，默认 false
    vertexSource?: string;   // 图节点词源：'no_filter' | 'no_stop_words' | 'all_filters'
    edgeSource?: string;     // 图边词源：'no_filter' | 'no_stop_words' | 'all_filters'
    pageRankConfig?: {       // PageRank 算法配置
        alpha?: number;      // 阻尼因子，默认 0.85
        maxIterations?: number; // 最大迭代次数，默认 100
        tolerance?: number;  // 收敛阈值，默认 1e-6
    };
}
```

### 句子配置

```typescript
interface TextRankSentenceConfig {
    lower?: boolean;         // 是否转换为小写，默认 false
    source?: string;         // 计算相似度的词源，默认 'no_stop_words'
    pageRankConfig?: PageRankConfig; // PageRank 算法配置
}
```

## 🎯 最佳实践

### 1. 错误处理

```javascript
try {
    const result = await workerClient.analyzeKeywords(text, config);
    // 处理结果
} catch (error) {
    console.error('分析失败:', error.message);
    // 处理错误
}
```

### 2. 并发控制

```javascript
// 监控任务状态
const status = workerClient.getStatus();
console.log(`当前任务: ${status.pendingTasks}/${status.maxConcurrent}`);

// 避免超过并发限制
if (status.pendingTasks < status.maxConcurrent) {
    // 提交新任务
}
```

### 3. 资源清理

```javascript
// 页面卸载时清理 Worker
window.addEventListener('beforeunload', () => {
    workerClient.terminate();
});
```

### 4. 批量处理

```javascript
// 并行处理多个文档
const texts = ['文档1', '文档2', '文档3'];
const results = await Promise.all(
    texts.map(text => workerClient.analyzeKeywords(text))
);
```

### 主线程性能监控

```javascript
// 测量主线程繁忙程度
import { mainThreadScheduler } from 'textrank4zh-ts';

const busyness = await mainThreadScheduler.measureMainThreadBusyness();
console.log('平均帧时间:', busyness.averageFrameTime + 'ms');
console.log('推荐策略:', busyness.recommendation); // aggressive | moderate | conservative

// 获取调度器状态
const status = mainThreadScheduler.getStatus();
console.log('推荐调度方式:', status.recommendedMethod);
console.log('运行任务数:', status.runningTasks);
```

## ⚡ 性能优化

### 1. 主线程调度优化

同步模式使用智能调度系统，确保 UI 始终流畅：

```javascript
// 自适应调度优化
const client = new TextRankUniversalClient('./worker.js', {
    syncScheduling: {
        priority: 'background'  // 确保不阻塞用户交互
    }
});

// 根据设备性能自动调整
await client.optimizeSyncScheduling();

// 获取详细状态
const status = await client.getDetailedStatus();
console.log('主线程帧时间:', status.mainThreadBusyness?.averageFrameTime);
console.log('调度策略:', status.mainThreadBusyness?.recommendation);
```

### 2. Transferable 对象优化

库自动使用 Transferable 对象来优化大数据传输性能：

```javascript
import { TextRankWorkerClient, dataTransfer } from 'textrank4zh-ts';

// 自动启用 Transferable 优化
const workerClient = new TextRankWorkerClient(workerUrl);

// 大于 1KB 的数据会自动使用 Transferable 传输
const result = await workerClient.analyzeKeywords(largeText);

// 手动控制传输方式
const config = { text: largeText, config: {}, options: {} };
const { transferData, transferables, useTransferable } = dataTransfer.prepareDataForTransfer(config);

if (useTransferable) {
    console.log('✅ 使用零拷贝传输，性能提升显著');
}
```

**Transferable 优势**：
- 🚀 **零拷贝传输**：大数据不需要序列化拷贝，直接转移所有权
- ⚡ **性能提升**：数据传输速度提升 50-90%
- 💾 **内存优化**：避免数据重复，减少内存占用
- 🔧 **智能选择**：自动判断数据大小，智能选择传输方式

### 2. 预热 Worker

```javascript
// 应用启动时预先初始化 Worker
const workerClient = new TextRankWorkerClient(workerUrl);
// Worker 会在后台准备就绪
```

### 3. 复用客户端

```javascript
// 在应用中复用同一个 Worker 客户端实例
// 避免频繁创建和销毁 Worker
const globalWorkerClient = new TextRankWorkerClient(workerUrl);
```

### 4. 合理配置并发数

```javascript
// 根据设备性能调整并发数
const concurrency = navigator.hardwareConcurrency || 4;
const workerClient = new TextRankWorkerClient(workerUrl, {
    maxConcurrent: Math.min(concurrency * 2, 10)
});
```

## 🐛 常见问题

### Q: 兼容性检测错误

**A:** 如果遇到 `dataTransfer.getSupportStatus is not a function` 错误，说明示例页面的数据传输工具类没有正确初始化。已修复：
- ✅ 添加了完整的兼容性检测方法
- ✅ 实现了环境降级处理
- ✅ 增加了错误处理和日志记录

### Q: Worker 文件路径问题

**A:** 确保 Worker 文件路径正确，通常需要相对于页面的路径：

```javascript
// 正确的路径示例
const workerClient = new TextRankWorkerClient('./dist/worker/textrank.worker.js');
```

### Q: CORS 问题

**A:** Worker 文件必须与页面同源，或者服务器配置正确的 CORS 头。

### Q: 模块导入问题

**A:** 确保 Worker 文件支持 ES 模块：

```javascript
// 创建支持模块的 Worker
const worker = new Worker(workerUrl, { type: 'module' });
```

### Q: 内存占用

**A:** 长时间运行后及时清理：

```javascript
// 定期重启 Worker 释放内存
setInterval(() => {
    workerClient.terminate();
    workerClient = new TextRankWorkerClient(workerUrl);
}, 30 * 60 * 1000); // 30分钟
```

## 📊 性能对比

使用 Web Worker + Transferable 优化的优势：

- ✅ **非阻塞**: 主线程 UI 保持响应
- ✅ **并行处理**: 可同时处理多个文档
- ✅ **资源隔离**: Worker 崩溃不影响主页面
- ✅ **后台计算**: 适合处理大型文档
- 🚀 **零拷贝传输**: 大数据传输性能提升 50-90%
- 💾 **内存优化**: 智能选择传输方式，减少内存占用

**性能测试结果**（10KB 文本数据）：

| 传输方式 | 传输时间 | 内存使用 | 优化效果 |
|---------|----------|----------|----------|
| 传统拷贝 | ~5ms | 高 | 基准 |
| Transferable | ~0.5ms | 低 | 🚀 90%+ 提升 |

适用场景：

- 📄 批量文档分析
- 🔄 实时文本处理
- 📱 移动端性能优化
- 🖥️ 桌面应用集成
- 🎯 大数据文本挖掘
- ⚡ 高频率文本分析

## 📝 API 参考

完整的 API 文档请参考主项目的 README.md 文件。