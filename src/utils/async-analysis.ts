/**
 * 异步分析辅助工具
 * 基于主线程调度器提供非阻塞的文本分析能力
 */

import { mainThreadScheduler } from './main-thread-scheduler';
import { 
  AsyncAnalysisConfig, 
  AnalysisProgress,
  ProgressCallback,
  AsyncTextRankResult,
  ErrorType
} from '../types';
import { errOf } from './result-helpers';

/**
 * 异步执行工厂
 */
export class AsyncAnalysisExecutor {
  /**
   * 创建进度报告函数
   */
  private static createProgressReporter(
    onProgress: ProgressCallback | undefined
  ): (phase: AnalysisProgress['phase'], progress: number, message: string, details?: any) => void {
    if (!onProgress) {
      return () => {}; // 空函数，避免检查
    }

    return (phase: AnalysisProgress['phase'], progress: number, message: string, details?: any) => {
      const phaseWeights = {
        segmentation: 0.25,
        graph_building: 0.35, 
        pagerank: 0.35,
        sorting: 0.05,
        complete: 0
      };

      const phaseBaseProgress = {
        segmentation: 0,
        graph_building: 25,
        pagerank: 60,
        sorting: 95,
        complete: 100
      };

      const adjustedProgress = Math.min(100, phaseBaseProgress[phase] + (progress * phaseWeights[phase]));

      onProgress({
        phase,
        progress: adjustedProgress,
        message,
        details
      });
    };
  }

  /**
   * 异步执行分词分析
   */
  static async executeSegmentation<T>(
    segmentationFn: () => T,
    config: AsyncAnalysisConfig,
    reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>
  ): AsyncTextRankResult<T> {
    const {
      timeSlice = 5,
      maxContinuousTime = 16,
      yieldInterval = 100,
      priority = 'background'
    } = config;

    reportProgress('segmentation', 0, '开始文本分词...');

    const result = await mainThreadScheduler.scheduleTask(
      () => {
        reportProgress('segmentation', 50, '执行分词处理...');
        const segmentationResult = segmentationFn();
        reportProgress('segmentation', 100, '分词完成');
        return segmentationResult;
      },
      {
        timeSlice,
        maxContinuousTime,
        yieldInterval,
        priority
      }
    );

    return result;
  }

  /**
   * 异步执行图构建
   */
  static async executeGraphBuilding<T>(
    graphBuildingFn: () => T,
    config: AsyncAnalysisConfig,
    reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>,
    itemCount?: number
  ): AsyncTextRankResult<T> {
    const {
      timeSlice = 5,
      maxContinuousTime = 16, 
      yieldInterval = 100,
      priority = 'background'
    } = config;

    reportProgress('graph_building', 0, '构建关系图...', { totalItems: itemCount });

    // 如果有大量数据，分块处理
    if (itemCount && itemCount > 1000) {
      return await mainThreadScheduler.scheduleTask(
        async () => {
          let processedItems = 0;
          const chunkSize = Math.max(100, Math.floor(itemCount / 10));

          // 分块执行图构建
          const executeChunk = () => {
            const startTime = performance.now();
            let localProcessed = 0;

            while (localProcessed < chunkSize && processedItems < itemCount) {
              // 这里会被实际的图构建逻辑替换
              processedItems++;
              localProcessed++;

              if (performance.now() - startTime > timeSlice) {
                break;
              }
            }

            const progress = (processedItems / itemCount) * 100;
            reportProgress('graph_building', progress, 
              `构建关系图... (${processedItems}/${itemCount})`,
              { processedItems, totalItems: itemCount }
            );

            return processedItems >= itemCount;
          };

          while (processedItems < itemCount) {
            const isComplete = executeChunk();
            if (!isComplete && performance.now() % 16 < timeSlice) {
              // 让出控制权
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }

          reportProgress('graph_building', 100, '关系图构建完成');
          return graphBuildingFn();
        },
        { timeSlice, maxContinuousTime, yieldInterval, priority }
      );
    }

    // 小数据量直接处理
    return await mainThreadScheduler.scheduleTask(
      () => {
        reportProgress('graph_building', 50, '构建关系图...');
        const result = graphBuildingFn();
        reportProgress('graph_building', 100, '关系图构建完成');
        return result;
      },
      { timeSlice, maxContinuousTime, yieldInterval, priority }
    );
  }

  /**
   * 异步执行PageRank算法
   */
  static async executePageRank<T>(
    pageRankFn: (progressCallback?: (iteration: number, maxIterations: number) => void) => T,
    config: AsyncAnalysisConfig,
    reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>,
    maxIterations: number = 100
  ): AsyncTextRankResult<T> {
    const {
      timeSlice = 5,
      maxContinuousTime = 16,
      yieldInterval = 50, // PageRank迭代间隔更小
      priority = 'background'
    } = config;

    reportProgress('pagerank', 0, 'PageRank算法开始...', { maxIterations });

    return await mainThreadScheduler.scheduleTask(
      async () => {
        let currentIteration = 0;

        const iterationProgressCallback = (iteration: number, max: number) => {
          currentIteration = iteration;
          const progress = (iteration / max) * 100;
          reportProgress('pagerank', progress, 
            `PageRank迭代中... (${iteration}/${max})`,
            { iterations: iteration, maxIterations: max }
          );
        };

        // 如果迭代次数较多，需要分块处理
        if (maxIterations > 50) {
          let result: T;

          // 创建可中断的PageRank执行器
          const executePageRankChunked = async (): Promise<T> => {
            return new Promise((resolve, reject) => {
              const processChunk = async () => {
                try {
                  const startTime = performance.now();

                  // 执行PageRank的一个时间片
                  result = pageRankFn(iterationProgressCallback);

                  const elapsed = performance.now() - startTime;
                  
                  if (elapsed > maxContinuousTime && currentIteration < maxIterations) {
                    // 让出控制权
                    setTimeout(processChunk, 0);
                  } else {
                    resolve(result);
                  }
                } catch (error) {
                  reject(error);
                }
              };

              processChunk();
            });
          };

          result = await executePageRankChunked();
          reportProgress('pagerank', 100, 'PageRank算法完成');
          return result;
        }

        // 小迭代次数直接处理
        const result = pageRankFn(iterationProgressCallback);
        reportProgress('pagerank', 100, 'PageRank算法完成');
        return result;
      },
      { timeSlice, maxContinuousTime, yieldInterval, priority }
    );
  }

  /**
   * 异步执行结果排序
   */
  static async executeSorting<T>(
    sortingFn: () => T,
    config: AsyncAnalysisConfig,
    reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>
  ): AsyncTextRankResult<T> {
    const {
      timeSlice = 5,
      maxContinuousTime = 16,
      yieldInterval = 100,
      priority = 'background'
    } = config;

    reportProgress('sorting', 0, '结果排序中...');

    const result = await mainThreadScheduler.scheduleTask(
      () => {
        reportProgress('sorting', 50, '执行排序...');
        const sortedResult = sortingFn();
        reportProgress('sorting', 100, '排序完成');
        return sortedResult;
      },
      { timeSlice, maxContinuousTime, yieldInterval, priority }
    );

    return result;
  }

  /**
   * 完整的异步分析流程
   */
  static async executeFullAnalysis<T>(
    phases: {
      segmentation: () => any;
      graphBuilding: () => any; 
      pageRank: (progressCallback?: (iteration: number, max: number) => void) => any;
      sorting: () => T;
    },
    config: AsyncAnalysisConfig,
    options?: {
      itemCount?: number;
      maxIterations?: number;
    }
  ): AsyncTextRankResult<T> {
    const reportProgress = this.createProgressReporter(config.onProgress);

    try {
      // 阶段1: 分词
      const segmentationResult = await this.executeSegmentation(
        phases.segmentation, 
        config, 
        reportProgress
      );
      if (!segmentationResult.ok) {
        return segmentationResult;
      }

      // 阶段2: 构建图
      const graphResult = await this.executeGraphBuilding(
        phases.graphBuilding,
        config,
        reportProgress,
        options?.itemCount
      );
      if (!graphResult.ok) {
        return graphResult;
      }

      // 阶段3: PageRank计算
      const pageRankResult = await this.executePageRank(
        phases.pageRank,
        config,
        reportProgress,
        options?.maxIterations
      );
      if (!pageRankResult.ok) {
        return pageRankResult;
      }

      // 阶段4: 排序
      const sortingResult = await this.executeSorting(
        phases.sorting,
        config,
        reportProgress
      );
      if (!sortingResult.ok) {
        return sortingResult;
      }

      // 完成
      reportProgress('complete', 100, '分析完成');
      return sortingResult;

    } catch (error) {
      return errOf(
        ErrorType.COMPUTATION_ERROR,
        `异步分析失败: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
        { config, options }
      );
    }
  }

  /**
   * 获取默认的异步配置
   */
  static getDefaultAsyncConfig(overrides: Partial<AsyncAnalysisConfig> = {}): AsyncAnalysisConfig {
    return {
      timeSlice: 5,
      maxContinuousTime: 16,
      yieldInterval: 100,
      priority: 'background',
      ...overrides
    };
  }
}