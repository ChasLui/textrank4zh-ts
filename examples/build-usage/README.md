# 构建产物使用指南

首长，现在的构建系统已完全优化！支持多种使用场景，Worker 文件独立无依赖，便于直接复制使用。

## 📦 构建产物说明

### 主库文件
```
dist/
├── index.cjs                # CommonJS 格式 (Node.js)
├── index.mjs                # ES Module 格式 (现代构建工具)
├── index.iife.js            # IIFE 格式 (浏览器直接引入)
├── index.worker.js          # DedicatedWorker (独立文件)
└── index.sharedworker.js    # SharedWorker (独立文件)
```

### 关键特性
- ✅ **Worker 文件独立**：无 shared chunk，可直接复制到任何项目
- ✅ **IIFE 支持**：浏览器可直接通过 `<script>` 标签引入
- ✅ **多格式支持**：CJS、ESM、IIFE 全覆盖
- ✅ **依赖内联**：所有文件都包含完整依赖，开箱即用

## 🚀 使用方式

### 1. NPM 模块使用

```javascript
// ES Module
import { TextRankUniversalClient } from 'textrank4zh-ts';

// CommonJS  
const { TextRankUniversalClient } = require('textrank4zh-ts');

// 使用独立 Worker 文件
const client = new TextRankUniversalClient('./path/to/index.worker.js', {
    preferredWorkerType: 'auto',
    fallbackToSync: true
});
```

### 2. 浏览器直接引入 (IIFE)

```html
<!DOCTYPE html>
<html>
<head>
    <title>TextRank4ZH-TS 浏览器使用</title>
</head>
<body>
    <!-- 直接引入 IIFE 文件 -->
    <script src="./dist/index.iife.js"></script>
    <script>
        // 全局变量 TextRank4ZH 可直接使用
        const { TextRankUniversalClient, mainThreadScheduler } = TextRank4ZH;
        
        // 检查调度器支持
        console.log('调度器状态:', mainThreadScheduler.getStatus());
        
        // 创建客户端
        const client = new TextRankUniversalClient('./index.worker.js', {
            preferredWorkerType: 'auto',
            fallbackToSync: true,
            syncScheduling: {
                priority: 'background',
                timeSlice: 5
            }
        });
        
        // 使用
        client.initialize().then(async () => {
            const result = await client.analyzeKeywords('人工智能技术正在快速发展');
            console.log('关键词:', result.data.keywords);
        });
    </script>
</body>
</html>
```

### 3. Worker 文件复制使用

Worker 文件已完全独立，可直接复制到任何项目：

```bash
# 复制 Worker 文件到你的项目
cp dist/index.worker.js public/
cp dist/index.sharedworker.js public/

# 或者从 CDN 使用
# https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.worker.js
# https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.sharedworker.js
```

使用时无需担心依赖问题：

```javascript
// 所有依赖都已内联到 Worker 文件中
const client = new TextRankUniversalClient('/public/index.worker.js', {
    preferredWorkerType: 'shared'  // 优先使用 SharedWorker
});
```

## 🎯 不同场景推荐

### Node.js 后端
```javascript
const { TextRankKeyword } = require('textrank4zh-ts');

const tr4w = new TextRankKeyword();
tr4w.analyze(text, config);
const keywords = tr4w.getKeywords(10);
```

### 现代前端框架 (React, Vue, etc.)
```javascript
import { TextRankUniversalClient } from 'textrank4zh-ts';

// Worker 文件放在 public 目录
const client = new TextRankUniversalClient('/index.worker.js', {
    preferredWorkerType: 'auto',
    fallbackToSync: true
});
```

### 传统网页 (无构建工具)
```html
<script src="https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.iife.js"></script>
<script>
    const { TextRankKeyword, mainThreadScheduler } = TextRank4ZH;
    
    // 直接使用主线程模式
    const tr4w = new TextRankKeyword();
    
    // 或使用智能调度的同步模式
    const client = new TextRank4ZH.TextRankUniversalClient(null, {
        preferredWorkerType: 'auto',
        fallbackToSync: true
    });
</script>
```

### 高性能 Web 应用
```javascript
// 优先使用 SharedWorker 以获得最佳性能
const client = new TextRankUniversalClient('./index.sharedworker.js', {
    preferredWorkerType: 'shared',
    fallbackToSync: true,
    syncScheduling: {
        priority: 'background',
        timeSlice: 5,
        maxContinuousTime: 16
    }
});

// 自动优化调度配置
await client.optimizeSyncScheduling();

// 并行处理多个任务
const results = await Promise.all([
    client.analyzeKeywords(text1),
    client.analyzeSentences(text2),
    client.analyzeKeywords(text3)
]);
```

## 📊 性能对比

| 使用方式 | 文件大小 | 初始化时间 | 内存占用 | 适用场景 |
|---------|----------|-----------|----------|----------|
| Node.js CJS | 91.4KB | 快 | 低 | 后端处理 |
| 浏览器 IIFE | 98.2KB | 快 | 低 | 传统网页 |
| SharedWorker | 57.8KB | 中 | 最低 | 多标签页应用 |
| DedicatedWorker | 55.4KB | 中 | 中 | 单页面应用 |
| 同步模式 | - | 最快 | 中 | 小数据量处理 |

## 🔧 自定义配置示例

```javascript
// 完整配置示例
const client = new TextRankUniversalClient('./index.worker.js', {
    timeout: 30000,                    // 任务超时
    maxConcurrent: 10,                // 最大并发数
    preferredWorkerType: 'auto',      // Worker 类型偏好
    fallbackToSync: true,             // 允许降级
    syncScheduling: {                 // 同步模式配置
        timeSlice: 5,                 // 时间片 5ms
        maxContinuousTime: 16,        // 最大连续执行 16ms
        priority: 'background',       // 后台优先级
        idleTimeout: 50              // 空闲超时 50ms
    }
});

// 运行时优化
await client.optimizeSyncScheduling();

// 获取详细状态
const status = await client.getDetailedStatus();
console.log({
    workerType: status.type,
    mainThreadFrameTime: status.mainThreadBusyness?.averageFrameTime,
    schedulingMethod: status.schedulerStatus?.recommendedMethod
});
```

现在您的项目提供了完整的、生产就绪的构建产物，满足各种使用场景的需求！