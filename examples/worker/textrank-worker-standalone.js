/**
 * TextRank Web Worker 独立版本
 * 直接内联所有依赖，避免模块加载问题
 */

// 简化的中文分词器
class SimpleJieba {
  constructor() {
    this.stopWords = new Set([
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '上',
      '也',
      '很',
      '到',
      '说',
      '要',
      '去',
      '你',
      '会',
      '着',
      '没有',
      '看',
      '好',
      '自己',
      '这',
      '那',
      '个',
      '们',
      '他',
      '她',
      '它',
      '我们',
      '你们',
      '他们',
      '这个',
      '那个',
      '这些',
      '那些',
      '什么',
      '怎么',
      '为什么',
      '哪里',
      '哪个',
    ]);

    // 常用中文词汇
    this.commonWords = new Set([
      '人工智能',
      '机器学习',
      '深度学习',
      '自然语言',
      '计算机',
      '技术',
      '发展',
      '北京',
      '上海',
      '中国',
      '首都',
      '城市',
      '经济',
      '政治',
      '文化',
      '中心',
      '科技',
      '创新',
      '应用',
      '算法',
      '数据',
      '分析',
      '处理',
      '系统',
      '软件',
      '网络',
      '互联网',
      '信息',
      '智能',
      '自动',
      '识别',
      '语音',
      '图像',
      '视觉',
    ]);
  }

  cut(text) {
    if (!text || text.trim().length === 0) return [];

    // 简单的中文分词策略
    const words = [];
    let currentWord = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (this.isChinese(char)) {
        currentWord += char;

        // 检查是否是常用词的开始
        let longestMatch = currentWord;
        for (const word of this.commonWords) {
          if (word.startsWith(currentWord) && word.length > longestMatch.length) {
            // 尝试匹配更长的词
            const potential = text.substring(
              i - currentWord.length + 1,
              i + word.length - currentWord.length + 1
            );
            if (potential === word) {
              longestMatch = word;
            }
          }
        }

        if (longestMatch !== currentWord) {
          // 找到了更长的匹配
          words.push(longestMatch);
          i += longestMatch.length - currentWord.length;
          currentWord = '';
        } else if (currentWord.length >= 2) {
          // 检查当前词是否完整
          const nextChar = text[i + 1];
          if (!nextChar || !this.isChinese(nextChar) || this.commonWords.has(currentWord)) {
            words.push(currentWord);
            currentWord = '';
          }
        }
      } else {
        if (currentWord) {
          words.push(currentWord);
          currentWord = '';
        }

        if (this.isEnglish(char) || this.isNumber(char)) {
          let word = char;
          while (
            i + 1 < text.length &&
            (this.isEnglish(text[i + 1]) || this.isNumber(text[i + 1]))
          ) {
            word += text[++i];
          }
          if (word.length > 1) {
            words.push(word.toLowerCase());
          }
        }
      }
    }

    if (currentWord) {
      words.push(currentWord);
    }

    // 过滤停用词和短词
    return words.filter(
      (word) => word.length > 0 && !this.stopWords.has(word) && !this.isPunctuation(word)
    );
  }

  isChinese(char) {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df)
    );
  }

  isEnglish(char) {
    return /[a-zA-Z]/.test(char);
  }

  isNumber(char) {
    return /[0-9]/.test(char);
  }

  isPunctuation(char) {
    const punctuations = '。，！？；：""\'\'（）【】《》、·…—–';
    return punctuations.includes(char) || /[\p{P}]/u.test(char);
  }
}

// PageRank 算法实现
function pageRank(adjacencyMatrix, config = {}) {
  const { alpha = 0.85, maxIterations = 100, tolerance = 1e-6 } = config;
  const n = adjacencyMatrix.length;

  if (n === 0) {
    return { scores: [], iterations: 0 };
  }

  let scores = new Array(n).fill(1 / n);
  const newScores = new Array(n).fill(0);

  // 构建转移矩阵
  const transitionMatrix = adjacencyMatrix.map((row) => {
    const rowSum = row.reduce((sum, val) => sum + val, 0);
    return rowSum > 0 ? row.map((val) => val / rowSum) : row;
  });

  let iterations = 0;
  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    for (let i = 0; i < n; i++) {
      newScores[i] = (1 - alpha) / n;
      for (let j = 0; j < n; j++) {
        newScores[i] += alpha * transitionMatrix[j][i] * scores[j];
      }
    }

    // 检查收敛
    let converged = true;
    for (let i = 0; i < n; i++) {
      if (Math.abs(newScores[i] - scores[i]) > tolerance) {
        converged = false;
        break;
      }
    }

    scores = [...newScores];

    if (converged) {
      break;
    }
  }

  return { scores, iterations };
}

// TextRank 关键词提取
class TextRankKeyword {
  constructor() {
    this.jieba = new SimpleJieba();
    this.sentences = [];
    this.wordsNoFilter = [];
    this.wordsNoStopWords = [];
    this.wordsAllFilters = [];
  }

  analyze(text, config = {}) {
    const { window = 2, lower = false } = config;

    // 句子分割
    this.sentences = this.splitSentences(text);

    // 分词
    this.wordsNoFilter = this.sentences.map((sentence) => this.jieba.cut(sentence));
    this.wordsNoStopWords = this.wordsNoFilter.map((words) =>
      words.filter((word) => !this.jieba.stopWords.has(word))
    );
    this.wordsAllFilters = this.wordsNoStopWords.map((words) =>
      words.filter((word) => word.length >= 1)
    );

    // 处理大小写
    if (lower) {
      this.wordsAllFilters = this.wordsAllFilters.map((words) =>
        words.map((word) => word.toLowerCase())
      );
    }

    // 构建词汇图
    this.buildWordGraph(window);
  }

  splitSentences(text) {
    const delimiters = /[。！？；.!?;]/;
    return text
      .split(delimiters)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  buildWordGraph(window) {
    const allWords = this.wordsAllFilters.flat();
    const uniqueWords = [...new Set(allWords)];
    this.wordIndex = new Map(uniqueWords.map((word, i) => [word, i]));

    const n = uniqueWords.length;
    const matrix = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    // 构建共现矩阵
    for (const words of this.wordsAllFilters) {
      for (let i = 0; i < words.length; i++) {
        for (let j = Math.max(0, i - window); j < Math.min(words.length, i + window + 1); j++) {
          if (i !== j) {
            const idx1 = this.wordIndex.get(words[i]);
            const idx2 = this.wordIndex.get(words[j]);
            if (idx1 !== undefined && idx2 !== undefined) {
              matrix[idx1][idx2]++;
            }
          }
        }
      }
    }

    // 计算 PageRank
    const result = pageRank(matrix);
    this.wordScores = new Map(uniqueWords.map((word, i) => [word, result.scores[i]]));
  }

  getKeywords(num = 6, wordMinLen = 1) {
    if (!this.wordScores) return [];

    return Array.from(this.wordScores.entries())
      .filter(([word]) => word.length >= wordMinLen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, num)
      .map(([word, weight]) => ({ word, weight }));
  }

  getKeyphrases(keywordsNum = 12, minOccurNum = 2) {
    const keywords = this.getKeywords(keywordsNum).map((item) => item.word);
    const phrases = new Map();

    for (const words of this.wordsAllFilters) {
      for (let i = 0; i < words.length - 1; i++) {
        if (keywords.includes(words[i]) && keywords.includes(words[i + 1])) {
          const phrase = words[i] + words[i + 1];
          phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
        }
      }
    }

    return Array.from(phrases.entries())
      .filter(([, count]) => count >= minOccurNum)
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase);
  }
}

// TextRank 句子摘要
class TextRankSentence {
  constructor() {
    this.jieba = new SimpleJieba();
    this.sentences = [];
    this.wordsNoFilter = [];
    this.wordsNoStopWords = [];
    this.wordsAllFilters = [];
  }

  analyze(text, config = {}) {
    const { lower = false } = config;

    // 句子分割
    this.sentences = this.splitSentences(text);

    // 分词
    this.wordsNoFilter = this.sentences.map((sentence) => this.jieba.cut(sentence));
    this.wordsNoStopWords = this.wordsNoFilter.map((words) =>
      words.filter((word) => !this.jieba.stopWords.has(word))
    );
    this.wordsAllFilters = this.wordsNoStopWords.map((words) =>
      words.filter((word) => word.length >= 1)
    );

    // 处理大小写
    if (lower) {
      this.wordsAllFilters = this.wordsAllFilters.map((words) =>
        words.map((word) => word.toLowerCase())
      );
    }

    // 构建句子图
    this.buildSentenceGraph();
  }

  splitSentences(text) {
    const delimiters = /[。！？；.!?;]/;
    return text
      .split(delimiters)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  buildSentenceGraph() {
    const n = this.sentences.length;
    const matrix = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    // 计算句子间相似度
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const similarity = this.calculateSimilarity(
          this.wordsAllFilters[i],
          this.wordsAllFilters[j]
        );
        matrix[i][j] = similarity;
        matrix[j][i] = similarity;
      }
    }

    // 计算 PageRank
    const result = pageRank(matrix);
    this.sentenceScores = result.scores;
  }

  calculateSimilarity(words1, words2) {
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));

    return intersection.size / (Math.log(set1.size) + Math.log(set2.size));
  }

  getKeySentences(num = 6, sentenceMinLen = 6) {
    if (!this.sentenceScores) return [];

    return this.sentences
      .map((sentence, index) => ({ index, sentence, weight: this.sentenceScores[index] }))
      .filter((item) => item.sentence.length >= sentenceMinLen)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, num);
  }

  getSummary(num = 3, sentenceMinLen = 6, sortByIndex = true) {
    const keySentences = this.getKeySentences(num * 2, sentenceMinLen);
    const selectedSentences = keySentences.slice(0, num);

    if (sortByIndex) {
      selectedSentences.sort((a, b) => a.index - b.index);
    }

    return selectedSentences.map((item) => item.sentence).join('');
  }
}

// Worker 消息处理
async function handleKeywordAnalysis(config) {
  const startTime = performance.now();

  const tr4w = new TextRankKeyword();
  tr4w.analyze(config.text, config.config);

  const result = {};

  // 获取关键词
  if (config.options?.keywords) {
    result.keywords = tr4w.getKeywords(
      config.options.keywords.num,
      config.options.keywords.wordMinLen
    );
  }

  // 获取关键短语
  if (config.options?.keyphrases) {
    result.keyphrases = tr4w.getKeyphrases(
      config.options.keyphrases.keywordsNum,
      config.options.keyphrases.minOccurNum
    );
  }

  // 获取分词结果
  result.segmentation = {
    sentences: tr4w.sentences,
    wordsNoFilter: tr4w.wordsNoFilter,
    wordsNoStopWords: tr4w.wordsNoStopWords,
    wordsAllFilters: tr4w.wordsAllFilters,
  };

  const endTime = performance.now();
  return {
    ...result,
    duration: endTime - startTime,
  };
}

async function handleSentenceAnalysis(config) {
  const startTime = performance.now();

  const tr4s = new TextRankSentence();
  tr4s.analyze(config.text, config.config);

  const result = {};

  // 获取关键句子
  if (config.options?.sentences) {
    result.sentences = tr4s.getKeySentences(
      config.options.sentences.num,
      config.options.sentences.sentenceMinLen
    );
  }

  // 获取摘要
  if (config.options?.summary) {
    result.summary = tr4s.getSummary(
      config.options.summary.num,
      config.options.summary.sentenceMinLen,
      config.options.summary.sortByIndex
    );
  }

  // 获取分词结果
  result.segmentation = {
    sentences: tr4s.sentences,
    wordsNoFilter: tr4s.wordsNoFilter,
    wordsNoStopWords: tr4s.wordsNoStopWords,
    wordsAllFilters: tr4s.wordsAllFilters,
  };

  const endTime = performance.now();
  return {
    ...result,
    duration: endTime - startTime,
  };
}

// 数据传输工具类 - Transferable 优化版本（带兼容性检测）
class WorkerDataTransfer {
  constructor() {
    // 检测环境支持
    this.isTransferableSupported = this.detectTransferableSupport();
    this.isTextEncoderSupported = this.detectTextEncoderSupport();
    
    // 在 Worker 中记录状态
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('Worker 数据传输兼容性:', {
        transferable: this.isTransferableSupported ? '✅' : '❌',
        textEncoder: this.isTextEncoderSupported ? '✅' : '❌'
      });
    }
  }

  // 检测 Transferable 支持
  detectTransferableSupport() {
    try {
      return typeof ArrayBuffer !== 'undefined' && 
             typeof self !== 'undefined' && 
             typeof self.postMessage === 'function';
    } catch {
      return false;
    }
  }

  // 检测 TextEncoder 支持
  detectTextEncoderSupport() {
    try {
      return typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined';
    } catch {
      return false;
    }
  }

  // 将文本转换为 ArrayBuffer（兼容版本）
  textToArrayBuffer(text) {
    if (this.isTextEncoderSupported) {
      const encoder = new TextEncoder();
      return encoder.encode(text).buffer;
    } else {
      // 手动 UTF-8 编码降级
      return this.manualTextToArrayBuffer(text);
    }
  }

  // 将 ArrayBuffer 转换为文本（兼容版本）
  arrayBufferToText(buffer) {
    if (this.isTextEncoderSupported) {
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    } else {
      // 手动 UTF-8 解码降级
      return this.manualArrayBufferToText(buffer);
    }
  }

  // 手动文本编码（降级方法）
  manualTextToArrayBuffer(text) {
    const utf8 = [];
    for (let i = 0; i < text.length; i++) {
      let charcode = text.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if ((charcode & 0xfc00) == 0xd800 && i + 1 < text.length && 
                 (text.charCodeAt(i + 1) & 0xfc00) == 0xdc00) {
        charcode = 0x10000 + (((charcode & 0x03ff) << 10) + (text.charCodeAt(++i) & 0x03ff));
        utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 
                  0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      } else {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 
                  0x80 | (charcode & 0x3f));
      }
    }
    return new Uint8Array(utf8).buffer;
  }

  // 手动文本解码（降级方法）
  manualArrayBufferToText(buffer) {
    const bytes = new Uint8Array(buffer);
    const length = bytes.length;
    let result = '';
    let i = 0;

    while (i < length) {
      const byte1 = bytes[i++];
      if (byte1 < 0x80) {
        result += String.fromCharCode(byte1);
      } else if ((byte1 >> 5) === 0x06) {
        const byte2 = bytes[i++];
        result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
      } else if ((byte1 >> 4) === 0x0e) {
        const byte2 = bytes[i++];
        const byte3 = bytes[i++];
        result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
      } else if ((byte1 >> 3) === 0x1e) {
        const byte2 = bytes[i++];
        const byte3 = bytes[i++];
        const byte4 = bytes[i++];
        const codepoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
        result += String.fromCharCode(0xd800 + ((codepoint - 0x10000) >> 10), 0xdc00 + ((codepoint - 0x10000) & 0x3ff));
      }
    }
    return result;
  }

  // 序列化对象为 ArrayBuffer
  serializeToArrayBuffer(obj) {
    const jsonString = JSON.stringify(obj);
    return this.textToArrayBuffer(jsonString);
  }

  // 反序列化 ArrayBuffer 为对象
  deserializeFromArrayBuffer(buffer) {
    const jsonString = this.arrayBufferToText(buffer);
    return JSON.parse(jsonString);
  }

  // 批量序列化数据
  batchSerialize(data) {
    const serializedData = {};
    const transferables = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        const buffer = this.serializeToArrayBuffer(value);
        serializedData[key] = buffer;
        transferables.push(buffer);
      }
    }

    return { serializedData, transferables };
  }

  // 批量反序列化数据
  batchDeserialize(serializedData) {
    const result = {};

    for (const [key, buffer] of Object.entries(serializedData)) {
      result[key] = this.deserializeFromArrayBuffer(buffer);
    }

    return result;
  }

  // 判断是否应该使用 Transferable（兼容性检测）
  shouldUseTransferable(data, threshold = 1024) {
    if (!this.isTransferableSupported) {
      return false;
    }

    try {
      const serialized = JSON.stringify(data);
      return serialized.length > threshold;
    } catch {
      return false;
    }
  }

  // 智能准备数据传输（带错误处理）
  prepareDataForTransfer(data) {
    try {
      const useTransferable = this.shouldUseTransferable(data);

      if (useTransferable) {
        const { serializedData, transferables } = this.batchSerialize(data);
        return {
          transferData: { __transferable: true, data: serializedData },
          transferables,
          useTransferable: true,
        };
      }

      return {
        transferData: data,
        useTransferable: false,
      };
    } catch (error) {
      // 发生错误时降级
      console.warn && console.warn('Worker: Transferable 准备失败，使用传统方式:', error);
      return {
        transferData: data,
        useTransferable: false,
      };
    }
  }

  // 处理接收到的数据（带错误处理）
  processReceivedData(data) {
    try {
      if (data && data.__transferable === true) {
        if (!this.isTransferableSupported) {
          console.warn && console.warn('Worker: 收到 Transferable 数据但环境不支持');
          return this.batchDeserialize(data.data);
        }
        
        return this.batchDeserialize(data.data);
      }
      return data;
    } catch (error) {
      console.warn && console.warn('Worker: 数据处理失败，返回原始数据:', error);
      
      // 尝试返回原始数据
      if (data && data.data) {
        return data.data;
      }
      
      return data;
    }
  }
}

const dataTransfer = new WorkerDataTransfer();

// 消息处理
self.onmessage = async (event) => {
  const message = event.data;

  try {
    // 处理可能的 Transferable 数据
    const payload = dataTransfer.processReceivedData(message.payload);

    let data;

    switch (message.type) {
      case 'analyze_keywords':
        data = await handleKeywordAnalysis(payload);
        break;

      case 'analyze_sentences':
        data = await handleSentenceAnalysis(payload);
        break;

      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }

    // 准备返回数据（智能选择是否使用 Transferable）
    const result = {
      id: message.id,
      success: true,
      data,
      duration: data.duration,
    };

    const { transferData, transferables, useTransferable } =
      dataTransfer.prepareDataForTransfer(result);

    const responseMessage = {
      id: message.id,
      type: 'result',
      payload: transferData,
    };

    // 安全的消息发送
    try {
      if (useTransferable && transferables && transferables.length > 0) {
        responseMessage.transferable = transferables;
        self.postMessage(responseMessage, transferables);
        
        console.debug && console.debug(`Worker: 使用 Transferable 发送 ${transferables.length} 个对象`);
      } else {
        self.postMessage(responseMessage);
        
        if (useTransferable) {
          console.debug && console.debug('Worker: Transferable 准备失败，使用传统方式');
        }
      }
    } catch (error) {
      // 如果 Transferable 发送失败，降级到传统方式
      if (useTransferable) {
        console.warn && console.warn('Worker: Transferable 发送失败，降级到传统方式:', error);
        
        try {
          // 重新发送，不使用 Transferable
          const fallbackMessage = {
            id: message.id,
            type: 'result',
            payload: result
          };
          
          self.postMessage(fallbackMessage);
        } catch (fallbackError) {
          // 最终降级：发送错误信息
          self.postMessage({
            id: message.id,
            type: 'error',
            payload: {
              id: message.id,
              success: false,
              error: `消息发送失败: ${fallbackError.message || 'Unknown error'}`
            }
          });
        }
      } else {
        // 发送错误信息
        self.postMessage({
          id: message.id,
          type: 'error',
          payload: {
            id: message.id,
            success: false,
            error: `消息发送失败: ${error.message || 'Unknown error'}`
          }
        });
      }
    }
  } catch (error) {
    // 发送错误结果
    const result = {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    // 错误信息通常较小，不需要使用 Transferable
    self.postMessage({
      id: message.id,
      type: 'error',
      payload: result,
    });
  }
};

// Worker 启动消息
self.postMessage({
  id: 'worker-ready',
  type: 'result',
  payload: { message: 'TextRank Worker is ready' },
});
