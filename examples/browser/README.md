# 浏览器演示

这个目录包含了 TextRank4ZH-TS 的浏览器演示。

## 运行演示

### 方法1: 使用 npm script
```bash
# 在项目根目录运行
npm run serve
```

然后打开浏览器访问 http://localhost:8000

### 方法2: 手动启动服务器
```bash
# 在项目根目录运行
python3 -m http.server 8000
# 或者
python -m SimpleHTTPServer 8000
```

### 方法3: 使用其他静态服务器
你也可以使用任何静态文件服务器，如：
- `npx serve .`
- `live-server`
- VS Code 的 Live Server 扩展

## 文件说明

- `index.html` - 演示页面的主要 HTML 文件
- `demo.js` - 演示的 JavaScript 代码
- `README.md` - 本说明文件

## 功能特性

### 文本分析
- 中文文本分词
- 关键词提取
- 关键短语识别
- 文本摘要生成

### 用户界面
- 响应式设计，支持移动端
- 实时配置调整
- 美观的结果展示
- 内置示例文本

### 配置选项
- 关键词数量调整
- 摘要句子数量设置
- 滑动窗口大小配置
- 最小词长过滤

## 注意事项

1. **演示版本**: 当前演示使用了简化的分词算法，实际库的功能更强大
2. **浏览器兼容性**: 支持现代浏览器 (Chrome 60+, Firefox 60+, Safari 12+)
3. **性能**: 对于大文本，建议先进行适当分段处理

## 使用实际库

要在你的项目中使用完整版本的 TextRank4ZH-TS，请参考以下代码：

```html
<!-- 通过 CDN 引入 -->
<script type="module">
  import { TextRankKeyword, TextRankSentence } from 'https://cdn.jsdelivr.net/gh/ChasLui/textrank4zh-ts/dist/index.mjs';
  
  const text = '你的中文文本';
  
  // 关键词提取
  const tr4w = new TextRankKeyword();
  tr4w.analyze(text, { lower: true, window: 2 });
  const keywords = tr4w.getKeywords(10);
  
  // 文本摘要
  const tr4s = new TextRankSentence();
  tr4s.analyze(text, { lower: true, source: 'all_filters' });
  const sentences = tr4s.getKeySentences(3);
</script>
```

或者使用 npm 安装：

```bash
npm install textrank4zh-ts
```

```javascript
import { TextRankKeyword, TextRankSentence } from 'textrank4zh-ts';

// 使用方式同上
```