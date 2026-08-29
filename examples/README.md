# 使用示例

本目录包含 TextRank4ZH-TS 的使用示例。

## 📁 目录结构

```
examples/
├── index.html        # 演示中心首页（部署后即 GitHub Pages 根页面）
├── browser/          # 浏览器演示
│   ├── index.html   # 演示页面
│   ├── demo.js      # 演示逻辑
│   └── README.md    # 浏览器演示说明
├── worker/           # Web Worker 三级降级演示
├── build-usage/      # 构建集成与 CDN 引入示例
└── README.md         # 本文件
```

> 本目录会被 `deploy-pages.yml` 原样 `cp` 到站点根目录，因此这里的文件即线上演示的实际内容，可直接用 `pnpm run serve` 或任意静态服务器本地预览。

## 🌐 浏览器演示

进入 `browser/` 目录查看完整的浏览器演示：

```bash
# 启动本地服务器
npm run test:browser

# 或者手动启动
cd examples/browser
python3 -m http.server 8000
```

然后访问 http://localhost:8000

## 📚 API 使用示例

### 基础用法

```typescript
import { TextRankKeyword, TextRankSentence } from 'textrank4zh-ts';

// 文本
const text = '北京是中华人民共和国的首都，是全国政治中心、文化中心。上海是中华人民共和国直辖市，是中国最大的经济中心。';

// 关键词提取
const tr4w = new TextRankKeyword();
tr4w.analyze(text, {
  lower: true,
  window: 2
});

const keywords = tr4w.getKeywords(10, 1);
console.log('关键词:', keywords);

// 文本摘要
const tr4s = new TextRankSentence();
tr4s.analyze(text, {
  lower: true,
  source: 'all_filters'
});

const sentences = tr4s.getKeySentences(3);
console.log('重要句子:', sentences);
```

### 高级配置

```typescript
import { TextRankKeyword } from 'textrank4zh-ts';

const tr4w = new TextRankKeyword({
  stopWords: ['自定义', '停用词'], // 自定义停用词
  allowSpeechTags: ['n', 'v', 'a'], // 允许的词性
});

tr4w.analyze(text, {
  lower: true,
  window: 3,
  vertexSource: 'all_filters',
  edgeSource: 'no_stop_words',
  pageRankConfig: {
    alpha: 0.85,
    maxIterations: 100,
    tolerance: 1e-6
  }
});
```

### 浏览器中使用

#### 方式1: CDN + IIFE (推荐)

```html
<!DOCTYPE html>
<html>
<head>
  <title>TextRank4ZH-TS CDN 示例</title>
</head>
<body>
  <!-- 提供 typescript-result 兼容实现 -->
  <script>
    window.typescriptResult = {
      Result: class Result {
        constructor(ok, value, error) {
          this.ok = ok; this.value = value; this.error = error;
        }
        static ok(value) { return new this(true, value, null); }
        static error(error) { return new this(false, null, error); }
        isOk() { return this.ok; }
        isErr() { return !this.ok; }
      },
      ok: (value) => window.typescriptResult.Result.ok(value),
      err: (error) => window.typescriptResult.Result.error(error)
    };
  </script>
  
  <!-- 从 jsDelivr CDN 加载 IIFE 版本 (GitHub 源) -->
  <script src="https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.iife.js"></script>
  <script>
    // 使用全局变量 TextRank4ZH
    const { TextRankKeyword, TextRankSentence } = TextRank4ZH;
    
    const text = '你的中文文本';
    const tr4w = new TextRankKeyword();
    tr4w.analyze(text);
    console.log(tr4w.getKeywords(5));
  </script>
</body>
</html>
```

#### 方式2: CDN + ES Module

```html
<!DOCTYPE html>
<html>
<head>
  <title>TextRank4ZH-TS ES Module 示例</title>
</head>
<body>
  <script type="module">
    import { TextRankKeyword, TextRankSentence } from 'https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.mjs';
    
    const text = '你的中文文本';
    const tr4w = new TextRankKeyword();
    tr4w.analyze(text);
    console.log(tr4w.getKeywords(5));
  </script>
</body>
</html>
```

#### 可用的 CDN 地址

| 格式 | jsDelivr CDN URL (GitHub 源) |
|------|----------------------|
| IIFE | `https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.iife.js` |
| ES Module | `https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.mjs` |
| CommonJS | `https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.cjs` |
| Worker | `https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.worker.js` |
| SharedWorker | `https://cdn.jsdelivr.net/npm/textrank4zh-ts/dist/index.sharedworker.js` |

## 🧪 测试用例作为示例

项目中包含了详细的测试用例，这些测试用例也是很好的使用示例：

- `tests/integration.test.ts` - 集成测试，展示完整的使用流程
- `tests/real-world-scenarios.test.ts` - 真实业务场景示例
- `tests/performance.test.ts` - 性能测试和批量处理示例

### 运行测试查看示例

```bash
# 运行所有测试
npm test

# 监听模式运行测试
npm run test:watch

# 运行测试并查看UI
npm run test:ui
```

## 📖 更多用法

查看项目根目录的 `README.md` 获取完整的 API 文档和更多示例。