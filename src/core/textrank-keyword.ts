import type {
  KeywordItem,
  TextRankKeywordConfig,
  AsyncTextRankKeywordConfig,
  SegmentationConfig,
  SegmentationResult,
  TextRankResult,
  AsyncTextRankResult,
  PageRankConfig,
} from '../types';
import { ErrorType } from '../types';
import { Segmentation } from './segmentation';
import { sortWords, debug } from '../utils';
import { safeSync, errOf, validateInput } from '../utils/result-helpers';
import { AsyncAnalysisExecutor } from '../utils/async-analysis';
import { Result } from '../utils/result';

/**
 * TextRank 关键词提取类
 */
export class TextRankKeyword {
  private segmentation: Segmentation;
  private text: string = '';
  private keywords: KeywordItem[] = [];
  private segmentationResult: SegmentationResult | null = null;

  constructor(config: SegmentationConfig = {}) {
    this.segmentation = new Segmentation(config);
  }

  /**
   * 分析文本，提取关键词（同步版本）
   */
  analyze(text: string, config: TextRankKeywordConfig = {}): TextRankResult<void> {
    const {
      window = 2,
      lower = false,
      vertexSource = 'all_filters',
      edgeSource = 'no_stop_words',
      pageRankConfig = {},
    } = config;

    this.text = text;
    this.keywords = [];

    // 安全执行文本分割
    return safeSync(
      () => {
        this.segmentationResult = this.segmentation.segment(this.text, {
          lower,
        });

        debug('='.repeat(40));
        debug('TextRankKeyword 分析结果:');
        debug('sentences:', this.segmentationResult.sentences.join(' || '));
        debug('wordsNoFilter:', this.segmentationResult.wordsNoFilter);
        debug('wordsNoStopWords:', this.segmentationResult.wordsNoStopWords);
        debug('wordsAllFilters:', this.segmentationResult.wordsAllFilters);

        const analysisResult = this.performTextRankAnalysis(
          window,
          vertexSource,
          edgeSource,
          pageRankConfig
        );
        if (analysisResult.isError()) {
          throw new Error(analysisResult.error.message);
        }
      },
      ErrorType.COMPUTATION_ERROR,
      {
        text: this.text.substring(0, 100),
        config,
        phase: 'text_analysis',
      }
    );
  }

  /**
   * 异步分析文本，提取关键词（推荐用于大文本）
   * 使用主线程调度器避免阻塞UI，支持进度回调
   */
  async analyzeAsync(
    text: string,
    config: AsyncTextRankKeywordConfig = {}
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
      window = 2,
      lower = false,
      vertexSource = 'all_filters',
      edgeSource = 'no_stop_words',
      pageRankConfig = {},
      // 异步配置
      onProgress,
      timeSlice = 5,
      maxContinuousTime = 16,
      yieldInterval = 100,
      priority = 'background',
    } = config;

    this.text = validationResult.value;
    this.keywords = [];

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
          debug('TextRankKeyword 异步分析结果:');
          debug('sentences:', this.segmentationResult.sentences.join(' || '));
          debug('wordsNoFilter:', this.segmentationResult.wordsNoFilter);
          debug('wordsNoStopWords:', this.segmentationResult.wordsNoStopWords);
          debug('wordsAllFilters:', this.segmentationResult.wordsAllFilters);

          return this.segmentationResult;
        },

        // 阶段2: 构建图（准备数据）
        graphBuilding: () => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const vertexWordsResult = this.getWordSource(vertexSource);
          const edgeWordsResult = this.getWordSource(edgeSource);

          if (vertexWordsResult.isError()) {
            throw new Error(`获取vertex词源失败: ${vertexWordsResult.error.message}`);
          }
          if (edgeWordsResult.isError()) {
            throw new Error(`获取edge词源失败: ${edgeWordsResult.error.message}`);
          }

          return {
            vertexWords: vertexWordsResult.value,
            edgeWords: edgeWordsResult.value,
          };
        },

        // 阶段3: PageRank算法
        pageRank: (progressCallback?: (iteration: number, max: number) => void) => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const vertexWordsResult = this.getWordSource(vertexSource);
          const edgeWordsResult = this.getWordSource(edgeSource);

          if (!vertexWordsResult.ok || !edgeWordsResult.ok) {
            throw new Error('获取词源失败');
          }

          // 执行sortWords，如果支持进度回调则传递
          const sortWordsWithProgress = (
            vertexWords: string[][],
            edgeWords: string[][],
            windowSize: number,
            prConfig: PageRankConfig
          ) => {
            // 这里可以改造sortWords函数支持进度回调
            // 暂时使用原有实现
            const result = sortWords(vertexWords, edgeWords, windowSize, prConfig);

            // 模拟进度报告
            if (progressCallback) {
              const maxIterations = prConfig.maxIterations || 100;
              for (let i = 0; i <= maxIterations; i += 10) {
                progressCallback(Math.min(i, maxIterations), maxIterations);
              }
            }

            return result;
          };

          return sortWordsWithProgress(
            vertexWordsResult.value,
            edgeWordsResult.value,
            window,
            pageRankConfig
          );
        },

        // 阶段4: 排序和存储结果
        sorting: () => {
          if (!this.segmentationResult) {
            throw new Error('分词结果为空');
          }

          const vertexWordsResult = this.getWordSource(vertexSource);
          const edgeWordsResult = this.getWordSource(edgeSource);

          if (!vertexWordsResult.ok || !edgeWordsResult.ok) {
            throw new Error('获取词源失败');
          }

          this.keywords = sortWords(
            vertexWordsResult.value,
            edgeWordsResult.value,
            window,
            pageRankConfig
          );

          debug('异步分析完成，关键词数量:', this.keywords.length);
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
   * 执行 TextRank 算法分析
   */
  private performTextRankAnalysis(
    window: number,
    vertexSource: 'no_filter' | 'no_stop_words' | 'all_filters',
    edgeSource: 'no_filter' | 'no_stop_words' | 'all_filters',
    pageRankConfig: PageRankConfig
  ): TextRankResult<void> {
    const vertexWordsResult = this.getWordSource(vertexSource);
    if (vertexWordsResult.isError()) {
      return errOf(
        ErrorType.COMPUTATION_ERROR,
        `获取 vertex 词源失败: ${vertexWordsResult.error.message}`
      );
    }

    const edgeWordsResult = this.getWordSource(edgeSource);
    if (edgeWordsResult.isError()) {
      return errOf(
        ErrorType.COMPUTATION_ERROR,
        `获取 edge 词源失败: ${edgeWordsResult.error.message}`
      );
    }

    return safeSync(
      () => {
        this.keywords = sortWords(
          vertexWordsResult.value,
          edgeWordsResult.value,
          window,
          pageRankConfig
        );
      },
      ErrorType.COMPUTATION_ERROR,
      { vertexSource, edgeSource, window }
    );
  }

  /**
   * 根据源类型获取对应的词列表
   */
  private getWordSource(
    source: 'no_filter' | 'no_stop_words' | 'all_filters'
  ): TextRankResult<string[][]> {
    if (!this.segmentationResult) {
      return errOf(ErrorType.VALIDATION_ERROR, '请先调用 analyze 方法', undefined, { source });
    }

    const segmentationResult = this.segmentationResult;

    return Result.ok(
      (() => {
        switch (source) {
          case 'no_filter':
            return segmentationResult.wordsNoFilter;
          case 'no_stop_words':
            return segmentationResult.wordsNoStopWords;
          case 'all_filters':
            return segmentationResult.wordsAllFilters;
          default:
            return segmentationResult.wordsAllFilters;
        }
      })()
    );
  }

  /**
   * 获取关键词
   * @param num 返回的关键词数量
   * @param wordMinLen 关键词最小长度
   * @returns 关键词列表
   */
  getKeywords(num: number = 6, wordMinLen: number = 1): KeywordItem[] {
    const result: KeywordItem[] = [];
    let count = 0;

    for (const item of this.keywords) {
      if (count >= num) break;

      if (item.word.length >= wordMinLen) {
        result.push(item);
        count++;
      }
    }

    return result;
  }

  /**
   * 获取关键短语
   * @param keywordsNum 用于构造短语的关键词数量
   * @param minOccurNum 短语在原文中的最少出现次数
   * @returns 关键短语列表
   */
  getKeyphrases(keywordsNum: number = 12, minOccurNum: number = 2): string[] {
    if (!this.segmentationResult) {
      return [];
    }

    // 获取关键词集合
    const keywordsSet = new Set(this.getKeywords(keywordsNum, 1).map((item) => item.word));

    const keyphrases = new Set<string>();

    // 在每个句子中查找关键词组合
    for (const sentence of this.segmentationResult.wordsNoFilter) {
      let currentPhrase: string[] = [];

      for (const word of sentence) {
        if (keywordsSet.has(word)) {
          currentPhrase.push(word);
        } else {
          // 遇到非关键词，检查当前短语
          if (currentPhrase.length > 1) {
            keyphrases.add(currentPhrase.join(''));
          }
          currentPhrase = [];
        }
      }

      // 处理句子结尾的短语
      if (currentPhrase.length > 1) {
        keyphrases.add(currentPhrase.join(''));
      }
    }

    // 过滤出现次数符合要求的短语
    return Array.from(keyphrases).filter((phrase) => {
      const count = (this.text.match(new RegExp(phrase, 'g')) || []).length;
      return count >= minOccurNum;
    });
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
}
