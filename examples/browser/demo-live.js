// 使用实际构建的 TextRank4ZH-TS 库
import { TextRankKeyword, TextRankSentence } from '../../dist/index.mjs';

// 全局变量
let keywordAnalyzer = null;
let sentenceAnalyzer = null;

// 示例文本
const sampleTexts = [
  `北京是中华人民共和国的首都，是全国政治中心、文化中心。上海是中华人民共和国直辖市，是中国最大的经济中心。深圳是中国改革开放的前沿城市，经济发展迅速。广州是广东省省会，是华南地区的经济中心。杭州是浙江省省会，以风景秀丽著称。`,
  
  `人工智能技术在自然语言处理领域取得了重大突破。机器学习和深度学习推动了人工智能的快速发展。神经网络模型能够理解复杂的语言结构和语义信息。文本分析、语音识别、图像处理等应用场景不断涌现。未来人工智能将在更多领域发挥重要作用。`,
  
  `中国的教育事业蓬勃发展，各级各类学校办学条件不断改善。高等教育进入普及化发展阶段，教育质量稳步提升。职业教育体系日趋完善，为经济社会发展培养了大批技能人才。基础教育均衡发展，城乡教育差距逐步缩小。`
];

// 初始化
window.addEventListener('DOMContentLoaded', function() {
  try {
    keywordAnalyzer = new TextRankKeyword();
    sentenceAnalyzer = new TextRankSentence();
    console.log('TextRank4ZH-TS 已成功加载，使用实际构建版本');
  } catch (error) {
    console.error('TextRank4ZH-TS 加载失败:', error);
    showError('库加载失败，请检查网络连接或刷新页面重试');
  }
});

// 加载示例文本
window.loadSampleText = function() {
  const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
  document.getElementById('inputText').value = randomText;
};

// 清空文本
window.clearText = function() {
  document.getElementById('inputText').value = '';
  hideResults();
};

// 分析文本
window.analyzeText = async function() {
  const text = document.getElementById('inputText').value.trim();
  
  if (!text) {
    showError('请输入要分析的文本');
    return;
  }

  if (!keywordAnalyzer || !sentenceAnalyzer) {
    showError('TextRank4ZH-TS 库尚未加载完成，请稍候重试');
    return;
  }

  showLoading();
  hideError();
  hideResults();

  try {
    // 获取配置
    const keywordNum = parseInt(document.getElementById('keywordNum').value);
    const sentenceNum = parseInt(document.getElementById('sentenceNum').value);
    const windowSize = parseInt(document.getElementById('windowSize').value);
    const minWordLen = parseInt(document.getElementById('minWordLen').value);

    // 关键词分析
    const keywordResult = keywordAnalyzer.analyze(text, {
      window: windowSize,
      lower: true,
      vertexSource: 'all_filters',
      edgeSource: 'no_stop_words'
    });
    
    if (!keywordResult.ok) {
      throw new Error('关键词分析失败: ' + keywordResult.error.message);
    }
    
    const keywords = keywordAnalyzer.getKeywords(keywordNum, minWordLen);
    const keyphrases = keywordAnalyzer.getKeyphrases(keywordNum * 2, 2);

    // 句子分析
    sentenceAnalyzer.analyze(text, {
      lower: true,
      source: 'no_stop_words'
    });
    
    const keySentences = sentenceAnalyzer.getKeySentences(sentenceNum);
    const summary = sentenceAnalyzer.getSummary(sentenceNum, 10, true);

    // 显示结果
    displayResults({
      text,
      keywords,
      keyphrases,
      sentences: keySentences,
      summary,
      stats: {
        textLength: text.length,
        keywordsCount: keywords.length,
        keyphrasesCount: keyphrases.length,
        sentencesCount: keySentences.length
      }
    });

    hideLoading();
    showResults();

  } catch (error) {
    console.error('分析过程中出现错误:', error);
    showError('分析过程中出现错误: ' + error.message);
    hideLoading();
  }
};

// 显示结果
function displayResults(results) {
  // 显示统计信息
  const statsHtml = `
    <div class="stat-item">
      <span class="stat-number">${results.stats.textLength}</span>
      <div class="stat-label">文本字符数</div>
    </div>
    <div class="stat-item">
      <span class="stat-number">${results.stats.keywordsCount}</span>
      <div class="stat-label">关键词数量</div>
    </div>
    <div class="stat-item">
      <span class="stat-number">${results.stats.keyphrasesCount}</span>
      <div class="stat-label">关键短语数量</div>
    </div>
    <div class="stat-item">
      <span class="stat-number">${results.stats.sentencesCount}</span>
      <div class="stat-label">重要句子数量</div>
    </div>
  `;
  document.getElementById('textStats').innerHTML = statsHtml;

  // 显示关键词
  const keywordsHtml = results.keywords
    .map(k => `<span class="keyword-item">${k.word} (${k.weight.toFixed(3)})</span>`)
    .join('');
  document.getElementById('keywordsList').innerHTML = keywordsHtml;

  // 显示关键短语
  const keyphrasesHtml = results.keyphrases
    .map(p => `<span class="keyword-item">${p}</span>`)
    .join('');
  document.getElementById('keyphrasesList').innerHTML = keyphrasesHtml || '<span class="keyword-item">未找到关键短语</span>';

  // 显示重要句子
  const sentencesHtml = results.sentences
    .map(s => `
      <div class="sentence-item">
        <div class="sentence-meta">权重: ${s.weight.toFixed(3)} | 位置: ${s.index + 1}</div>
        <div>${s.sentence}</div>
      </div>
    `)
    .join('');
  document.getElementById('sentencesList').innerHTML = sentencesHtml;

  // 显示摘要
  document.getElementById('summaryText').textContent = results.summary || '无法生成摘要';
}

// 显示/隐藏相关函数
function showLoading() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('analyzeBtn').disabled = true;
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('analyzeBtn').disabled = false;
}

function showResults() {
  document.getElementById('results').style.display = 'block';
}

function hideResults() {
  document.getElementById('results').style.display = 'none';
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function hideError() {
  document.getElementById('error').style.display = 'none';
}