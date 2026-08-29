/**
 * TextRank Worker 客户端
 * 提供简化的 API 来使用 Web Worker 进行文本分析
 */

import type {
  WorkerMessage,
  WorkerTaskConfig,
  WorkerResult,
  WorkerOptions,
  TextRankKeywordConfig,
  TextRankSentenceConfig,
  KeywordItem,
  SentenceItem,
  TextRankResult,
} from '../types';
import { ErrorType } from '../types';
import { dataTransfer } from '../utils/data-transfer';
import { safeSync, safeAsync, ok, errOf } from '../utils/result-helpers';

export class TextRankWorkerClient {
  private worker: Worker | null = null;
  private pendingTasks = new Map<
    string,
    {
      resolve: (result: WorkerResult) => void;
      reject: (error: Error) => void;
      timeout?: ReturnType<typeof setTimeout>;
    }
  >();
  private taskCounter = 0;
  private workerUrl: string;
  private options: WorkerOptions & { timeout: number; maxConcurrent: number };
  private isWorkerSupported: boolean;
  private supportStatus: ReturnType<typeof dataTransfer.getSupportStatus>;

  constructor(workerUrl?: string, options: WorkerOptions = {}) {
    this.workerUrl = workerUrl || this.createWorkerUrl();
    this.options = {
      timeout: 30000, // 默认30秒超时
      maxConcurrent: 10, // 默认最大10个并发任务
      ...options,
    };

    // 检测环境支持
    this.isWorkerSupported = this.detectWorkerSupport();
    this.supportStatus = dataTransfer.getSupportStatus();

    this.logCompatibilityStatus();
  }

  /**
   * 检测 Web Worker 支持
   */
  private detectWorkerSupport(): boolean {
    const supportResult = safeSync(
      () => typeof Worker !== 'undefined' && typeof window !== 'undefined',
      ErrorType.UNSUPPORTED_ERROR,
      { feature: 'web-worker' }
    );

    return supportResult.getOrDefault(false);
  }

  /**
   * 记录兼容性状态
   */
  private logCompatibilityStatus(): void {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('TextRank Worker 客户端兼容性状态:', {
        worker: this.isWorkerSupported ? '✅ 支持' : '❌ 不支持',
        transferable: this.supportStatus.transferable ? '✅ 支持' : '❌ 不支持',
        fallback: !this.isWorkerSupported ? '⚠️ 将使用同步降级模式' : '',
      });
    }
  }

  /**
   * 初始化 Worker（带兼容性检测）
   */
  private async initWorker(): Promise<TextRankResult<void>> {
    if (this.worker) return ok(undefined);

    if (!this.isWorkerSupported) {
      return errOf(
        ErrorType.UNSUPPORTED_ERROR,
        'Web Worker 不支持，请使用同步模式或检查浏览器兼容性'
      );
    }

    return await safeAsync(
      async () => {
        return new Promise<void>((resolve, reject) => {
          const workerResult = safeSync(
            () => {
              this.worker = new Worker(this.workerUrl, { type: 'module' });

              this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                this.handleWorkerMessage(event.data);
              };

              this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.worker = null;
                reject(new Error(`Worker 初始化失败: ${error.message || 'Unknown error'}`));
              };

              return this.worker;
            },
            ErrorType.WORKER_ERROR,
            { url: this.workerUrl }
          );

          if (workerResult.isError()) {
            reject(new Error(`Worker 创建失败: ${workerResult.error.message}`));
            return;
          }

          const worker = workerResult.value;

          const initTimeout = setTimeout(() => {
            if (this.worker) {
              this.worker.terminate();
              this.worker = null;
            }
            reject(new Error('Worker 初始化超时'));
          }, this.options.timeout || 30000);

          const readyHandler = (event: MessageEvent<WorkerMessage>) => {
            if (event.data.id === 'worker-ready') {
              clearTimeout(initTimeout);
              worker.removeEventListener('message', readyHandler);
              resolve();
            }
          };

          worker.addEventListener('message', readyHandler);
        });
      },
      ErrorType.WORKER_ERROR,
      { phase: 'initialization' }
    );
  }

  /**
   * 创建 Worker URL（从模块代码创建）
   */
  private createWorkerUrl(): string {
    // 在浏览器环境中，需要用户提供 worker 文件的 URL
    // 这里返回默认路径，实际使用时需要根据部署情况调整
    return './textrank.worker.js';
  }

  /**
   * 处理 Worker 消息
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    if (message.id === 'worker-ready') return;

    const pending = this.pendingTasks.get(message.id);
    if (!pending) return;

    // 清理超时定时器
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    this.pendingTasks.delete(message.id);

    if (message.type === 'result') {
      // 处理可能的 Transferable 数据
      const payload = dataTransfer.processReceivedData(message.payload);
      pending.resolve(payload as WorkerResult);
    } else if (message.type === 'error') {
      const payload = dataTransfer.processReceivedData(message.payload);
      pending.reject(new Error((payload as WorkerResult).error));
    }
  }

  /**
   * 发送任务到 Worker
   */
  private async sendTask(
    type: 'analyze_keywords' | 'analyze_sentences',
    config: WorkerTaskConfig
  ): Promise<WorkerResult> {
    const initResult = await this.initWorker();
    if (initResult.isError()) {
      throw new Error(`Worker 初始化失败: ${initResult.error.message}`);
    }

    const worker = this.worker;
    if (!worker) {
      throw new Error('Worker not initialized');
    }

    // 检查并发任务数限制
    if (this.pendingTasks.size >= this.options.maxConcurrent) {
      throw new Error(`Too many concurrent tasks (max: ${this.options.maxConcurrent})`);
    }

    const taskId = `task_${++this.taskCounter}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      this.pendingTasks.set(taskId, { resolve, reject, timeout });

      // 准备数据进行传输（智能选择是否使用 Transferable）
      const { transferData, transferables, useTransferable } =
        dataTransfer.prepareDataForTransfer(config);

      const message: WorkerMessage = {
        id: taskId,
        type,
        payload: transferData,
      };

      const sendResult = safeSync(
        () => {
          if (useTransferable && transferables && transferables.length > 0) {
            message.transferable = transferables;
            worker.postMessage(message, transferables);

            if (typeof console !== 'undefined' && console.debug) {
              console.debug(
                `TextRank Worker: 使用 Transferable 发送 ${transferables.length} 个对象`
              );
            }
          } else {
            worker.postMessage(message);

            if (useTransferable && typeof console !== 'undefined' && console.debug) {
              console.debug('TextRank Worker: Transferable 准备失败，使用传统方式发送');
            }
          }
        },
        ErrorType.WORKER_ERROR,
        { taskId, messageType: type }
      );

      if (sendResult.isError()) {
        if (useTransferable) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(
              'TextRank Worker: Transferable 发送失败，降级到传统方式:',
              sendResult.error.message
            );
          }

          const fallbackResult = safeSync(
            () => {
              const fallbackMessage: WorkerMessage = {
                id: taskId,
                type,
                payload: config,
              };
              worker.postMessage(fallbackMessage);
            },
            ErrorType.WORKER_ERROR,
            { taskId, fallback: true }
          );

          if (fallbackResult.isError()) {
            this.pendingTasks.delete(taskId);
            clearTimeout(timeout);
            reject(new Error(`消息发送失败: ${fallbackResult.error.message}`));
            return;
          }
        } else {
          this.pendingTasks.delete(taskId);
          clearTimeout(timeout);
          reject(new Error(`消息发送失败: ${sendResult.error.message}`));
          return;
        }
      }
    });
  }

  /**
   * 关键词分析
   */
  async analyzeKeywords(
    text: string,
    config?: TextRankKeywordConfig,
    options?: {
      keywords?: { num?: number; wordMinLen?: number };
      keyphrases?: { keywordsNum?: number; minOccurNum?: number };
    }
  ): Promise<{
    keywords?: KeywordItem[];
    keyphrases?: string[];
    duration: number;
  }> {
    const taskConfig: WorkerTaskConfig = {
      text,
      ...(config ? { config } : {}),
      ...(options ? { options } : {}),
    };

    const result = await this.sendTask('analyze_keywords', taskConfig);

    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }

    const { keywords, keyphrases } = result.data ?? {};

    return {
      ...(keywords !== undefined ? { keywords } : {}),
      ...(keyphrases !== undefined ? { keyphrases } : {}),
      duration: result.duration || 0,
    };
  }

  /**
   * 句子分析和摘要生成
   */
  async analyzeSentences(
    text: string,
    config?: TextRankSentenceConfig,
    options?: {
      sentences?: { num?: number; sentenceMinLen?: number };
      summary?: {
        num?: number;
        sentenceMinLen?: number;
        sortByIndex?: boolean;
      };
    }
  ): Promise<{
    sentences?: SentenceItem[];
    summary?: string;
    duration: number;
  }> {
    const taskConfig: WorkerTaskConfig = {
      text,
      ...(config ? { config } : {}),
      ...(options ? { options } : {}),
    };

    const result = await this.sendTask('analyze_sentences', taskConfig);

    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }

    const { sentences, summary } = result.data ?? {};

    return {
      ...(sentences !== undefined ? { sentences } : {}),
      ...(summary !== undefined ? { summary } : {}),
      duration: result.duration || 0,
    };
  }

  /**
   * 完整分析（关键词 + 句子摘要）
   */
  async analyzeText(
    text: string,
    keywordConfig?: TextRankKeywordConfig,
    sentenceConfig?: TextRankSentenceConfig,
    options?: {
      keywords?: { num?: number; wordMinLen?: number };
      keyphrases?: { keywordsNum?: number; minOccurNum?: number };
      sentences?: { num?: number; sentenceMinLen?: number };
      summary?: {
        num?: number;
        sentenceMinLen?: number;
        sortByIndex?: boolean;
      };
    }
  ): Promise<{
    keywords?: KeywordItem[];
    keyphrases?: string[];
    sentences?: SentenceItem[];
    summary?: string;
    totalDuration: number;
  }> {
    const [keywordResult, sentenceResult] = await Promise.all([
      this.analyzeKeywords(text, keywordConfig, {
        ...(options?.keywords ? { keywords: options.keywords } : {}),
        ...(options?.keyphrases ? { keyphrases: options.keyphrases } : {}),
      }),
      this.analyzeSentences(text, sentenceConfig, {
        ...(options?.sentences ? { sentences: options.sentences } : {}),
        ...(options?.summary ? { summary: options.summary } : {}),
      }),
    ]);

    return {
      ...(keywordResult.keywords !== undefined ? { keywords: keywordResult.keywords } : {}),
      ...(keywordResult.keyphrases !== undefined ? { keyphrases: keywordResult.keyphrases } : {}),
      ...(sentenceResult.sentences !== undefined ? { sentences: sentenceResult.sentences } : {}),
      ...(sentenceResult.summary !== undefined ? { summary: sentenceResult.summary } : {}),
      totalDuration: keywordResult.duration + sentenceResult.duration,
    };
  }

  /**
   * 获取当前任务状态
   */
  getStatus(): {
    pendingTasks: number;
    maxConcurrent: number;
    workerReady: boolean;
    workerSupported: boolean;
    transferableSupported: boolean;
  } {
    return {
      pendingTasks: this.pendingTasks.size,
      maxConcurrent: this.options.maxConcurrent,
      workerReady: this.worker !== null,
      workerSupported: this.isWorkerSupported,
      transferableSupported: this.supportStatus.transferable,
    };
  }

  /**
   * 获取完整的兼容性信息
   */
  getCompatibilityInfo(): {
    worker: { supported: boolean; available: boolean };
    transferable: { supported: boolean };
    textEncoder: { supported: boolean };
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (!this.isWorkerSupported) {
      recommendations.push('建议升级到支持 Web Workers 的现代浏览器');
    }

    if (!this.supportStatus.transferable) {
      recommendations.push('Transferable 对象不支持，将使用传统数据传输');
    }

    if (!this.supportStatus.textEncoder) {
      recommendations.push('TextEncoder/TextDecoder 不支持，将使用手动编码');
    }

    return {
      worker: {
        supported: this.isWorkerSupported,
        available: this.worker !== null,
      },
      transferable: {
        supported: this.supportStatus.transferable,
      },
      textEncoder: {
        supported: this.supportStatus.textEncoder,
      },
      recommendations,
    };
  }

  /**
   * 健康检查 - 验证 Worker 是否正常工作
   */
  async healthCheck(): Promise<
    TextRankResult<{
      healthy: boolean;
      latency?: number;
    }>
  > {
    if (!this.isWorkerSupported) {
      return errOf(ErrorType.UNSUPPORTED_ERROR, 'Web Worker 不支持');
    }

    return await safeAsync(
      async () => {
        const startTime = performance.now();

        await this.analyzeKeywords('测试', { window: 2 }, { keywords: { num: 1 } });

        const latency = performance.now() - startTime;

        return {
          healthy: true,
          latency,
        };
      },
      ErrorType.WORKER_ERROR,
      { feature: 'health-check' }
    );
  }

  /**
   * 清理资源
   */
  terminate(): void {
    // 清理所有待处理的任务
    for (const task of this.pendingTasks.values()) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Worker terminated'));
    }
    this.pendingTasks.clear();

    // 终止 Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
