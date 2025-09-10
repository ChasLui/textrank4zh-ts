# 使用示例

本目录包含 TextRank4ZH-TS 的使用示例。

## 📁 目录结构

```
examples/
├── browser/          # 浏览器演示
│   ├── index.html   # 演示页面
│   ├── demo.js      # 演示逻辑
│   └── README.md    # 浏览器演示说明
└── README.md        # 本文件
```

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

```html
<!DOCTYPE html>
<html>
<head>
  <title>TextRank4ZH-TS 示例</title>
</head>
<body>
  <script type="module">
    import { TextRankKeyword, TextRankSentence } from 'https://unpkg.com/textrank4zh-ts/dist/index.mjs';
    
    const text = '你的中文文本';
    
    const tr4w = new TextRankKeyword();
    tr4w.analyze(text);
    console.log(tr4w.getKeywords(5));
  </script>
</body>
</html>
```

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