/**
 * TextRank4ZH-TS SharedWorker 独立文件
 * 包含完整的算法实现和数据传输优化，支持多标签页共享
 */

// === 分词和停用词处理模块 ===
class SimpleSegmentation {
  constructor() {
    this.sentenceDelimiters = ['?', '!', ';', '？', '！', '。', '；', '……', '…', '\n'];
    this.allowSpeechTags = ['an', 'i', 'j', 'l', 'n', 'nr', 'nrfg', 'ns', 'nt', 'nz', 't', 'v', 'vd', 'vn', 'eng'];
    this.stopWords = new Set([
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'
    ]);
  }

  segmentSentences(text) {
    if (!text || text.trim() === '') return [];
    const sentences = [];
    let current = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      current += char;
      
      if (this.sentenceDelimiters.includes(char)) {
        const sentence = current.trim();
        if (sentence.length > 0) {
          sentences.push(sentence);
        }
        current = '';
      }
    }
    
    if (current.trim().length > 0) {
      sentences.push(current.trim());
    }
    
    return sentences.filter(s => s.length > 0);
  }

  segmentWords(text) {
    if (!text) return [];
    
    // 简单的中文分词实现
    const words = [];
    let current = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (/[\u4e00-\u9fa5]/.test(char)) {
        if (current.length > 0 && !/[\u4e00-\u9fa5]/.test(current[current.length - 1])) {
          if (current.trim().length > 0) words.push(current.trim());
          current = '';
        }
        current += char;
      } else if (/[a-zA-Z0-9]/.test(char)) {
        if (current.length > 0 && /[\u4e00-\u9fa5]/.test(current[current.length - 1])) {
          if (current.trim().length > 0) words.push(current.trim());
          current = '';
        }
        current += char;
      } else {
        if (current.trim().length > 0) {
          words.push(current.trim());
        }
        current = '';
      }
    }
    
    if (current.trim().length > 0) {
      words.push(current.trim());
    }
    
    return words.filter(word => word.length > 0);
  }

  filterWords(words, filters = { lower: false, removeStopWords: true, minLength: 1 }) {
    return words.filter(word => {
      if (word.length < filters.minLength) return false;
      if (filters.removeStopWords && this.stopWords.has(filters.lower ? word.toLowerCase() : word)) return false;
      return true;
    }).map(word => filters.lower ? word.toLowerCase() : word);
  }
}

// === PageRank 算法实现 ===
class PageRankCalculator {
  static calculate(matrix, config = {}) {
    const { alpha = 0.85, maxIterations = 100, tolerance = 1e-6 } = config;
    const n = matrix.length;
    
    if (n === 0) return { scores: [], iterations: 0 };
    
    let scores = new Array(n).fill(1.0 / n);
    let newScores = new Array(n);
    
    for (let iter = 0; iter < maxIterations; iter++) {
      newScores.fill((1.0 - alpha) / n);
      
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (matrix[j][i] > 0) {
            const outLinks = matrix[j].reduce((sum, val) => sum + (val > 0 ? 1 : 0), 0);
            if (outLinks > 0) {
              newScores[i] += alpha * scores[j] * matrix[j][i] / outLinks;
            }
          }
        }
      }
      
      // 检查收敛
      let diff = 0;
      for (let i = 0; i < n; i++) {
        diff += Math.abs(newScores[i] - scores[i]);
      }
      
      [scores, newScores] = [newScores, scores];
      
      if (diff < tolerance) {
        return { scores, iterations: iter + 1 };
      }
    }
    
    return { scores, iterations: maxIterations };
  }
}

// === TextRank 核心算法 ===
class TextRankKeyword {
  constructor() {
    this.segmentation = new SimpleSegmentation();
    this.wordsNoFilter = [];
    this.wordsNoStopWords = [];
    this.wordsAllFilters = [];
    this.scores = [];
    this.wordList = [];
  }

  analyze(text, config = {}) {
    const { window = 2, lower = false, vertexSource = 'all_filters', edgeSource = 'no_stop_words', pageRankConfig = {} } = config;
    
    // 分词处理
    this.wordsNoFilter = this.segmentation.segmentWords(text);
    this.wordsNoStopWords = this.segmentation.filterWords(this.wordsNoFilter, { lower, removeStopWords: true, minLength: 1 });
    this.wordsAllFilters = this.segmentation.filterWords(this.wordsNoFilter, { lower, removeStopWords: true, minLength: 2 });
    
    // 选择词源
    const vertexWords = this.getWordsBySource(vertexSource);
    const edgeWords = this.getWordsBySource(edgeSource);
    
    if (vertexWords.length === 0) {
      this.scores = [];
      this.wordList = [];
      return;
    }
    
    // 构建词汇表
    this.wordList = [...new Set(vertexWords)];
    const wordIndex = new Map(this.wordList.map((word, i) => [word, i]));
    
    // 构建共现矩阵
    const matrix = this.buildCooccurrenceMatrix(edgeWords, wordIndex, window);
    
    // 计算 PageRank
    const result = PageRankCalculator.calculate(matrix, pageRankConfig);
    this.scores = result.scores;
  }

  getWordsBySource(source) {
    switch (source) {
      case 'no_filter': return this.wordsNoFilter;
      case 'no_stop_words': return this.wordsNoStopWords;
      case 'all_filters': return this.wordsAllFilters;
      default: return this.wordsAllFilters;
    }
  }

  buildCooccurrenceMatrix(words, wordIndex, window) {
    const n = wordIndex.size;
    const matrix = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < words.length; i++) {
      const word1 = words[i];
      const idx1 = wordIndex.get(word1);
      
      if (idx1 === undefined) continue;
      
      for (let j = Math.max(0, i - window); j <= Math.min(words.length - 1, i + window); j++) {
        if (i === j) continue;
        
        const word2 = words[j];
        const idx2 = wordIndex.get(word2);
        
        if (idx2 !== undefined) {
          matrix[idx1][idx2] += 1;
        }
      }
    }
    
    return matrix;
  }

  getKeywords(num = 10, wordMinLen = 1) {
    const keywords = this.wordList
      .map((word, i) => ({ word, weight: this.scores[i] || 0 }))
      .filter(item => item.word.length >= wordMinLen)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, num);
    
    return keywords;
  }

  getKeyphrases(keywordsNum = 12, minOccurNum = 2) {
    const keywords = this.getKeywords(keywordsNum);
    const keywordSet = new Set(keywords.map(k => k.word));
    const phrases = [];
    
    // 简单的关键短语提取
    for (let i = 0; i < this.wordsNoStopWords.length - 1; i++) {
      for (let len = 2; len <= 4 && i + len <= this.wordsNoStopWords.length; len++) {
        const phrase = this.wordsNoStopWords.slice(i, i + len);
        if (phrase.some(word => keywordSet.has(word))) {
          const phraseStr = phrase.join('');
          phrases.push(phraseStr);
        }
      }
    }
    
    // 统计频次并过滤
    const phraseCount = {};
    phrases.forEach(phrase => {
      phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;
    });
    
    return Object.entries(phraseCount)
      .filter(([phrase, count]) => count >= minOccurNum)
      .sort((a, b) => b[1] - a[1])
      .map(([phrase]) => phrase);
  }

  getSegmentationResult() {
    return {
      sentences: [],
      wordsNoFilter: [this.wordsNoFilter],
      wordsNoStopWords: [this.wordsNoStopWords],
      wordsAllFilters: [this.wordsAllFilters]
    };
  }
}

class TextRankSentence {
  constructor() {
    this.segmentation = new SimpleSegmentation();
    this.sentences = [];
    this.sentenceSegments = [];
    this.scores = [];
  }

  analyze(text, config = {}) {
    const { lower = false, source = 'no_stop_words', pageRankConfig = {} } = config;
    
    // 分句
    this.sentences = this.segmentation.segmentSentences(text);
    
    if (this.sentences.length === 0) {
      this.scores = [];
      return;
    }
    
    // 对每个句子分词
    this.sentenceSegments = this.sentences.map(sentence => {
      const words = this.segmentation.segmentWords(sentence);
      return this.segmentation.filterWords(words, { 
        lower, 
        removeStopWords: source !== 'no_filter', 
        minLength: source === 'all_filters' ? 2 : 1 
      });
    });
    
    // 构建句子相似度矩阵
    const matrix = this.buildSimilarityMatrix();
    
    // 计算 PageRank
    const result = PageRankCalculator.calculate(matrix, pageRankConfig);
    this.scores = result.scores;
  }

  buildSimilarityMatrix() {
    const n = this.sentences.length;
    const matrix = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          matrix[i][j] = this.calculateSimilarity(this.sentenceSegments[i], this.sentenceSegments[j]);
        }
      }
    }
    
    return matrix;
  }

  calculateSimilarity(words1, words2) {
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    return intersection.size / (set1.size + set2.size - intersection.size);
  }

  getKeySentences(num = 5, sentenceMinLen = 6) {
    return this.sentences
      .map((sentence, i) => ({ index: i, sentence, weight: this.scores[i] || 0 }))
      .filter(item => item.sentence.length >= sentenceMinLen)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, num);
  }

  getSummary(num = 3, sentenceMinLen = 6, sortByIndex = true) {
    const keySentences = this.getKeySentences(num * 2, sentenceMinLen);
    let selectedSentences = keySentences.slice(0, num);
    
    if (sortByIndex) {
      selectedSentences.sort((a, b) => a.index - b.index);
    }
    
    return selectedSentences.map(item => item.sentence).join('');
  }

  getSegmentationResult() {
    return {
      sentences: this.sentences,
      wordsNoFilter: this.sentenceSegments,
      wordsNoStopWords: this.sentenceSegments,
      wordsAllFilters: this.sentenceSegments
    };
  }
}

// === 数据传输优化 ===
class WorkerDataTransfer {
  constructor() {
    this.isTransferableSupported = this.detectTransferableSupport();
    this.isTextEncoderSupported = this.detectTextEncoderSupport();
  }

  detectTransferableSupported() {
    try {
      return typeof ArrayBuffer !== 'undefined';
    } catch {
      return false;
    }
  }

  detectTextEncoderSupport() {
    try {
      return typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined';
    } catch {
      return false;
    }
  }

  textToArrayBuffer(text) {
    if (this.isTextEncoderSupported) {
      return new TextEncoder().encode(text).buffer;
    }
    // 降级处理
    const utf8 = [];
    for (let i = 0; i < text.length; i++) {
      let charcode = text.charCodeAt(i);
      if (charcode < 0x80) utf8.push(charcode);
      else if (charcode < 0x800) {
        utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
      } else if ((charcode & 0xfc00) == 0xd800 && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) == 0xdc00) {
        charcode = 0x10000 + (((charcode & 0x03ff) << 10) + (text.charCodeAt(++i) & 0x03ff));
        utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      } else {
        utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
      }
    }
    return new Uint8Array(utf8).buffer;
  }

  arrayBufferToText(buffer) {
    if (this.isTextEncoderSupported) {
      return new TextDecoder().decode(buffer);
    }
    // 降级处理
    const bytes = new Uint8Array(buffer);
    let result = '';
    let i = 0;
    while (i < bytes.length) {
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

  serializeToArrayBuffer(obj) {
    const jsonString = JSON.stringify(obj);
    return this.textToArrayBuffer(jsonString);
  }

  deserializeFromArrayBuffer(buffer) {
    const jsonString = this.arrayBufferToText(buffer);
    return JSON.parse(jsonString);
  }

  shouldUseTransferable(data, threshold = 1024) {
    if (!this.isTransferableSupported) return false;
    try {
      const serialized = JSON.stringify(data);
      return serialized.length > threshold;
    } catch {
      return false;
    }
  }

  prepareDataForTransfer(data) {
    try {
      const useTransferable = this.shouldUseTransferable(data);
      if (useTransferable) {
        const buffer = this.serializeToArrayBuffer(data);
        return {
          transferData: { __transferable: true, data: buffer },
          transferables: [buffer],
          useTransferable: true
        };
      }
      return { transferData: data, useTransferable: false };
    } catch (error) {
      console.warn('Transferable 准备失败:', error);
      return { transferData: data, useTransferable: false };
    }
  }

  processReceivedData(data) {
    try {
      if (data && data.__transferable === true) {
        return this.deserializeFromArrayBuffer(data.data);
      }
      return data;
    } catch (error) {
      console.warn('数据处理失败:', error);
      return data;
    }
  }
}

// === SharedWorker 管理器 ===
class SharedWorkerManager {
  constructor() {
    this.connections = new Map();
    this.taskCounter = 0;
    this.dataTransfer = new WorkerDataTransfer();
    
    self.addEventListener('connect', this.handleConnect.bind(this));
    console.log('TextRank4ZH-TS SharedWorker 已启动');
  }

  handleConnect(event) {
    const port = event.ports[0];
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const connectionInfo = {
      port,
      id: connectionId,
      connectTime: Date.now(),
      taskCount: 0
    };

    this.connections.set(connectionId, connectionInfo);
    
    port.onmessage = (msgEvent) => this.handleMessage(connectionId, msgEvent);
    port.onmessageerror = (error) => this.handleMessageError(connectionId, error);
    port.start();
    
    console.log(`SharedWorker 新连接: ${connectionId}, 总连接数: ${this.connections.size}`);
  }

  async handleMessage(connectionId, event) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.error(`连接 ${connectionId} 不存在`);
      return;
    }

    const message = event.data;
    
    try {
      const processedPayload = this.dataTransfer.processReceivedData(message.payload);
      
      if (message.type === 'analyze_keywords' || message.type === 'analyze_sentences') {
        connection.taskCount++;
        this.taskCounter++;
        
        const startTime = Date.now();
        const result = await this.processTask(message.type, processedPayload);
        const duration = Date.now() - startTime;
        
        const { transferData, transferables } = this.dataTransfer.prepareDataForTransfer({
          ...result,
          duration,
          connectionId,
          totalConnections: this.connections.size,
          taskNumber: this.taskCounter
        });

        const response = {
          id: message.id,
          type: 'result',
          payload: transferData
        };

        if (transferables && transferables.length > 0) {
          connection.port.postMessage(response, transferables);
        } else {
          connection.port.postMessage(response);
        }
        
        console.log(`SharedWorker 任务完成: ${message.id}, 连接: ${connectionId}, 耗时: ${duration}ms`);
      }
    } catch (error) {
      const errorResponse = {
        id: message.id,
        type: 'error',
        payload: {
          error: error instanceof Error ? error.message : '未知错误',
          connectionId
        }
      };
      
      connection.port.postMessage(errorResponse);
      console.error(`SharedWorker 任务失败: ${message.id}`, error);
    }
  }

  handleMessageError(connectionId, error) {
    console.error(`SharedWorker 连接 ${connectionId} 消息错误:`, error);
  }

  async processTask(type, payload) {
    const { text, config = {}, options = {} } = payload;

    if (type === 'analyze_keywords') {
      const tr4w = new TextRankKeyword();
      tr4w.analyze(text, config);

      const result = {};

      if (options.keywords) {
        result.keywords = tr4w.getKeywords(
          options.keywords.num || 10,
          options.keywords.wordMinLen || 1
        );
      }

      if (options.keyphrases) {
        result.keyphrases = tr4w.getKeyphrases(
          options.keyphrases.keywordsNum || 12,
          options.keyphrases.minOccurNum || 2
        );
      }

      if (options.segmentation !== false) {
        result.segmentation = tr4w.getSegmentationResult();
      }

      return result;
    } 
    
    if (type === 'analyze_sentences') {
      const tr4s = new TextRankSentence();
      tr4s.analyze(text, config);

      const result = {};

      if (options.sentences) {
        result.sentences = tr4s.getKeySentences(
          options.sentences.num || 5,
          options.sentences.sentenceMinLen || 6
        );
      }

      if (options.summary) {
        result.summary = tr4s.getSummary(
          options.summary.num || 3,
          options.summary.sentenceMinLen || 6,
          options.summary.sortByIndex !== false
        );
      }

      if (options.segmentation !== false) {
        result.segmentation = tr4s.getSegmentationResult();
      }

      return result;
    }

    throw new Error(`不支持的任务类型: ${type}`);
  }

  disconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.port.close();
      this.connections.delete(connectionId);
      console.log(`SharedWorker 连接断开: ${connectionId}, 剩余连接数: ${this.connections.size}`);
    }
  }

  getStats() {
    return {
      connectionCount: this.connections.size,
      totalTasks: this.taskCounter,
      uptime: Date.now()
    };
  }
}

// 启动 SharedWorker 管理器
const manager = new SharedWorkerManager();