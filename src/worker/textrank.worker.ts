/**
 * TextRank Web Worker 实现
 * 在后台线程中处理文本分析，避免阻塞主线程
 */

import { TextRankKeyword } from '../core/textrank-keyword';
import { TextRankSentence } from '../core/textrank-sentence';
import type {
  WorkerMessage,
  WorkerTaskConfig,
  WorkerResult,
  TextRankKeywordConfig,
  TextRankSentenceConfig,
} from '../types';
import { ErrorType } from '../types';
import { dataTransfer } from '../utils/data-transfer';
import { safeAsync } from '../utils/result-helpers';

// 分析结果载荷：分析数据 + 耗时
type AnalysisPayload = NonNullable<WorkerResult['data']> & { duration: number };

// Worker 上下文类型声明
declare const self: DedicatedWorkerGlobalScope;

// 任务处理函数
async function handleKeywordAnalysis(config: WorkerTaskConfig): Promise<AnalysisPayload> {
  const analysisResult = await safeAsync(
    async () => {
      const startTime = performance.now();

      const tr4w = new TextRankKeyword();
      tr4w.analyze(config.text, config.config as TextRankKeywordConfig);

      const result: NonNullable<WorkerResult['data']> = {};

      if (config.options?.keywords) {
        result.keywords = tr4w.getKeywords(
          config.options.keywords.num,
          config.options.keywords.wordMinLen
        );
      }

      if (config.options?.keyphrases) {
        result.keyphrases = tr4w.getKeyphrases(
          config.options.keyphrases.keywordsNum,
          config.options.keyphrases.minOccurNum
        );
      }

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
    },
    ErrorType.COMPUTATION_ERROR,
    {
      taskType: 'keyword-analysis',
      textLength: config.text?.length,
      hasKeywords: !!config.options?.keywords,
      hasKeyphrases: !!config.options?.keyphrases,
    }
  );

  if (!analysisResult.ok) {
    throw new Error(`关键词分析失败: ${analysisResult.error?.message || '未知错误'}`);
  }

  return analysisResult.value;
}

async function handleSentenceAnalysis(config: WorkerTaskConfig): Promise<AnalysisPayload> {
  const analysisResult = await safeAsync(
    async () => {
      const startTime = performance.now();

      const tr4s = new TextRankSentence();
      tr4s.analyze(config.text, config.config as TextRankSentenceConfig);

      const result: NonNullable<WorkerResult['data']> = {};

      if (config.options?.sentences) {
        result.sentences = tr4s.getKeySentences(
          config.options.sentences.num,
          config.options.sentences.sentenceMinLen
        );
      }

      if (config.options?.summary) {
        result.summary = tr4s.getSummary(
          config.options.summary.num,
          config.options.summary.sentenceMinLen,
          config.options.summary.sortByIndex
        );
      }

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
    },
    ErrorType.COMPUTATION_ERROR,
    {
      taskType: 'sentence-analysis',
      textLength: config.text?.length,
      hasSentences: !!config.options?.sentences,
      hasSummary: !!config.options?.summary,
    }
  );

  if (!analysisResult.ok) {
    throw new Error(`句子分析失败: ${analysisResult.error?.message || '未知错误'}`);
  }

  return analysisResult.value;
}

// 消息处理
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  const messageResult = await safeAsync(
    async () => {
      // payload 跨序列化边界传入，结构由 message.type 约定
      const payload = dataTransfer.processReceivedData(message.payload) as WorkerTaskConfig;

      let data: AnalysisPayload;

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

      const result: WorkerResult = {
        id: message.id,
        success: true,
        data,
        duration: data.duration,
      };

      const { transferData, transferables, useTransferable } =
        dataTransfer.prepareDataForTransfer(result);

      const responseMessage: WorkerMessage = {
        id: message.id,
        type: 'result',
        payload: transferData,
      };

      if (useTransferable && transferables) {
        responseMessage.transferable = transferables;
        self.postMessage(responseMessage, transferables);
      } else {
        self.postMessage(responseMessage);
      }

      return result;
    },
    ErrorType.WORKER_ERROR,
    { messageId: message.id, messageType: message.type }
  );

  if (!messageResult.ok) {
    const result: WorkerResult = {
      id: message.id,
      success: false,
      error: messageResult.error?.message || '未知错误',
    };

    self.postMessage({
      id: message.id,
      type: 'error',
      payload: result,
    } as WorkerMessage);
  }
};

// Worker 启动消息
self.postMessage({
  id: 'worker-ready',
  type: 'result',
  payload: { message: 'TextRank Worker is ready' },
} as WorkerMessage);
