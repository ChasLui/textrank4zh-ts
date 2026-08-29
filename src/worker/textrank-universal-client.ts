import type {
  WorkerMessage,
  WorkerResult,
  WorkerOptions,
  WorkerStatus,
  WorkerTaskConfig,
  SyncModeHandlers,
  TextRankResult,
  TextRankKeywordConfig,
  TextRankSentenceConfig,
} from '../types';
import { WorkerType, ErrorType } from '../types';
import { dataTransfer } from '../utils/data-transfer';
import { mainThreadScheduler } from '../utils/main-thread-scheduler';
import { TextRankKeyword } from '../core/textrank-keyword';
import { TextRankSentence } from '../core/textrank-sentence';
import { safeAsync, ok } from '../utils/result-helpers';

/**
 * Worker 任务载荷。
 * 调用方直接透传可选参数，exactOptionalPropertyTypes 下需显式允许 undefined 值
 */
type WorkerTaskPayload = {
  [K in keyof WorkerTaskConfig]: WorkerTaskConfig[K] | undefined;
};

/**
 * 通用 TextRank Worker 客户端
 * 支持三级降级策略：SharedWorker → DedicatedWorker → SyncMode
 */
export class TextRankUniversalClient {
  private workerUrl: string;
  private options: Required<WorkerOptions>;
  private currentWorkerType: WorkerType;
  private worker: Worker | SharedWorker | null = null;
  private sharedWorkerPort: MessagePort | null = null;
  private pendingTasks = new Map<
    string,
    {
      resolve: (result: WorkerResult) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private syncHandlers: SyncModeHandlers | null = null;
  private connectionCount = 0;
  private isInitialized = false;

  constructor(workerUrl: string, options: WorkerOptions = {}) {
    this.workerUrl = workerUrl;
    this.options = {
      timeout: options.timeout || 30000,
      maxConcurrent: options.maxConcurrent || 10,
      preferredWorkerType: options.preferredWorkerType || 'auto',
      fallbackToSync: options.fallbackToSync !== false,
      syncScheduling: options.syncScheduling || {
        timeSlice: 5,
        maxContinuousTime: 16,
        priority: 'background',
        idleTimeout: 50,
      },
    };

    // 根据用户偏好和环境支持选择 Worker 类型
    this.currentWorkerType = this.selectWorkerType();

    // 初始化同步模式处理器
    this.initSyncHandlers();

    // 立即初始化 Worker
    this.initializeWorker();
  }

  /**
   * 选择最佳的 Worker 类型
   */
  private selectWorkerType(): WorkerType {
    const supportStatus = dataTransfer.getSupportStatus();
    const recommended = dataTransfer.getRecommendedWorkerType();

    // 如果用户指定了类型，尝试使用
    if (this.options.preferredWorkerType !== 'auto') {
      switch (this.options.preferredWorkerType) {
        case 'shared':
          return supportStatus.sharedWorker ? WorkerType.SHARED : recommended;
        case 'dedicated':
          return supportStatus.worker ? WorkerType.DEDICATED : recommended;
        default:
          return recommended;
      }
    }

    return recommended;
  }

  /**
   * 初始化同步模式处理器
   */
  private initSyncHandlers(): void {
    this.syncHandlers = {
      analyzeKeywords: async (text, config, options) => {
        const taskResult = await mainThreadScheduler.scheduleTask(async () => {
          const tr4w = new TextRankKeyword();
          tr4w.analyze(text, config);

          const result: NonNullable<WorkerResult['data']> = {};

          if (options?.keywords) {
            result.keywords = tr4w.getKeywords(
              options.keywords.num || 10,
              options.keywords.wordMinLen || 1
            );
          }

          if (options?.keyphrases) {
            result.keyphrases = tr4w.getKeyphrases(
              options.keyphrases.keywordsNum || 12,
              options.keyphrases.minOccurNum || 2
            );
          }

          return result;
        }, this.options.syncScheduling || {});

        if (!taskResult.ok) {
          throw new Error(`关键词分析失败: ${taskResult.error?.message || '未知错误'}`);
        }
        return taskResult.value;
      },

      analyzeSentences: async (text, config, options) => {
        const taskResult = await mainThreadScheduler.scheduleTask(async () => {
          const tr4s = new TextRankSentence();
          tr4s.analyze(text, config);

          const result: NonNullable<WorkerResult['data']> = {};

          if (options?.sentences) {
            result.sentences = tr4s.getKeySentences(
              options.sentences.num || 5,
              options.sentences.sentenceMinLen || 6
            );
          }

          if (options?.summary) {
            result.summary = tr4s.getSummary(
              options.summary.num || 3,
              options.summary.sentenceMinLen || 6,
              options.summary.sortByIndex !== false
            );
          }

          return result;
        }, this.options.syncScheduling || {});

        if (!taskResult.ok) {
          throw new Error(`句子分析失败: ${taskResult.error?.message || '未知错误'}`);
        }
        return taskResult.value;
      },
    };
  }

  /**
   * 初始化 Worker
   */
  private async initializeWorker(): Promise<TextRankResult<void>> {
    const initResult = await safeAsync(
      async () => {
        if (this.currentWorkerType === WorkerType.SYNC) {
          console.log('TextRank4ZH-TS: 使用同步模式处理');
          this.isInitialized = true;
          return;
        }

        if (this.currentWorkerType === WorkerType.SHARED) {
          await this.initSharedWorker();
        } else {
          await this.initDedicatedWorker();
        }

        this.isInitialized = true;
        console.log(`TextRank4ZH-TS: ${this.currentWorkerType} Worker 初始化成功`);
      },
      ErrorType.WORKER_ERROR,
      { workerType: this.currentWorkerType }
    );

    if (!initResult.ok) {
      console.warn(
        `TextRank4ZH-TS: ${this.currentWorkerType} Worker 初始化失败:`,
        initResult.error?.message || '未知错误'
      );
      const fallbackResult = await this.fallbackToNextWorkerType();
      return fallbackResult;
    }

    return initResult;
  }

  /**
   * 初始化 SharedWorker
   */
  private async initSharedWorker(): Promise<void> {
    const initResult = await safeAsync(
      async () => {
        this.worker = new SharedWorker(this.workerUrl, { type: 'module' });
        this.sharedWorkerPort = (this.worker as SharedWorker).port;

        this.sharedWorkerPort.onmessage = this.handleMessage.bind(this);
        this.sharedWorkerPort.addEventListener('messageerror', ((error: Event) => {
          this.handleError(error as ErrorEvent);
        }) as EventListener);

        this.sharedWorkerPort.start();
        this.connectionCount++;

        await this.waitForWorkerReady();
      },
      ErrorType.WORKER_ERROR,
      { workerType: 'SharedWorker', url: this.workerUrl }
    );

    if (!initResult.ok) {
      throw new Error(`SharedWorker 初始化失败: ${initResult.error?.message || '未知错误'}`);
    }
  }

  /**
   * 初始化专用 Worker
   */
  private async initDedicatedWorker(): Promise<void> {
    const initResult = await safeAsync(
      async () => {
        this.worker = new Worker(this.workerUrl, { type: 'module' });

        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = this.handleError.bind(this);

        await this.waitForWorkerReady();
      },
      ErrorType.WORKER_ERROR,
      { workerType: 'DedicatedWorker', url: this.workerUrl }
    );

    if (!initResult.ok) {
      throw new Error(`DedicatedWorker 初始化失败: ${initResult.error?.message || '未知错误'}`);
    }
  }

  /**
   * 等待 Worker 准备就绪
   */
  private waitForWorkerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 等待 Worker 主动广播的 worker-ready 消息。
      // 旧实现发一条空任务并在 postMessage() 落地时就判定就绪，而 postMessage()
      // 只负责投递、不等回执，导致「就绪」恒为真、5 秒超时形同虚设，
      // 连 Worker 脚本 404 都会被当成初始化成功。
      const target: Worker | MessagePort | null =
        this.currentWorkerType === WorkerType.SHARED
          ? this.sharedWorkerPort
          : (this.worker as Worker | null);

      if (!target) {
        reject(new Error('Worker 尚未创建，无法等待就绪'));
        return;
      }

      function readyHandler(event: Event): void {
        const message = (event as MessageEvent<WorkerMessage>).data;
        if (message?.id !== 'worker-ready') return;
        clearTimeout(timeout);
        target?.removeEventListener('message', readyHandler);
        resolve();
      }

      const timeout = setTimeout(() => {
        target?.removeEventListener('message', readyHandler);
        reject(new Error('Worker 初始化超时'));
      }, 5000);

      target.addEventListener('message', readyHandler);
    });
  }

  /**
   * 降级到下一个 Worker 类型
   */
  private async fallbackToNextWorkerType(): Promise<TextRankResult<void>> {
    console.warn(`TextRank4ZH-TS: 正在从 ${this.currentWorkerType} 降级...`);

    return await safeAsync(
      async () => {
        if (this.currentWorkerType === WorkerType.SHARED) {
          this.currentWorkerType = WorkerType.DEDICATED;
          console.log('TextRank4ZH-TS: 降级到 DedicatedWorker');
        } else if (this.currentWorkerType === WorkerType.DEDICATED) {
          if (this.options.fallbackToSync) {
            this.currentWorkerType = WorkerType.SYNC;
            console.log('TextRank4ZH-TS: 降级到同步模式');
          } else {
            throw new Error('Worker 不可用且未启用同步模式降级');
          }
        } else {
          throw new Error('所有 Worker 类型都不可用');
        }

        const initResult = await this.initializeWorker();
        if (!initResult.ok) {
          throw new Error(`降级后初始化失败: ${initResult.error?.message || '未知错误'}`);
        }
      },
      ErrorType.WORKER_ERROR,
      { originalType: this.currentWorkerType, fallback: true }
    );
  }

  /**
   * 处理消息
   */
  private handleMessage(event: MessageEvent): void {
    const message: WorkerMessage = event.data;
    const task = this.pendingTasks.get(message.id);

    if (!task) return;

    // payload 跨序列化边界传回，结构由 type 决定，读取侧按需收窄
    if (message.type === 'error') {
      clearTimeout(task.timeout);
      this.pendingTasks.delete(message.id);
      const errorPayload = message.payload as { error?: string } | undefined;
      task.reject(new Error(errorPayload?.error || '未知错误'));
    } else if (message.type === 'result') {
      clearTimeout(task.timeout);
      this.pendingTasks.delete(message.id);

      const resultPayload = message.payload as { duration?: number } | undefined;

      // 处理可能的 Transferable 数据
      const processedData = dataTransfer.processReceivedData(message.payload) as NonNullable<
        WorkerResult['data']
      >;

      task.resolve({
        id: message.id,
        success: true,
        data: processedData,
        ...(resultPayload?.duration !== undefined ? { duration: resultPayload.duration } : {}),
      });
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: ErrorEvent): void {
    console.error('TextRank4ZH-TS Worker 错误:', error);

    // 清理所有待处理任务
    this.pendingTasks.forEach((task) => {
      clearTimeout(task.timeout);
      task.reject(new Error(`Worker 错误: ${error.message}`));
    });
    this.pendingTasks.clear();
  }

  /**
   * 发送消息到 Worker
   */
  private async postMessage(message: WorkerMessage): Promise<void> {
    if (this.currentWorkerType === WorkerType.SYNC) {
      // 同步模式不需要发送消息
      return Promise.resolve();
    }

    const { transferData, transferables } = dataTransfer.prepareDataForTransfer(message.payload);

    const finalMessage: WorkerMessage = {
      ...message,
      payload: transferData,
    };

    if (this.currentWorkerType === WorkerType.SHARED && this.sharedWorkerPort) {
      if (transferables && transferables.length > 0) {
        this.sharedWorkerPort.postMessage(finalMessage, transferables);
      } else {
        this.sharedWorkerPort.postMessage(finalMessage);
      }
    } else if (this.worker && this.currentWorkerType === WorkerType.DEDICATED) {
      if (transferables && transferables.length > 0) {
        (this.worker as Worker).postMessage(finalMessage, transferables);
      } else {
        (this.worker as Worker).postMessage(finalMessage);
      }
    }
  }

  /**
   * 关键词分析
   */
  async analyzeKeywords(
    text: string,
    config?: TextRankKeywordConfig,
    options?: WorkerTaskConfig['options']
  ): Promise<WorkerResult> {
    if (!this.isInitialized) {
      throw new Error('Worker 客户端未初始化');
    }

    if (this.currentWorkerType === WorkerType.SYNC && this.syncHandlers) {
      const syncHandlers = this.syncHandlers;
      const startTime = Date.now();
      const syncResult = await safeAsync(
        () => syncHandlers.analyzeKeywords(text, config, options),
        ErrorType.COMPUTATION_ERROR,
        { method: 'analyzeKeywords', mode: 'sync' }
      );

      const errorMessage = syncResult.ok ? undefined : syncResult.error?.message;

      return {
        id: `sync-${Date.now()}`,
        success: syncResult.ok,
        ...(syncResult.ok && syncResult.value !== undefined ? { data: syncResult.value } : {}),
        ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        duration: Date.now() - startTime,
      };
    }

    return this.executeWorkerTask('analyze_keywords', {
      text,
      config,
      options,
    });
  }

  /**
   * 句子分析
   */
  async analyzeSentences(
    text: string,
    config?: TextRankSentenceConfig,
    options?: WorkerTaskConfig['options']
  ): Promise<WorkerResult> {
    if (!this.isInitialized) {
      throw new Error('Worker 客户端未初始化');
    }

    if (this.currentWorkerType === WorkerType.SYNC && this.syncHandlers) {
      const syncHandlers = this.syncHandlers;
      const startTime = Date.now();
      const syncResult = await safeAsync(
        () => syncHandlers.analyzeSentences(text, config, options),
        ErrorType.COMPUTATION_ERROR,
        { method: 'analyzeSentences', mode: 'sync' }
      );

      const errorMessage = syncResult.ok ? undefined : syncResult.error?.message;

      return {
        id: `sync-${Date.now()}`,
        success: syncResult.ok,
        ...(syncResult.ok && syncResult.value !== undefined ? { data: syncResult.value } : {}),
        ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        duration: Date.now() - startTime,
      };
    }

    return this.executeWorkerTask('analyze_sentences', {
      text,
      config,
      options,
    });
  }

  /**
   * 执行 Worker 任务
   */
  private executeWorkerTask(
    type: 'analyze_keywords' | 'analyze_sentences',
    payload: WorkerTaskPayload
  ): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      if (this.pendingTasks.size >= this.options.maxConcurrent) {
        reject(new Error('任务队列已满'));
        return;
      }

      const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const timeout = setTimeout(() => {
        this.pendingTasks.delete(id);
        reject(new Error('任务超时'));
      }, this.options.timeout);

      this.pendingTasks.set(id, { resolve, reject, timeout });

      const message: WorkerMessage = {
        id,
        type,
        payload,
      };

      this.postMessage(message).catch((error) => {
        clearTimeout(timeout);
        this.pendingTasks.delete(id);
        reject(error);
      });
    });
  }

  /**
   * 获取客户端状态
   */
  getStatus(): WorkerStatus {
    return {
      type: this.currentWorkerType,
      supported: this.currentWorkerType !== WorkerType.SYNC || this.options.fallbackToSync,
      available: this.isInitialized,
      ...(this.currentWorkerType === WorkerType.SHARED
        ? { connectionCount: this.connectionCount }
        : {}),
    };
  }

  /**
   * 获取详细状态（包含调度器信息）
   */
  async getDetailedStatus(): Promise<
    WorkerStatus & {
      schedulerStatus?: ReturnType<typeof mainThreadScheduler.getStatus>;
      mainThreadBusyness?: Awaited<
        ReturnType<typeof mainThreadScheduler.measureMainThreadBusyness>
      >;
    }
  > {
    const basicStatus = this.getStatus();

    if (this.currentWorkerType === WorkerType.SYNC) {
      const [schedulerStatus, busyness] = await Promise.all([
        Promise.resolve(mainThreadScheduler.getStatus()),
        mainThreadScheduler.measureMainThreadBusyness(),
      ]);

      return {
        ...basicStatus,
        schedulerStatus,
        mainThreadBusyness: busyness,
      };
    }

    return basicStatus;
  }

  /**
   * 自适应调整同步模式调度配置
   */
  async optimizeSyncScheduling(): Promise<TextRankResult<void>> {
    if (this.currentWorkerType !== WorkerType.SYNC) {
      return ok(undefined);
    }

    const optimizeResult = await safeAsync(
      async () => {
        const busynessResult = await mainThreadScheduler.measureMainThreadBusyness();
        if (!busynessResult.ok) {
          throw new Error(`主线程繁忙程度检测失败: ${busynessResult.error?.message || '未知错误'}`);
        }

        const busyness = busynessResult.value;
        const currentScheduling = this.options.syncScheduling || {};

        switch (busyness.recommendation) {
          case 'aggressive':
            this.options.syncScheduling = {
              ...currentScheduling,
              timeSlice: 10,
              maxContinuousTime: 32,
              priority: 'normal',
            };
            break;

          case 'moderate':
            this.options.syncScheduling = {
              ...currentScheduling,
              timeSlice: 5,
              maxContinuousTime: 16,
              priority: 'background',
            };
            break;

          case 'conservative':
            this.options.syncScheduling = {
              ...currentScheduling,
              timeSlice: 2,
              maxContinuousTime: 8,
              priority: 'background',
              idleTimeout: 20,
            };
            break;
        }

        console.log(
          `TextRank4ZH-TS: 根据主线程繁忙程度 (${busyness.averageFrameTime.toFixed(2)}ms) 调整为 ${busyness.recommendation} 调度策略`
        );
      },
      ErrorType.COMPUTATION_ERROR,
      { feature: 'sync-scheduling-optimization' }
    );

    if (!optimizeResult.ok) {
      console.warn(
        'TextRank4ZH-TS: 主线程繁忙程度检测失败',
        optimizeResult.error?.message || '未知错误'
      );
    }

    return optimizeResult;
  }

  /**
   * 获取待处理任务数量
   */
  getPendingTasksCount(): number {
    return this.pendingTasks.size;
  }

  /**
   * 终止 Worker
   */
  terminate(): void {
    // 清理所有待处理任务
    this.pendingTasks.forEach((task) => {
      clearTimeout(task.timeout);
      task.reject(new Error('Worker 已终止'));
    });
    this.pendingTasks.clear();

    if (this.worker) {
      if (this.currentWorkerType === WorkerType.SHARED) {
        // SharedWorker 只关闭端口，不终止 Worker
        if (this.sharedWorkerPort) {
          this.sharedWorkerPort.close();
          this.sharedWorkerPort = null;
        }
        this.connectionCount--;
      } else if (this.currentWorkerType === WorkerType.DEDICATED) {
        (this.worker as Worker).terminate();
      }

      this.worker = null;
    }

    this.isInitialized = false;
  }

  /**
   * 检查是否支持指定的 Worker 类型
   */
  static supportsWorkerType(type: WorkerType): boolean {
    const supportStatus = dataTransfer.getSupportStatus();

    switch (type) {
      case WorkerType.SHARED:
        return supportStatus.sharedWorker;
      case WorkerType.DEDICATED:
        return supportStatus.worker;
      case WorkerType.SYNC:
        return true; // 同步模式总是支持的
      default:
        return false;
    }
  }

  /**
   * 获取推荐的 Worker 类型
   */
  static getRecommendedWorkerType(): WorkerType {
    return dataTransfer.getRecommendedWorkerType();
  }
}
