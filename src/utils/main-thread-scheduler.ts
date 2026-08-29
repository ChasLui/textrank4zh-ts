/**
 * 主线程任务调度器
 * 支持三级降级策略：Background Task API → Promise → 同步调用
 * 确保不阻塞主线程 UI 渲染
 */

import type { TextRankResult } from '../types';
import { ErrorType } from '../types';
import { safeSync, safeAsync } from './result-helpers';

// 类型定义已在 ../types/index.ts 中统一管理

export interface SchedulerOptions {
  timeSlice?: number; // 时间片大小（毫秒），默认 5ms
  maxContinuousTime?: number; // 最大连续执行时间，默认 16ms (60fps)
  idleTimeout?: number; // requestIdleCallback 超时时间，默认 50ms
  yieldInterval?: number; // 让出控制权间隔（迭代次数），默认 1000
  priority?: 'background' | 'normal' | 'user-blocking'; // 任务优先级
}

export interface ScheduledTask<T = unknown> {
  id: string;
  execute: () => T | Promise<T>;
  onProgress?: (progress: number) => void;
  onComplete?: (result: T) => void;
  onError?: (error: Error) => void;
}

export interface SchedulerCapabilities {
  requestIdleCallback: boolean;
  scheduler: boolean;
  messageChannel: boolean;
  postTaskScheduler: boolean;
}

/**
 * 主线程任务调度器
 */
export class MainThreadScheduler {
  private capabilities: SchedulerCapabilities;
  private runningTasks = new Map<string, AbortController>();
  private taskQueue: Array<ScheduledTask> = [];

  constructor() {
    this.capabilities = this.detectCapabilities();
    this.logCapabilities();
  }

  /**
   * 检测浏览器调度 API 支持能力
   */
  private detectCapabilities(): SchedulerCapabilities {
    const capabilities: SchedulerCapabilities = {
      requestIdleCallback: false,
      scheduler: false,
      messageChannel: false,
      postTaskScheduler: false,
    };

    const detectionResult = safeSync(
      () => {
        // 检测 requestIdleCallback 支持
        capabilities.requestIdleCallback =
          typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';

        // 检测 Scheduler API 支持 (实验性)
        capabilities.scheduler =
          typeof window !== 'undefined' &&
          'scheduler' in window &&
          typeof window.scheduler?.postTask === 'function';

        // 检测 MessageChannel 支持
        capabilities.messageChannel = typeof MessageChannel !== 'undefined';

        // 检测 postTask 调度器支持 (Chrome 94+)
        capabilities.postTaskScheduler =
          typeof window !== 'undefined' &&
          'scheduler' in window &&
          typeof window.scheduler?.postTask === 'function';

        return capabilities;
      },
      ErrorType.UNSUPPORTED_ERROR,
      { feature: 'scheduler-detection' }
    );

    if (detectionResult && detectionResult.isError()) {
      console.warn('TextRank4ZH-TS: 调度能力检测失败', detectionResult.error.message);
    } else if (detectionResult && detectionResult.value) {
      // 如果检测成功，使用检测结果
      Object.assign(capabilities, detectionResult.value);
    }

    return capabilities;
  }

  /**
   * 记录支持能力
   */
  private logCapabilities(): void {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('TextRank4ZH-TS 主线程调度能力:', {
        requestIdleCallback: this.capabilities.requestIdleCallback ? '✅ 支持' : '❌ 不支持',
        scheduler: this.capabilities.scheduler ? '✅ 支持' : '❌ 不支持',
        messageChannel: this.capabilities.messageChannel ? '✅ 支持' : '❌ 不支持',
        postTaskScheduler: this.capabilities.postTaskScheduler ? '✅ 支持' : '❌ 不支持',
      });
    }
  }

  /**
   * 获取推荐的调度方式
   */
  getRecommendedSchedulingMethod(): 'background-task' | 'promise' | 'sync' {
    if (this.capabilities.requestIdleCallback || this.capabilities.postTaskScheduler) {
      return 'background-task';
    }
    if (this.capabilities.messageChannel || typeof Promise !== 'undefined') {
      return 'promise';
    }
    return 'sync';
  }

  /**
   * 调度执行任务（智能选择调度方式）
   */
  async scheduleTask<T>(
    taskFn: () => T | Promise<T>,
    options: SchedulerOptions = {}
  ): Promise<TextRankResult<T>> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const schedulingMethod = this.getRecommendedSchedulingMethod();

    const task: ScheduledTask<T> = {
      id: taskId,
      execute: taskFn,
      // 用户阻塞任务不报告进度，避免额外开销
      ...(options.priority === 'user-blocking' ? {} : { onProgress: () => {} }),
    };

    const executeResult = await safeAsync(
      async () => {
        switch (schedulingMethod) {
          case 'background-task':
            return await this.executeWithBackgroundTask(task, options);
          case 'promise':
            return await this.executeWithPromise(task, options);
          default:
            return await this.executeSync(task);
        }
      },
      ErrorType.COMPUTATION_ERROR,
      { taskId, schedulingMethod }
    );

    if (executeResult.isError()) {
      console.warn(
        `TextRank4ZH-TS: ${schedulingMethod} 调度失败，降级执行:`,
        executeResult.error.message
      );

      // 降级策略
      if (schedulingMethod === 'background-task') {
        const promiseResult = await safeAsync(
          () => this.executeWithPromise(task, options),
          ErrorType.COMPUTATION_ERROR,
          { taskId, fallback: 'promise' }
        );
        if (!promiseResult.ok) {
          return await safeAsync(() => this.executeSync(task), ErrorType.COMPUTATION_ERROR, {
            taskId,
            fallback: 'sync',
          });
        }
        return promiseResult;
      } else if (schedulingMethod === 'promise') {
        return await safeAsync(() => this.executeSync(task), ErrorType.COMPUTATION_ERROR, {
          taskId,
          fallback: 'sync',
        });
      }
      return executeResult;
    }

    return executeResult;
  }

  /**
   * 使用后台任务 API 执行（最优选择）
   */
  private async executeWithBackgroundTask<T>(
    task: ScheduledTask<T>,
    options: SchedulerOptions
  ): Promise<T> {
    const { maxContinuousTime = 16, idleTimeout = 50 } = options;

    const promise = new Promise<T>((resolve, reject) => {
      const abortController = new AbortController();
      this.runningTasks.set(task.id, abortController);

      const executeWithIdleCallback = () => {
        if (abortController.signal.aborted) {
          reject(new Error('Task aborted'));
          return;
        }

        if (this.capabilities.requestIdleCallback) {
          // 使用 requestIdleCallback
          window.requestIdleCallback(
            (deadline) => {
              const executeResult = safeSync(
                () => {
                  const startTime = performance.now();

                  const executeInIdleTime = () => {
                    if (abortController.signal.aborted) {
                      throw new Error('Task aborted');
                    }

                    const now = performance.now();
                    const elapsed = now - startTime;

                    if (deadline.timeRemaining() > 0 && elapsed < maxContinuousTime) {
                      const result = task.execute();
                      if (result instanceof Promise) {
                        result.then(resolve).catch(reject);
                      } else {
                        resolve(result);
                      }
                    } else {
                      executeWithIdleCallback();
                    }
                  };

                  executeInIdleTime();
                },
                ErrorType.COMPUTATION_ERROR,
                { taskId: task.id, method: 'requestIdleCallback' }
              );

              if (executeResult.isError()) {
                reject(new Error(executeResult.error.message));
              }
            },
            { timeout: idleTimeout }
          );
        } else if (this.capabilities.postTaskScheduler) {
          // 使用现代 Scheduler API
          const scheduler = window.scheduler;
          const priority =
            options.priority === 'user-blocking'
              ? 'user-blocking'
              : options.priority === 'normal'
                ? 'user-visible'
                : 'background';

          const taskResult = safeSync(
            () => {
              return scheduler.postTask(
                () => {
                  if (abortController.signal.aborted) {
                    throw new Error('Task aborted');
                  }

                  const result = task.execute();
                  if (result instanceof Promise) {
                    result.then(resolve).catch(reject);
                  } else {
                    resolve(result);
                  }
                },
                {
                  priority,
                  signal: abortController.signal,
                }
              );
            },
            ErrorType.COMPUTATION_ERROR,
            { taskId: task.id, method: 'postTask' }
          );

          if (taskResult.isError()) {
            reject(new Error(taskResult.error.message));
          } else {
            taskResult.value.catch(reject);
          }
        } else {
          // 两种调度能力都不可用时直接执行。
          // 缺少这个分支会让 Promise 既不 resolve 也不 reject，调用方永久挂起
          const fallbackResult = safeSync(
            () => {
              const result = task.execute();
              if (result instanceof Promise) {
                result.then(resolve).catch(reject);
              } else {
                resolve(result);
              }
            },
            ErrorType.COMPUTATION_ERROR,
            { taskId: task.id, method: 'sync-fallback' }
          );

          if (fallbackResult.isError()) {
            reject(new Error(fallbackResult.error.message));
          }
        }
      };

      executeWithIdleCallback();
    });

    // 任务进入终态后清理，否则 AbortController 只在 cancel 路径被移除，会持续累积
    return promise.finally(() => {
      this.runningTasks.delete(task.id);
    });
  }

  /**
   * 使用 Promise 微任务执行（降级选择）
   */
  private async executeWithPromise<T>(
    task: ScheduledTask<T>,
    options: SchedulerOptions
  ): Promise<T> {
    const { timeSlice = 5 } = options;

    const promise = new Promise<T>((resolve, reject) => {
      const abortController = new AbortController();
      this.runningTasks.set(task.id, abortController);

      const executeWithYielding = async () => {
        const executeResult = await safeAsync(
          async () => {
            if (abortController.signal.aborted) {
              throw new Error('Task aborted');
            }

            const yieldControl = () => {
              return new Promise<void>((yieldResolve) => {
                if (this.capabilities.messageChannel) {
                  const channel = new MessageChannel();
                  channel.port1.onmessage = () => yieldResolve();
                  channel.port2.postMessage(null);
                } else {
                  setTimeout(yieldResolve, 0);
                }
              });
            };

            const startTime = performance.now();

            const executeChunk = async (): Promise<T> => {
              const result = task.execute();
              if (result instanceof Promise) {
                return await result;
              }
              return result;
            };

            const result = await executeChunk();
            const elapsed = performance.now() - startTime;

            if (elapsed > timeSlice) {
              await yieldControl();
            }

            return result;
          },
          ErrorType.COMPUTATION_ERROR,
          { taskId: task.id, method: 'promise' }
        );

        if (executeResult.isError()) {
          reject(new Error(executeResult.error.message));
        } else {
          resolve(executeResult.value as T);
        }
      };

      executeWithYielding();
    });

    // 同上：任务终态后释放 AbortController
    return promise.finally(() => {
      this.runningTasks.delete(task.id);
    });
  }

  /**
   * 同步执行（最后降级选择）
   */
  private async executeSync<T>(task: ScheduledTask<T>): Promise<T> {
    const executeResult = await safeAsync(
      async () => {
        const result = task.execute();
        if (result instanceof Promise) {
          return await result;
        }
        return result;
      },
      ErrorType.COMPUTATION_ERROR,
      { taskId: task.id, method: 'sync' }
    );

    if (executeResult.isError()) {
      throw new Error(executeResult.error.message);
    }
    return executeResult.value as T;
  }

  /**
   * 批量调度执行任务
   */
  async scheduleBatch<T>(
    tasks: Array<() => T | Promise<T>>,
    options: SchedulerOptions = {}
  ): Promise<TextRankResult<T[]>> {
    const { priority = 'background' } = options;

    return await safeAsync(
      async () => {
        if (priority === 'user-blocking') {
          const taskResults = await Promise.all(
            tasks.map((task) => this.scheduleTask(task, options))
          );
          const values: T[] = [];

          for (const result of taskResults) {
            if (!result.ok) {
              throw new Error(`任务执行失败: ${result.error.message}`);
            }
            values.push(result.value as T);
          }
          return values;
        } else {
          const results: T[] = [];
          for (const task of tasks) {
            const result = await this.scheduleTask(task, options);
            if (!result.ok) {
              throw new Error(`任务执行失败: ${result.error.message}`);
            }
            results.push(result.value as T);
          }
          return results;
        }
      },
      ErrorType.COMPUTATION_ERROR,
      { batchSize: tasks.length, priority }
    );
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.runningTasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * 取消所有任务
   */
  cancelAllTasks(): void {
    this.runningTasks.forEach((controller) => controller.abort());
    this.runningTasks.clear();
    this.taskQueue = [];
  }

  /**
   * 获取调度器状态
   */
  getStatus(): {
    runningTasks: number;
    queuedTasks: number;
    capabilities: SchedulerCapabilities;
    recommendedMethod: string;
  } {
    return {
      runningTasks: this.runningTasks.size,
      queuedTasks: this.taskQueue.length,
      capabilities: this.capabilities,
      recommendedMethod: this.getRecommendedSchedulingMethod(),
    };
  }

  /**
   * 检测当前主线程繁忙程度
   */
  async measureMainThreadBusyness(): Promise<
    TextRankResult<{
      averageFrameTime: number;
      isBlocked: boolean;
      recommendation: 'aggressive' | 'moderate' | 'conservative';
    }>
  > {
    return await safeAsync(
      async () => {
        return new Promise<{
          averageFrameTime: number;
          isBlocked: boolean;
          recommendation: 'aggressive' | 'moderate' | 'conservative';
        }>((resolve) => {
          const measurements: number[] = [];
          let measurementCount = 0;
          const maxMeasurements = 10;

          const measure = () => {
            const start = performance.now();

            if (this.capabilities.requestIdleCallback) {
              window.requestIdleCallback(() => {
                const frameTime = performance.now() - start;
                measurements.push(frameTime);
                measurementCount++;

                if (measurementCount < maxMeasurements) {
                  measure();
                } else {
                  const averageFrameTime =
                    measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
                  const isBlocked = averageFrameTime > 16.67;

                  let recommendation: 'aggressive' | 'moderate' | 'conservative';
                  if (averageFrameTime < 8) {
                    recommendation = 'aggressive';
                  } else if (averageFrameTime < 16.67) {
                    recommendation = 'moderate';
                  } else {
                    recommendation = 'conservative';
                  }

                  resolve({
                    averageFrameTime,
                    isBlocked,
                    recommendation,
                  });
                }
              });
            } else {
              setTimeout(() => {
                const frameTime = performance.now() - start;
                measurements.push(frameTime);
                measurementCount++;

                if (measurementCount < maxMeasurements) {
                  measure();
                } else {
                  const averageFrameTime =
                    measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
                  resolve({
                    averageFrameTime,
                    isBlocked: averageFrameTime > 20,
                    recommendation:
                      averageFrameTime < 10
                        ? 'aggressive'
                        : averageFrameTime < 20
                          ? 'moderate'
                          : 'conservative',
                  });
                }
              }, 0);
            }
          };

          measure();
        });
      },
      ErrorType.COMPUTATION_ERROR,
      { feature: 'busyness-measurement' }
    );
  }
}

/**
 * 单例调度器实例
 */
export const mainThreadScheduler = new MainThreadScheduler();
