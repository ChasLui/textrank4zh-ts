// 导入核心类
import { TextRankKeyword } from './core/textrank-keyword';
import { TextRankSentence } from './core/textrank-sentence';
import { Segmentation, WordSegmentation, SentenceSegmentation } from './core/segmentation';
import { TextRankWorkerClient } from './worker/textrank-worker-client';
import { TextRankUniversalClient } from './worker/textrank-universal-client';
import { WorkerDataTransfer, dataTransfer } from './utils/data-transfer';
import { MainThreadScheduler, mainThreadScheduler } from './utils/main-thread-scheduler';
import { AsyncAnalysisExecutor } from './utils/async-analysis';

// 导出核心类
export { TextRankKeyword, TextRankSentence, Segmentation, WordSegmentation, SentenceSegmentation };

// 导出 Web Worker 相关和异步工具
export {
  TextRankWorkerClient,
  TextRankUniversalClient,
  WorkerDataTransfer,
  dataTransfer,
  MainThreadScheduler,
  mainThreadScheduler,
  AsyncAnalysisExecutor,
};

// 导出类型定义
export * from './types';

// 导出 Result 类型与辅助函数
export type { Result, Ok, Err, ResultOps } from './utils/result';
export * from './utils/result-helpers';

// 导出工具函数
export {
  generateWordPairs,
  getDefaultSimilarity,
  pageRank,
  buildWordGraph,
  buildSentenceGraph,
  sortWords,
  sortSentences,
  debug,
} from './utils';

// 默认导出便捷接口
export default {
  TextRankKeyword,
  TextRankSentence,
  Segmentation,
  TextRankWorkerClient,
  TextRankUniversalClient,
  WorkerDataTransfer,
  dataTransfer,
  MainThreadScheduler,
  mainThreadScheduler,
  AsyncAnalysisExecutor,
};
