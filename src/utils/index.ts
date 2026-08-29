import type {
  AdjacencyMatrix,
  PageRankResult,
  PageRankConfig,
  SimilarityFunction,
  KeywordItem,
  SentenceItem,
} from '../types';
import { DEFAULT_CONFIG } from '../types';

/**
 * 生成滑动窗口内的单词组合
 * @param wordList 单词列表
 * @param window 窗口大小
 * @returns 单词对的生成器
 */
export function* generateWordPairs(
  wordList: string[],
  window: number = 2
): Generator<[string, string]> {
  if (window < 2) window = 2;

  for (let i = 1; i < window && i < wordList.length; i++) {
    const word1List = wordList.slice(0, wordList.length - i);
    const word2List = wordList.slice(i);

    // 两个切片长度相同，word2List 的同位元素必然存在
    for (const [j, word1] of word1List.entries()) {
      const word2 = word2List[j];
      if (word2 === undefined) continue;
      yield [word1, word2];
    }
  }
}

/**
 * 计算两个词列表的相似度（基于共现词数量和长度）
 * @param words1 第一个词列表
 * @param words2 第二个词列表
 * @returns 相似度值
 */
export const getDefaultSimilarity: SimilarityFunction = (
  words1: string[],
  words2: string[]
): number => {
  const allWords = Array.from(new Set([...words1, ...words2]));
  const vector1 = allWords.map((word) => words1.filter((w) => w === word).length);
  const vector2 = allWords.map((word) => words2.filter((w) => w === word).length);

  // 两个向量都按 allWords 生成，长度一致；?? 0 只为满足类型检查
  const coOccurNum = vector1.reduce(
    (count, v1, i) => count + (v1 * (vector2[i] ?? 0) > 0 ? 1 : 0),
    0
  );

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
export function pageRank(
  adjacencyMatrix: AdjacencyMatrix,
  config: PageRankConfig = {}
): PageRankResult {
  const {
    alpha = DEFAULT_CONFIG.PAGERANK.alpha,
    maxIterations = DEFAULT_CONFIG.PAGERANK.maxIterations,
    tolerance = DEFAULT_CONFIG.PAGERANK.tolerance,
  } = config;

  const n = adjacencyMatrix.length;
  if (n === 0) {
    return { scores: [], iterations: 0 };
  }

  // 初始化 PageRank 值
  let scores = Array.from({ length: n }, () => 1 / n);
  const newScores = Array.from({ length: n }, () => 0);

  // 计算转移概率矩阵
  const transitionMatrix: AdjacencyMatrix = adjacencyMatrix.map((row) => {
    const rowSum = row.reduce((sum, val) => sum + val, 0);
    return rowSum > 0 ? row.map((val) => val / rowSum) : row;
  });

  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    // 计算新的 PageRank 值
    for (let i = 0; i < n; i++) {
      let newScore = (1 - alpha) / n;
      for (let j = 0; j < n; j++) {
        // 邻接矩阵未必是严格方阵，缺失的边按 0 处理（等价于原先 undefined > 0 为 false）
        const weight = transitionMatrix[j]?.[i] ?? 0;
        if (weight > 0) {
          newScore += alpha * (scores[j] ?? 0) * weight;
        }
      }
      newScores[i] = newScore;
    }

    // 检查收敛性
    let diff = 0;
    for (let i = 0; i < n; i++) {
      diff += Math.abs((newScores[i] ?? 0) - (scores[i] ?? 0));
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
): {
  adjacencyMatrix: AdjacencyMatrix;
  wordIndex: Map<string, number>;
  indexWord: Map<number, string>;
} {
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

      if (index1 === undefined || index2 === undefined) continue;

      // 索引来自 wordIndex，矩阵按 wordCount 预分配，对应行必然存在
      const row1 = adjacencyMatrix[index1];
      const row2 = adjacencyMatrix[index2];
      if (!row1 || !row2) continue;

      row1[index2] = 1;
      row2[index1] = 1;
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
      const wordsI = words[i];
      const wordsJ = words[j];
      const rowI = adjacencyMatrix[i];
      const rowJ = adjacencyMatrix[j];

      // words 必须与 sentences 一一对应，矩阵按 n 预分配；缺失说明调用方违反了前提
      if (!wordsI || !wordsJ || !rowI || !rowJ) {
        throw new Error('buildSentenceGraph: 句子列表与词列表长度不一致');
      }

      const similarity = similarityFunc(wordsI, wordsJ);
      rowI[j] = similarity;
      rowJ[i] = similarity;
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
  const { adjacencyMatrix, indexWord } = buildWordGraph(vertexWords, edgeWords, window);
  const { scores } = pageRank(adjacencyMatrix, pageRankConfig);

  const keywords: KeywordItem[] = [];
  for (const [i, score] of scores.entries()) {
    const word = indexWord.get(i);
    if (word) {
      keywords.push({ word, weight: score });
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

  // scores 长度等于 sentences 长度（邻接矩阵按 sentences 构建），?? 0 只为满足类型检查
  const sentenceItems: SentenceItem[] = sentences.map((sentence, index) => ({
    index,
    sentence,
    weight: scores[index] ?? 0,
  }));

  return sentenceItems.sort((a, b) => b.weight - a.weight);
}

/**
 * 调试输出函数
 * @param message 调试信息
 */
export function debug(...args: unknown[]): void {
  if (typeof process !== 'undefined' && process.env?.['DEBUG'] === '1') {
    console.log('[DEBUG]', ...args);
  }
}
