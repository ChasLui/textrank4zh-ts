// 扩展 Window 接口以支持实验性 API
declare global {
  interface Window {
    scheduler?: {
      postTask?: (
        callback: () => void,
        options?: { priority?: string; signal?: AbortSignal }
      ) => Promise<void>;
    };
  }
}

// 导入 typescript-result 类型
import { Result } from 'typescript-result';

/**
 * 自定义错误类型
 */
export enum ErrorType {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  WORKER_ERROR = 'WORKER_ERROR',
  COMPUTATION_ERROR = 'COMPUTATION_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNSUPPORTED_ERROR = 'UNSUPPORTED_ERROR'
}

/**
 * 标准化错误接口
 */
export interface TextRankError {
  type: ErrorType;
  message: string;
  cause?: Error;
  context?: Record<string, any>;
}

/**
 * Result 类型别名
 */
export type TextRankResult<T> = Result<T, TextRankError>;

/**
 * 异步 Result 类型别名
 */
export type AsyncTextRankResult<T> = Promise<Result<T, TextRankError>>;

/**
 * 关键词项接口
 */
export interface KeywordItem {
  word: string;
  weight: number;
}

/**
 * 句子项接口
 */
export interface SentenceItem {
  index: number;
  sentence: string;
  weight: number;
}

/**
 * 分词结果接口
 */
export interface SegmentationResult {
  sentences: string[];
  wordsNoFilter: string[][];
  wordsNoStopWords: string[][];
  wordsAllFilters: string[][];
}

/**
 * PageRank 配置接口
 */
export interface PageRankConfig {
  alpha?: number;
  maxIterations?: number;
  tolerance?: number;
}

/**
 * 分词配置接口
 */
export interface SegmentationConfig {
  stopWords?: string[];
  allowSpeechTags?: string[];
  delimiters?: string[];
}

/**
 * 分析进度信息接口
 */
export interface AnalysisProgress {
  phase: 'segmentation' | 'graph_building' | 'pagerank' | 'sorting' | 'complete';
  progress: number; // 0-100
  message: string;
  details?: {
    totalItems?: number;
    processedItems?: number;
    iterations?: number;
    maxIterations?: number;
  };
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: AnalysisProgress) => void;

/**
 * TextRank 关键词分析配置
 */
export interface TextRankKeywordConfig {
  window?: number;
  lower?: boolean;
  vertexSource?: 'no_filter' | 'no_stop_words' | 'all_filters';
  edgeSource?: 'no_filter' | 'no_stop_words' | 'all_filters';
  pageRankConfig?: PageRankConfig;
}

/**
 * 异步分析配置
 */
export interface AsyncAnalysisConfig {
  onProgress?: ProgressCallback;
  timeSlice?: number; // 时间片大小（毫秒），默认 5ms
  maxContinuousTime?: number; // 最大连续执行时间（毫秒），默认 16ms (60fps)
  yieldInterval?: number; // 让出控制权间隔（迭代次数），默认 100
  priority?: 'background' | 'normal' | 'user-blocking'; // 任务优先级，默认 'background'
}

/**
 * 异步关键词分析配置
 */
export interface AsyncTextRankKeywordConfig extends TextRankKeywordConfig, AsyncAnalysisConfig {}

/**
 * TextRank 句子分析配置
 */
export interface TextRankSentenceConfig {
  lower?: boolean;
  source?: 'no_filter' | 'no_stop_words' | 'all_filters';
  pageRankConfig?: PageRankConfig;
}

/**
 * 异步句子分析配置
 */
export interface AsyncTextRankSentenceConfig extends TextRankSentenceConfig, AsyncAnalysisConfig {}

/**
 * 相似度计算函数类型
 */
export type SimilarityFunction = (words1: string[], words2: string[]) => number;

/**
 * 词性标注结果
 */
export interface WordWithPos {
  word: string;
  pos: string;
}

/**
 * 图的边权重矩阵类型
 */
export type AdjacencyMatrix = number[][];

/**
 * PageRank 结果
 */
export interface PageRankResult {
  scores: number[];
  iterations: number;
}

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  SENTENCE_DELIMITERS: ['?', '!', ';', '？', '！', '。', '；', '……', '…', '\n'],
  ALLOW_SPEECH_TAGS: ['an', 'i', 'j', 'l', 'n', 'nr', 'nrfg', 'ns', 'nt', 'nz', 't', 'v', 'vd', 'vn', 'eng'],
  PAGERANK: {
    alpha: 0.85,
    maxIterations: 100,
    tolerance: 1e-6
  }
} as const;

// Web Worker 消息类型
export interface WorkerMessage {
  id: string;
  type: 'analyze_keywords' | 'analyze_sentences' | 'error' | 'result';
  payload?: any;
  transferable?: Transferable[]; // 可传输对象列表
}

// Worker 任务配置
export interface WorkerTaskConfig {
  text: string;
  config?: TextRankKeywordConfig | TextRankSentenceConfig;
  options?: {
    keywords?: {
      num?: number;
      wordMinLen?: number;
    };
    sentences?: {
      num?: number;
      sentenceMinLen?: number;
    };
    keyphrases?: {
      keywordsNum?: number;
      minOccurNum?: number;
    };
    summary?: {
      num?: number;
      sentenceMinLen?: number;
      sortByIndex?: boolean;
    };
  };
}

// Worker 结果类型
export interface WorkerResult {
  id: string;
  success: boolean;
  data?: {
    keywords?: KeywordItem[];
    sentences?: SentenceItem[];
    keyphrases?: string[];
    summary?: string;
    segmentation?: SegmentationResult;
  };
  error?: string;
  duration?: number;
}

// Worker 选项
export interface WorkerOptions {
  timeout?: number; // 超时时间（毫秒）
  maxConcurrent?: number; // 最大并发任务数
  preferredWorkerType?: 'shared' | 'dedicated' | 'auto'; // 首选 Worker 类型
  fallbackToSync?: boolean; // 是否允许降级到同步模式
  syncScheduling?: {
    timeSlice?: number;           // 时间片大小（毫秒），默认 5ms
    maxContinuousTime?: number;   // 最大连续执行时间，默认 16ms (60fps)
    idleTimeout?: number;         // requestIdleCallback 超时时间，默认 50ms
    yieldInterval?: number;       // 让出控制权间隔（迭代次数），默认 1000
    priority?: 'background' | 'normal' | 'user-blocking'; // 任务优先级
  };
}

// 可传输的文本数据结构
export interface TransferableTextData {
  textBuffer: ArrayBuffer; // 使用 ArrayBuffer 存储文本数据
  textLength: number;
  encoding: string; // 编码方式，默认 'utf-8'
}

// 可传输的结果数据结构
export interface TransferableResultData {
  keywords?: ArrayBuffer; // 序列化后的关键词数据
  sentences?: ArrayBuffer; // 序列化后的句子数据
  keyphrases?: ArrayBuffer; // 序列化后的短语数据
  summary?: ArrayBuffer; // 序列化后的摘要数据
  segmentation?: ArrayBuffer; // 序列化后的分词数据
}

// 数据序列化工具接口
export interface DataTransferUtils {
  // 文本转换为 ArrayBuffer
  textToArrayBuffer(text: string): TextRankResult<ArrayBuffer>;
  // ArrayBuffer 转换为文本
  arrayBufferToText(buffer: ArrayBuffer): TextRankResult<string>;
  // 对象序列化为 ArrayBuffer
  serializeToArrayBuffer<T>(obj: T): TextRankResult<ArrayBuffer>;
  // ArrayBuffer 反序列化为对象
  deserializeFromArrayBuffer<T>(buffer: ArrayBuffer): TextRankResult<T>;
}

// Worker 类型枚举
export enum WorkerType {
  SHARED = 'shared',
  DEDICATED = 'dedicated', 
  SYNC = 'sync'
}

// Worker 状态接口
export interface WorkerStatus {
  type: WorkerType;
  supported: boolean;
  available: boolean;
  connectionCount?: number; // SharedWorker 连接数
}

// 同步模式回调接口
export interface SyncModeHandlers {
  analyzeKeywords: (text: string, config?: any, options?: any) => Promise<any>;
  analyzeSentences: (text: string, config?: any, options?: any) => Promise<any>;
}