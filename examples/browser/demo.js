// 导入 TextRank4ZH-TS 库
// 在实际部署时，这里应该是从 CDN 或构建后的文件导入
// import { TextRankKeyword, TextRankSentence } from '../../dist/index.mjs';

// 临时的简化实现用于演示
class SimpleTextRank {
  constructor() {
    this.stopWords = new Set([
      '的', '了', '在', '是', '和', '有', '我', '你', '他', '她', '它', '们',
      '这', '那', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
      '个', '只', '张', '本', '也', '都', '就', '还', '又', '再', '很', '非常',
      '不', '没', '没有', '可以', '能够', '应该', '需要', '想要', '希望',
      '因为', '所以', '但是', '如果', '虽然', '然而', '而且', '或者', '以及',
      '？', '！', '。', '，', '：', '；', '"', '"', '（', '）', '【', '】'
    ]);
  }

  // 简单的中文分词
  segmentText(text) {
    // 基础的字符级分词，实际项目中会使用更复杂的算法
    const sentences = text.split(/[。！？；\n]+/).filter(s => s.trim().length > 0);
    const words = [];
    
    for (let sentence of sentences) {
      const sentenceWords = [];
      let currentWord = '';
      
      for (let char of sentence) {
        if (this.isChinese(char)) {
          if (currentWord && !this.isChinese(currentWord[currentWord.length - 1])) {
            if (currentWord.trim() && !this.stopWords.has(currentWord.trim())) {
              sentenceWords.push(currentWord.trim());
            }
            currentWord = '';
          }
          currentWord += char;
          
          // 单个汉字也作为一个词
          if (currentWord.length === 1 || this.isCommonWord(currentWord)) {
            if (!this.stopWords.has(currentWord)) {
              sentenceWords.push(currentWord);
            }
            currentWord = '';
          }
        } else if (this.isEnglish(char) || this.isDigit(char)) {
          currentWord += char;
        } else {
          if (currentWord.trim() && !this.stopWords.has(currentWord.trim())) {
            sentenceWords.push(currentWord.trim());
          }
          currentWord = '';
        }
      }
      
      if (currentWord.trim() && !this.stopWords.has(currentWord.trim())) {
        sentenceWords.push(currentWord.trim());
      }
      
      if (sentenceWords.length > 0) {
        words.push(sentenceWords);
      }
    }
    
    return { sentences, words };
  }

  // 提取关键词
  extractKeywords(text, num = 10) {
    const { words } = this.segmentText(text);
    const wordCount = {};
    const wordCooccurrence = {};
    
    // 统计词频
    for (let sentenceWords of words) {
      for (let word of sentenceWords) {
        wordCount[word] = (wordCount[word] || 0) + 1;
        if (!wordCooccurrence[word]) wordCooccurrence[word] = new Set();
      }
    }
    
    // 统计共现
    for (let sentenceWords of words) {
      for (let i = 0; i < sentenceWords.length; i++) {
        for (let j = Math.max(0, i - 2); j <= Math.min(sentenceWords.length - 1, i + 2); j++) {
          if (i !== j) {
            wordCooccurrence[sentenceWords[i]].add(sentenceWords[j]);
          }
        }
      }
    }
    
    // 计算简单的重要性分数
    const scores = {};
    for (let word in wordCount) {
      scores[word] = wordCount[word] * (1 + wordCooccurrence[word].size * 0.1);
    }
    
    // 排序并返回前N个
    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, num)
      .map(([word, score]) => ({ word, weight: score / 100 }));
  }

  // 提取关键句子
  extractSentences(text, num = 3) {
    const { sentences, words } = this.segmentText(text);
    if (sentences.length <= num) {
      return sentences.map((sentence, index) => ({ 
        index, 
        sentence, 
        weight: 1 / (index + 1) 
      }));
    }
    
    const sentenceScores = [];
    const keywords = this.extractKeywords(text, 20).map(k => k.word);
    const keywordSet = new Set(keywords);
    
    // 计算句子分数
    for (let i = 0; i < sentences.length; i++) {
      const sentenceWords = words[i] || [];
      let score = 0;
      
      // 基于关键词密度计算分数
      for (let word of sentenceWords) {
        if (keywordSet.has(word)) {
          score += 1;
        }
      }
      
      // 位置权重：开头和结尾的句子权重较高
      const positionWeight = i === 0 ? 1.2 : (i === sentences.length - 1 ? 1.1 : 1);
      score = score * positionWeight / Math.max(1, sentenceWords.length);
      
      sentenceScores.push({ index: i, sentence: sentences[i], weight: score });
    }
    
    // 排序并返回前N个
    return sentenceScores
      .sort((a, b) => b.weight - a.weight)
      .slice(0, num);
  }

  // 生成关键短语
  extractKeyphrases(text, keywordsNum = 20, minOccur = 1) {
    const keywords = this.extractKeywords(text, keywordsNum).map(k => k.word);
    const keywordSet = new Set(keywords);
    const { words } = this.segmentText(text);
    const phrases = new Set();
    
    for (let sentenceWords of words) {
      let currentPhrase = [];
      
      for (let word of sentenceWords) {
        if (keywordSet.has(word)) {
          currentPhrase.push(word);
        } else {
          if (currentPhrase.length > 1) {
            phrases.add(currentPhrase.join(''));
          }
          currentPhrase = [];
        }
      }
      
      if (currentPhrase.length > 1) {
        phrases.add(currentPhrase.join(''));
      }
    }
    
    // 过滤出现次数
    return Array.from(phrases).filter(phrase => {
      return (text.match(new RegExp(phrase, 'g')) || []).length >= minOccur;
    });
  }

  isChinese(char) {
    return /[\u4e00-\u9fa5]/.test(char);
  }

  isEnglish(char) {
    return /[a-zA-Z]/.test(char);
  }

  isDigit(char) {
    return /[0-9]/.test(char);
  }

  isCommonWord(word) {
    const commonWords = [
      '人工智能', '自然语言', '机器学习', '深度学习', '文本分析',
      '中华人民共和国', '北京', '上海', '广州', '深圳', '杭州',
      '经济发展', '改革开放', '科学技术', '教育事业'
    ];
    return commonWords.some(w => w.includes(word) || word.includes(w));
  }
}

// 全局变量
let textRank = null;

// 示例文本
const sampleTexts = [
  `北京是中华人民共和国的首都，是全国政治中心、文化中心。上海是中华人民共和国直辖市，是中国最大的经济中心。深圳是中国改革开放的前沿城市，经济发展迅速。广州是广东省省会，是华南地区的经济中心。杭州是浙江省省会，以风景秀丽著称。`,
  
  `人工智能技术在自然语言处理领域取得了重大突破。机器学习和深度学习推动了人工智能的快速发展。神经网络模型能够理解复杂的语言结构和语义信息。文本分析、语音识别、图像处理等应用场景不断涌现。未来人工智能将在更多领域发挥重要作用。`,
  
  `中国的教育事业蓬勃发展，各级各类学校办学条件不断改善。高等教育进入普及化发展阶段，教育质量稳步提升。职业教育体系日趋完善，为经济社会发展培养了大批技能人才。基础教育均衡发展，城乡教育差距逐步缩小。`
];

// 初始化
window.addEventListener('DOMContentLoaded', function() {
  textRank = new SimpleTextRank();
  console.log('TextRank4ZH-TS 浏览器演示已加载');
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

  showLoading();
  hideError();
  hideResults();

  try {
    // 获取配置
    const keywordNum = parseInt(document.getElementById('keywordNum').value);
    const sentenceNum = parseInt(document.getElementById('sentenceNum').value);
    const windowSize = parseInt(document.getElementById('windowSize').value);
    const minWordLen = parseInt(document.getElementById('minWordLen').value);

    // 模拟异步处理
    await new Promise(resolve => setTimeout(resolve, 500));

    // 提取关键词
    const keywords = textRank.extractKeywords(text, keywordNum)
      .filter(k => k.word.length >= minWordLen);
    
    // 提取关键短语
    const keyphrases = textRank.extractKeyphrases(text, keywordNum * 2, 1);
    
    // 提取重要句子
    const keySentences = textRank.extractSentences(text, sentenceNum);
    
    // 生成摘要
    const summary = keySentences
      .sort((a, b) => a.index - b.index)
      .map(s => s.sentence)
      .join('');

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