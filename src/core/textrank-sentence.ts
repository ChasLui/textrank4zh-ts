import type {
  SentenceItem,
  TextRankSentenceConfig,
  AsyncTextRankSentenceConfig,
  SegmentationConfig,
  SegmentationResult,
  SimilarityFunction,
  TextRankResult,
  AsyncTextRankResult,
  PageRankConfig,
} from '../types';
import { ErrorType } from '../types';
import { Segmentation } from './segmentation';
import { sortSentences, getDefaultSimilarity, debug } from '../utils';
import { safeSync, errOf, validateInput } from '../utils/result-helpers';
import { AsyncAnalysisExecutor } from '../utils/async-analysis';
import { Result } from 'typescript-result';

/**
 * TextRank 句子摘要生成类
 */
export class TextRankSentence {
  private segmentation: Segmentation;
  private segmentationResult: SegmentationResult | null = null;
  private keySentences: SentenceItem[] = [];

  constructor(config: SegmentationConfig = {}) {
    this.segmentation = new Segmentation(config);
  }

  /**
   * 分析文本，计算句子重要性（同步版本）
   * @param text 输入文本
   * @param config 配置参数
   */
  analyze(text: string, config: TextRankSentenceConfig = {}): TextRankResult<void> {
    // 验证输入
    const validationResult = validateInput(text);
    if (validationResult.isError()) {
      const error = validationResult.error;
      return Result.error({
        ...error,
        context: { ...error.context, config },
      });
    }

    const { lower = false, source = 'no_stop_words', pageRankConfig = {} } = config;

    this.keySentences = [];

    // 安全执行分析
    return safeSync(
      () => {
        // 进行文本分割
        this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });

        debug('='.repeat(40));
        debug('TextRankSentence 分析结果:');
        debug('sentences:', this.segmentationResult.sentences);
        debug('使用的词源:', source);

        // 选择用于计算相似度的词源
        const sourceWordsResult = this.getWordSource(source);
        if (sourceWordsResult.isError()) {
          throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
        }

        // 计算句子重要性
        this.keySentences = sortSentences(
          this.segmentationResult.sentences,
          sourceWordsResult.value,
          getDefaultSimilarity,
          pageRankConfig
        );

        debug('句子重要性排序结果:');
        this.keySentences.slice(0, 5).forEach((item) => {
          debug(`[${item.index}] ${item.weight.toFixed(6)} - ${item.sentence.slice(0, 50)}...`);
        });
      },
      ErrorType.COMPUTATION_ERROR,
      {
        text: validationResult.value.substring(0, 100),
        config,
        phase: 'sentence_analysis',
      }
    );
  }

  /**
   * 异步分析文本，计算句子重要性（推荐用于大文本）
   * 使用主线程调度器避免阻塞UI，支持进度回调
   * @param text 输入文本
   * @param config 异步配置参数
   */
  async analyzeAsync(
    text: string,
    config: AsyncTextRankSentenceConfig = {}
  ): AsyncTextRankResult<void> {
    // 验证输入
    const validationResult = validateInput(text);
    if (validationResult.isError()) {
      const error = validationResult.error;
      return Result.error({
        ...error,
        context: { ...error.context, config },
      });
    }

    const {
      lower = false,
      source = 'no_stop_words',
      pageRankConfig = {},
      // 异步配置
      onProgress,
      timeSlice = 5,
      maxContinuousTime = 16,
      yieldInterval = 100,
      priority = 'background',
    } = config;

    this.keySentences = [];

    const asyncConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig({
      onProgress,
      timeSlice,
      maxContinuousTime,
      yieldInterval,
      priority,
    });

    // 异步执行分析流程
    return await AsyncAnalysisExecutor.executeFullAnalysis(
      {
        // 阶段1: 分词
        segmentation: () => {
          this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });

          debug('='.repeat(40));
          debug('TextRankSentence 异步分析结果:');
          debug('sentences:', this.segmentationResult.sentences);
          debug('使用的词源:', source);

          return this.segmentationResult;
        },

        // 阶段2: 构建句子相似度图
        graphBuilding: () => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const sourceWordsResult = this.getWordSource(source);
          if (sourceWordsResult.isError()) {
            throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
          }

          debug('准备计算句子相似度，句子数量:', this.segmentationResult.sentences.length);

          return {
            sentences: this.segmentationResult.sentences,
            sourceWords: sourceWordsResult.value,
          };
        },

        // 阶段3: PageRank算法计算句子重要性
        pageRank: (progressCallback?: (iteration: number, max: number) => void) => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const sourceWordsResult = this.getWordSource(source);
          if (!sourceWordsResult.ok) {
            throw new Error('获取词源失败');
          }

          // 执行句子排序，支持进度回调
          const sortSentencesWithProgress = (
            sentences: string[],
            sourceWords: string[][],
            similarityFunc: SimilarityFunction,
            prConfig: PageRankConfig
          ) => {
            // 这里可以改造sortSentences函数支持进度回调
            // 暂时使用原有实现
            const result = sortSentences(sentences, sourceWords, similarityFunc, prConfig);

            // 模拟进度报告
            if (progressCallback) {
              const maxIterations = prConfig.maxIterations || 100;
              for (let i = 0; i <= maxIterations; i += 10) {
                progressCallback(Math.min(i, maxIterations), maxIterations);
              }
            }

            return result;
          };

          return sortSentencesWithProgress(
            this.segmentationResult.sentences,
            sourceWordsResult.value,
            getDefaultSimilarity,
            pageRankConfig
          );
        },

        // 阶段4: 存储结果
        sorting: () => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const sourceWordsResult = this.getWordSource(source);
          if (!sourceWordsResult.ok) {
            throw new Error('获取词源失败');
          }

          this.keySentences = sortSentences(
            this.segmentationResult.sentences,
            sourceWordsResult.value,
            getDefaultSimilarity,
            pageRankConfig
          );

          debug('异步句子分析完成，关键句子数量:', this.keySentences.length);
          debug('句子重要性排序结果:');
          this.keySentences.slice(0, 5).forEach((item) => {
            debug(`[${item.index}] ${item.weight.toFixed(6)} - ${item.sentence.slice(0, 50)}...`);
          });

          return undefined; // TextRankResult<void>
        },
      },
      asyncConfig,
      {
        itemCount: this.segmentationResult?.sentences.length || 0,
        maxIterations: pageRankConfig.maxIterations || 100,
      }
    );
  }

  /**
   * 根据源类型获取对应的词列表
   */
  private getWordSource(
    source: 'no_filter' | 'no_stop_words' | 'all_filters'
  ): TextRankResult<string[][]> {
    if (!this.segmentationResult) {
      return errOf(ErrorType.VALIDATION_ERROR, '请先调用 analyze 方法');
    }

    const segmentationResult = this.segmentationResult;

    return safeSync(
      () => {
        switch (source) {
          case 'no_filter':
            return segmentationResult.wordsNoFilter;
          case 'no_stop_words':
            return segmentationResult.wordsNoStopWords;
          case 'all_filters':
            return segmentationResult.wordsAllFilters;
          default:
            return segmentationResult.wordsNoStopWords;
        }
      },
      ErrorType.COMPUTATION_ERROR,
      { source }
    );
  }

  /**
   * 获取关键句子用于生成摘要
   * @param num 返回的句子数量
   * @param sentenceMinLen 句子最小长度
   * @returns 关键句子列表
   */
  getKeySentences(num: number = 6, sentenceMinLen: number = 6): SentenceItem[] {
    const result: SentenceItem[] = [];
    let count = 0;

    for (const item of this.keySentences) {
      if (count >= num) break;

      if (item.sentence.length >= sentenceMinLen) {
        result.push(item);
        count++;
      }
    }

    return result;
  }

  /**
   * 生成摘要文本
   * @param num 摘要句子数量
   * @param sentenceMinLen 句子最小长度
   * @param sortByIndex 是否按原文顺序排序
   * @returns 摘要文本
   */
  getSummary(num: number = 3, sentenceMinLen: number = 6, sortByIndex: boolean = true): string {
    let sentences = this.getKeySentences(num, sentenceMinLen);

    if (sortByIndex) {
      // 按原文中的顺序排序
      sentences = sentences.sort((a, b) => a.index - b.index);
    }

    return sentences.map((item) => item.sentence).join('');
  }

  /**
   * 使用自定义相似度函数分析（同步版本）
   * @param text 输入文本
   * @param similarityFunc 自定义相似度函数
   * @param config 其他配置参数
   */
  analyzeWithSimilarityFunc(
    text: string,
    similarityFunc: SimilarityFunction,
    config: TextRankSentenceConfig = {}
  ): TextRankResult<void> {
    // 验证输入
    const validationResult = validateInput(text);
    if (validationResult.isError()) {
      const error = validationResult.error;
      return Result.error({
        ...error,
        context: { ...error.context, config },
      });
    }

    const { lower = false, source = 'no_stop_words', pageRankConfig = {} } = config;

    this.keySentences = [];

    // 安全执行分析
    return safeSync(
      () => {
        // 进行文本分割
        this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });

        // 选择用于计算相似度的词源
        const sourceWordsResult = this.getWordSource(source);
        if (sourceWordsResult.isError()) {
          throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
        }

        // 使用自定义相似度函数计算句子重要性
        this.keySentences = sortSentences(
          this.segmentationResult.sentences,
          sourceWordsResult.value,
          similarityFunc,
          pageRankConfig
        );

        debug('自定义相似度函数分析完成，关键句子数量:', this.keySentences.length);
      },
      ErrorType.COMPUTATION_ERROR,
      {
        text: validationResult.value.substring(0, 100),
        config,
        phase: 'custom_similarity_analysis',
      }
    );
  }

  /**
   * 使用自定义相似度函数异步分析（推荐用于大文本）
   * @param text 输入文本
   * @param similarityFunc 自定义相似度函数
   * @param config 异步配置参数
   */
  async analyzeWithSimilarityFuncAsync(
    text: string,
    similarityFunc: SimilarityFunction,
    config: AsyncTextRankSentenceConfig = {}
  ): AsyncTextRankResult<void> {
    // 验证输入
    const validationResult = validateInput(text);
    if (validationResult.isError()) {
      const error = validationResult.error;
      return Result.error({
        ...error,
        context: { ...error.context, config },
      });
    }

    const {
      lower = false,
      source = 'no_stop_words',
      pageRankConfig = {},
      // 异步配置
      onProgress,
      timeSlice = 5,
      maxContinuousTime = 16,
      yieldInterval = 100,
      priority = 'background',
    } = config;

    this.keySentences = [];

    const asyncConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig({
      onProgress,
      timeSlice,
      maxContinuousTime,
      yieldInterval,
      priority,
    });

    // 异步执行分析流程（使用自定义相似度函数）
    return await AsyncAnalysisExecutor.executeFullAnalysis(
      {
        // 阶段1: 分词
        segmentation: () => {
          this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });

          debug('='.repeat(40));
          debug('TextRankSentence 自定义相似度函数异步分析:');
          debug('sentences:', this.segmentationResult.sentences);
          debug('使用的词源:', source);

          return this.segmentationResult;
        },

        // 阶段2: 构建句子相似度图（使用自定义函数）
        graphBuilding: () => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const sourceWordsResult = this.getWordSource(source);
          if (sourceWordsResult.isError()) {
            throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
          }

          debug(
            '使用自定义相似度函数准备计算，句子数量:',
            this.segmentationResult.sentences.length
          );

          return {
            sentences: this.segmentationResult.sentences,
            sourceWords: sourceWordsResult.value,
            customSimilarityFunc: similarityFunc,
          };
        },

        // 阶段3: PageRank算法（使用自定义相似度函数）
        pageRank: (progressCallback?: (iteration: number, max: number) => void) => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const sourceWordsResult = this.getWordSource(source);
          if (!sourceWordsResult.ok) {
            throw new Error('获取词源失败');
          }

          // 使用自定义相似度函数执行排序
          const sortSentencesWithCustomFunc = (
            sentences: string[],
            sourceWords: string[][],
            customSimilarityFunc: SimilarityFunction,
            prConfig: PageRankConfig
          ) => {
            const result = sortSentences(sentences, sourceWords, customSimilarityFunc, prConfig);

            // 模拟进度报告
            if (progressCallback) {
              const maxIterations = prConfig.maxIterations || 100;
              for (let i = 0; i <= maxIterations; i += 10) {
                progressCallback(Math.min(i, maxIterations), maxIterations);
              }
            }

            return result;
          };

          return sortSentencesWithCustomFunc(
            this.segmentationResult.sentences,
            sourceWordsResult.value,
            similarityFunc,
            pageRankConfig
          );
        },

        // 阶段4: 存储结果
        sorting: () => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const sourceWordsResult = this.getWordSource(source);
          if (!sourceWordsResult.ok) {
            throw new Error('获取词源失败');
          }

          this.keySentences = sortSentences(
            this.segmentationResult.sentences,
            sourceWordsResult.value,
            similarityFunc,
            pageRankConfig
          );

          debug('自定义相似度函数异步分析完成，关键句子数量:', this.keySentences.length);
          debug('句子重要性排序结果:');
          this.keySentences.slice(0, 5).forEach((item) => {
            debug(`[${item.index}] ${item.weight.toFixed(6)} - ${item.sentence.slice(0, 50)}...`);
          });

          return undefined; // TextRankResult<void>
        },
      },
      asyncConfig,
      {
        itemCount: this.segmentationResult?.sentences.length || 0,
        maxIterations: pageRankConfig.maxIterations || 100,
      }
    );
  }

  /**
   * 获取分割后的句子
   */
  get sentences(): string[] {
    return this.segmentationResult?.sentences || [];
  }

  /**
   * 获取原始分词结果
   */
  get wordsNoFilter(): string[][] {
    return this.segmentationResult?.wordsNoFilter || [];
  }

  /**
   * 获取去停用词的分词结果
   */
  get wordsNoStopWords(): string[][] {
    return this.segmentationResult?.wordsNoStopWords || [];
  }

  /**
   * 获取过滤后的分词结果
   */
  get wordsAllFilters(): string[][] {
    return this.segmentationResult?.wordsAllFilters || [];
  }

  /**
   * 获取所有句子的权重分布
   */
  getSentenceWeights(): Array<{
    index: number;
    sentence: string;
    weight: number;
  }> {
    return this.keySentences.map((item) => ({
      index: item.index,
      sentence: item.sentence,
      weight: item.weight,
    }));
  }
}
