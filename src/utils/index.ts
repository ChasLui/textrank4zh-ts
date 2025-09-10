import {
  AdjacencyMatrix,
  PageRankResult,
  PageRankConfig,
  SimilarityFunction,
  KeywordItem,
  SentenceItem,
  DEFAULT_CONFIG
} from '../types';

/**
 * 生成滑动窗口内的单词组合
 * @param wordList 单词列表
 * @param window 窗口大小
 * @returns 单词对的生成器
 */
export function* generateWordPairs(wordList: string[], window: number = 2): Generator<[string, string]> {
  if (window < 2) window = 2;
  
  for (let i = 1; i < window && i < wordList.length; i++) {
    const word1List = wordList.slice(0, wordList.length - i);
    const word2List = wordList.slice(i);
    
    for (let j = 0; j < word1List.length; j++) {
      yield [word1List[j], word2List[j]];
    }
  }
}

/**
 * 计算两个词列表的相似度（基于共现词数量和长度）
 * @param words1 第一个词列表
 * @param words2 第二个词列表
 * @returns 相似度值
 */
export const getDefaultSimilarity: SimilarityFunction = (words1: string[], words2: string[]): number => {
  const allWords = Array.from(new Set([...words1, ...words2]));
  const vector1 = allWords.map(word => words1.filter(w => w === word).length);
  const vector2 = allWords.map(word => words2.filter(w => w === word).length);
  
  const dotProduct = vector1.reduce((sum, v1, i) => sum + v1 * vector2[i], 0);
  const coOccurNum = vector1.reduce((count, v1, i) => count + (v1 * vector2[i] > 0 ? 1 : 0), 0);
  
  if (Math.abs(coOccurNum) <= 1e-12) {
    return 0;
  }
  
  const denominator = Math.log(words1.length) + Math.log(words2.length);
  
  if (Math.abs(denominator) < 1e-12) {
    return 0;
  }
  
  return coOccurNum / denominator;
};

/**
 * PageRank 算法实现
 * @param adjacencyMatrix 邻接矩阵
 * @param config PageRank配置
 * @returns PageRank结果
 */
export function pageRank(adjacencyMatrix: AdjacencyMatrix, config: PageRankConfig = {}): PageRankResult {
  const { alpha = DEFAULT_CONFIG.PAGERANK.alpha, maxIterations = DEFAULT_CONFIG.PAGERANK.maxIterations, tolerance = DEFAULT_CONFIG.PAGERANK.tolerance } = config;
  
  const n = adjacencyMatrix.length;
  if (n === 0) {
    return { scores: [], iterations: 0 };
  }
  
  // 初始化 PageRank 值
  let scores = new Array(n).fill(1 / n);
  const newScores = new Array(n).fill(0);
  
  // 计算转移概率矩阵
  const transitionMatrix: AdjacencyMatrix = adjacencyMatrix.map(row => {
    const rowSum = row.reduce((sum, val) => sum + val, 0);
    return rowSum > 0 ? row.map(val => val / rowSum) : row;
  });
  
  let iterations = 0;
  
  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    
    // 计算新的 PageRank 值
    for (let i = 0; i < n; i++) {
      newScores[i] = (1 - alpha) / n;
      for (let j = 0; j < n; j++) {
        if (transitionMatrix[j][i] > 0) {
          newScores[i] += alpha * scores[j] * transitionMatrix[j][i];
        }
      }
    }
    
    // 检查收敛性
    let diff = 0;
    for (let i = 0; i < n; i++) {
      diff += Math.abs(newScores[i] - scores[i]);
    }
    
    if (diff < tolerance) {
      scores = newScores.slice();
      break;
    }
    
    scores = newScores.slice();
    newScores.fill(0);
  }
  
  return { scores, iterations };
}

/**
 * 构建单词图的邻接矩阵
 * @param vertexWords 用于构建节点的词列表
 * @param edgeWords 用于构建边的词列表
 * @param window 窗口大小
 * @returns 邻接矩阵和词索引映射
 */
export function buildWordGraph(
  vertexWords: string[][],
  edgeWords: string[][],
  window: number = 2
): { adjacencyMatrix: AdjacencyMatrix; wordIndex: Map<string, number>; indexWord: Map<number, string> } {
  // 构建词汇索引
  const wordIndex = new Map<string, number>();
  const indexWord = new Map<number, string>();
  let wordCount = 0;
  
  for (const sentence of vertexWords) {
    for (const word of sentence) {
      if (!wordIndex.has(word)) {
        wordIndex.set(word, wordCount);
        indexWord.set(wordCount, word);
        wordCount++;
      }
    }
  }
  
  // 初始化邻接矩阵
  const adjacencyMatrix: AdjacencyMatrix = Array(wordCount)
    .fill(null)
    .map(() => Array(wordCount).fill(0));
  
  // 构建边
  for (const sentence of edgeWords) {
    for (const [word1, word2] of generateWordPairs(sentence, window)) {
      const index1 = wordIndex.get(word1);
      const index2 = wordIndex.get(word2);
      
      if (index1 !== undefined && index2 !== undefined) {
        adjacencyMatrix[index1][index2] = 1;
        adjacencyMatrix[index2][index1] = 1;
      }
    }
  }
  
  return { adjacencyMatrix, wordIndex, indexWord };
}

/**
 * 构建句子图的邻接矩阵
 * @param sentences 句子列表
 * @param words 对应的词列表
 * @param similarityFunc 相似度计算函数
 * @returns 邻接矩阵
 */
export function buildSentenceGraph(
  sentences: string[],
  words: string[][],
  similarityFunc: SimilarityFunction = getDefaultSimilarity
): AdjacencyMatrix {
  const n = sentences.length;
  const adjacencyMatrix: AdjacencyMatrix = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const similarity = similarityFunc(words[i], words[j]);
      adjacencyMatrix[i][j] = similarity;
      adjacencyMatrix[j][i] = similarity;
    }
  }
  
  return adjacencyMatrix;
}

/**
 * 对单词按重要性排序
 * @param vertexWords 用于构建节点的词列表
 * @param edgeWords 用于构建边的词列表
 * @param window 窗口大小
 * @param pageRankConfig PageRank配置
 * @returns 排序后的关键词列表
 */
export function sortWords(
  vertexWords: string[][],
  edgeWords: string[][],
  window: number = 2,
  pageRankConfig: PageRankConfig = {}
): KeywordItem[] {
  const { adjacencyMatrix, wordIndex, indexWord } = buildWordGraph(vertexWords, edgeWords, window);
  const { scores } = pageRank(adjacencyMatrix, pageRankConfig);
  
  const keywords: KeywordItem[] = [];
  for (let i = 0; i < scores.length; i++) {
    const word = indexWord.get(i);
    if (word) {
      keywords.push({ word, weight: scores[i] });
    }
  }
  
  return keywords.sort((a, b) => b.weight - a.weight);
}

/**
 * 对句子按重要性排序
 * @param sentences 句子列表
 * @param words 对应的词列表
 * @param similarityFunc 相似度计算函数
 * @param pageRankConfig PageRank配置
 * @returns 排序后的句子列表
 */
export function sortSentences(
  sentences: string[],
  words: string[][],
  similarityFunc: SimilarityFunction = getDefaultSimilarity,
  pageRankConfig: PageRankConfig = {}
): SentenceItem[] {
  const adjacencyMatrix = buildSentenceGraph(sentences, words, similarityFunc);
  const { scores } = pageRank(adjacencyMatrix, pageRankConfig);
  
  const sentenceItems: SentenceItem[] = sentences.map((sentence, index) => ({
    index,
    sentence,
    weight: scores[index]
  }));
  
  return sentenceItems.sort((a, b) => b.weight - a.weight);
}

/**
 * 调试输出函数
 * @param message 调试信息
 */
export function debug(...args: any[]): void {
  if (typeof process !== 'undefined' && process.env?.DEBUG === '1') {
    console.log('[DEBUG]', ...args);
  }
}