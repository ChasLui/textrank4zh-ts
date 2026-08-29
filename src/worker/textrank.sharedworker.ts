/**
 * TextRank4ZH-TS SharedWorker 实现
 * 支持多标签页共享同一个 Worker 实例，提高资源利用率
 */

import type { WorkerMessage, WorkerResult, WorkerTaskConfig } from '../types';
import { ErrorType } from '../types';
import { TextRankKeyword } from '../core/textrank-keyword';
import { TextRankSentence } from '../core/textrank-sentence';
import { dataTransfer } from '../utils/data-transfer';
import { safeAsync } from '../utils/result-helpers';

// 连接管理器
interface ConnectionInfo {
  port: MessagePort;
  id: string;
  connectTime: number;
  taskCount: number;
}

class SharedWorkerManager {
  private connections = new Map<string, ConnectionInfo>();
  private taskCounter = 0;

  constructor() {
    // 监听新连接。lib.dom 把 self 声明为 Window，而本脚本实际运行在
    // SharedWorkerGlobalScope 中，这里收窄到确切的 Worker 全局类型
    const workerScope = self as unknown as SharedWorkerGlobalScope;
    workerScope.addEventListener('connect', this.handleConnect.bind(this));

    console.log('TextRank4ZH-TS SharedWorker 已启动');
  }

  /**
   * 处理新连接
   */
  private handleConnect(event: MessageEvent): void {
    const port = event.ports[0];
    if (!port) {
      console.error('SharedWorker connect 事件缺少 MessagePort，忽略该连接');
      return;
    }

    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const connectionInfo: ConnectionInfo = {
      port,
      id: connectionId,
      connectTime: Date.now(),
      taskCount: 0,
    };

    this.connections.set(connectionId, connectionInfo);

    // 设置消息处理器
    port.onmessage = (msgEvent) => this.handleMessage(connectionId, msgEvent);
    port.onmessageerror = (error) => this.handleMessageError(connectionId, error);

    // 启动端口
    port.start();

    // 广播就绪，与 DedicatedWorker 的 worker-ready 协议保持一致。
    // 客户端据此判定初始化完成；缺少它会导致客户端只能靠超时兜底
    const readyMessage: WorkerMessage = {
      id: 'worker-ready',
      type: 'result',
      payload: { message: 'TextRank SharedWorker is ready' },
    };
    port.postMessage(readyMessage);

    console.log(`SharedWorker 新连接: ${connectionId}, 总连接数: ${this.connections.size}`);
  }

  /**
   * 处理消息
   */
  private async handleMessage(connectionId: string, event: MessageEvent): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.error(`连接 ${connectionId} 不存在`);
      return;
    }

    const message: WorkerMessage = event.data;

    const handleResult = await safeAsync(
      async () => {
        // payload 跨序列化边界传入，结构由 message.type 约定
        const processedPayload = dataTransfer.processReceivedData(
          message.payload
        ) as WorkerTaskConfig;

        if (message.type === 'analyze_keywords' || message.type === 'analyze_sentences') {
          connection.taskCount++;
          this.taskCounter++;

          const startTime = Date.now();
          const taskResult = await this.processTask(message.type, processedPayload);
          const duration = Date.now() - startTime;

          const { transferData, transferables } = dataTransfer.prepareDataForTransfer({
            ...taskResult,
            duration,
            connectionId,
            totalConnections: this.connections.size,
            taskNumber: this.taskCounter,
          });

          const response: WorkerMessage = {
            id: message.id,
            type: 'result',
            payload: transferData,
          };

          if (transferables && transferables.length > 0) {
            connection.port.postMessage(response, transferables);
          } else {
            connection.port.postMessage(response);
          }

          console.log(
            `SharedWorker 任务完成: ${message.id}, 连接: ${connectionId}, 耗时: ${duration}ms`
          );
        }
      },
      ErrorType.WORKER_ERROR,
      { connectionId, messageId: message.id, messageType: message.type }
    );

    if (!handleResult.ok) {
      const errorResponse: WorkerMessage = {
        id: message.id,
        type: 'error',
        payload: {
          error: handleResult.error?.message || '未知错误',
          connectionId,
        },
      };

      connection.port.postMessage(errorResponse);
      console.error(
        `SharedWorker 任务失败: ${message.id}`,
        handleResult.error?.message || '未知错误'
      );
    }
  }

  /**
   * 处理消息错误
   */
  private handleMessageError(connectionId: string, error: MessageEvent): void {
    console.error(`SharedWorker 连接 ${connectionId} 消息错误:`, error);
  }

  /**
   * 处理具体任务
   */
  private async processTask(
    type: 'analyze_keywords' | 'analyze_sentences',
    payload: WorkerTaskConfig
  ): Promise<NonNullable<WorkerResult['data']>> {
    const { text, config = {}, options = {} } = payload;

    return await safeAsync(
      async () => {
        if (type === 'analyze_keywords') {
          const tr4w = new TextRankKeyword();
          tr4w.analyze(text, config);

          const result: NonNullable<WorkerResult['data']> = {};

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

          return result;
        }

        if (type === 'analyze_sentences') {
          const tr4s = new TextRankSentence();
          tr4s.analyze(text, config);

          const result: NonNullable<WorkerResult['data']> = {};

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

          return result;
        }

        throw new Error(`不支持的任务类型: ${type}`);
      },
      ErrorType.COMPUTATION_ERROR,
      { taskType: type, textLength: text?.length }
    ).then((result) => {
      if (!result.ok) {
        throw new Error(result.error?.message || '未知错误');
      }
      return result.value;
    });
  }

  /**
   * 断开连接
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.port.close();
      this.connections.delete(connectionId);
      console.log(`SharedWorker 连接断开: ${connectionId}, 剩余连接数: ${this.connections.size}`);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    connectionCount: number;
    totalTasks: number;
    uptime: number;
  } {
    return {
      connectionCount: this.connections.size,
      totalTasks: this.taskCounter,
      uptime: Date.now(), // SharedWorker 的启动时间就是脚本加载时间
    };
  }
}

// 启动 SharedWorker 管理器
new SharedWorkerManager();

// 导出类型（用于类型检查）
export type { SharedWorkerManager };
