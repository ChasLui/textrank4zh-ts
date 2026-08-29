import type { SegmentationResult, SegmentationConfig, WordWithPos, TextRankResult } from '../types';
import { DEFAULT_CONFIG, ErrorType } from '../types';
import { debug } from '../utils';
import { STOP_WORDS } from '../data/stopwords';
import { jieba } from '../utils/jieba-simple';
import { safeSync } from '../utils/result-helpers';
import { Result } from 'typescript-result';

/**
 * 分词器接口：内置 SimpleJieba 与 fallback 分词器的公共形状
 */
interface Segmenter {
  cut(text: string): string[];
  // tag 字段用于兼容其他分词器实现的词性字段名
  tag(text: string): Array<{ word: string; pos: string; tag?: string }>;
}

/**
 * 中文分词类
 */
export class WordSegmentation {
  private stopWords: Set<string>;
  private allowSpeechTags: Set<string>;
  private jieba: Segmenter | undefined;

  constructor(config: SegmentationConfig = {}) {
    const { stopWords, allowSpeechTags = DEFAULT_CONFIG.ALLOW_SPEECH_TAGS } = config;

    this.allowSpeechTags = new Set(allowSpeechTags);
    this.stopWords = this.loadStopWords(stopWords);

    // 初始化分词器，失败时使用默认fallback
    const initResult = this.initJieba();
    if (!initResult.ok) {
      debug('分词器初始化失败，已使用fallback分词器');
    }
  }

  /**
   * 初始化分词器
   */
  private initJieba(): TextRankResult<void> {
    const result = safeSync(
      () => {
        // 使用静态导入的轻量级分词器
        this.jieba = jieba;
        debug('使用内置轻量级分词器');
      },
      ErrorType.INITIALIZATION_ERROR,
      { component: 'jieba' }
    );

    if (!result.ok) {
      // 创建一个基础的fallback分词器
      debug('分词器初始化失败，使用 fallback 分词器');
      this.jieba = this.createFallbackSegmenter();
    }

    return Result.ok(undefined);
  }

  /**
   * 创建fallback分词器
   */
  private createFallbackSegmenter() {
    return {
      cut: (text: string) => {
        // 基础的字符级分词
        return text.split('').filter((char) => char.trim().length > 0);
      },
      tag: (text: string) => {
        const words = text.split('').filter((char: string) => char.trim().length > 0);
        return words.map((word: string) => ({ word, pos: 'n' }));
      },
    };
  }

  /**
   * 加载停用词
   */
  private loadStopWords(customStopWords?: string[]): Set<string> {
    if (customStopWords && customStopWords.length > 0) {
      // 如果提供了自定义停用词，使用自定义的
      return new Set(customStopWords);
    }

    // 使用内置停用词
    return new Set(STOP_WORDS);
  }

  /**
   * 对文本进行分词
   */
  segment(
    text: string,
    options: {
      lower?: boolean;
      useStopWords?: boolean;
      useSpeechTagsFilter?: boolean;
    } = {}
  ): string[] {
    const { lower = false, useStopWords = true, useSpeechTagsFilter = false } = options;

    if (!this.jieba) {
      // 如果分词器未初始化，使用fallback方案
      this.jieba = this.createFallbackSegmenter();
    }

    let result: WordWithPos[];

    if (useSpeechTagsFilter) {
      // 使用词性标注分词
      result = this.jieba.tag(text).map((item) => ({
        word: item.word,
        pos: item.pos || item.tag || 'n',
      }));

      // 过滤词性
      result = result.filter((item) => this.allowSpeechTags.has(item.pos));
    } else {
      // 普通分词
      const words = this.jieba.cut(text);
      result = words.map((word: string) => ({ word, pos: '' }));
    }

    // 去除特殊符号和空白
    let wordList = result
      .map((item) => item.word.trim())
      .filter((word) => word.length > 0 && !/^[\s\p{P}]+$/u.test(word));

    // 转小写
    if (lower) {
      wordList = wordList.map((word) => word.toLowerCase());
    }

    // 去除停用词
    if (useStopWords) {
      wordList = wordList.filter((word) => !this.stopWords.has(word));
    }

    return wordList;
  }

  /**
   * 对句子列表进行分词
   */
  segmentSentences(
    sentences: string[],
    options: {
      lower?: boolean;
      useStopWords?: boolean;
      useSpeechTagsFilter?: boolean;
    } = {}
  ): string[][] {
    return sentences.map((sentence) => this.segment(sentence, options));
  }
}

/**
 * 句子分割类
 */
export class SentenceSegmentation {
  private delimiters: Set<string>;

  constructor(delimiters: readonly string[] = DEFAULT_CONFIG.SENTENCE_DELIMITERS) {
    this.delimiters = new Set(delimiters);
  }

  /**
   * 将文本分割为句子
   */
  segment(text: string): string[] {
    let sentences = [text];

    // 逐个分隔符进行分割
    for (const delimiter of this.delimiters) {
      const newSentences: string[] = [];
      for (const sentence of sentences) {
        newSentences.push(...sentence.split(delimiter));
      }
      sentences = newSentences;
    }

    // 过滤空句子并去除首尾空白
    return sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
  }
}

/**
 * 统一的文本分割类
 */
export class Segmentation {
  private wordSegmentation: WordSegmentation;
  private sentenceSegmentation: SentenceSegmentation;

  constructor(config: SegmentationConfig = {}) {
    this.wordSegmentation = new WordSegmentation(config);
    this.sentenceSegmentation = new SentenceSegmentation(config.delimiters);
  }

  /**
   * 对文本进行完整的分词分句处理
   */
  segment(text: string, options: { lower?: boolean } = {}): SegmentationResult {
    const { lower = false } = options;

    // 分句
    const sentences = this.sentenceSegmentation.segment(text);

    debug('分句结果:', sentences);

    // 不同级别的分词
    const wordsNoFilter = this.wordSegmentation.segmentSentences(sentences, {
      lower,
      useStopWords: false,
      useSpeechTagsFilter: false,
    });

    const wordsNoStopWords = this.wordSegmentation.segmentSentences(sentences, {
      lower,
      useStopWords: true,
      useSpeechTagsFilter: false,
    });

    const wordsAllFilters = this.wordSegmentation.segmentSentences(sentences, {
      lower,
      useStopWords: true,
      useSpeechTagsFilter: true,
    });

    debug('分词结果 - wordsNoFilter:', wordsNoFilter);
    debug('分词结果 - wordsNoStopWords:', wordsNoStopWords);
    debug('分词结果 - wordsAllFilters:', wordsAllFilters);

    return {
      sentences,
      wordsNoFilter,
      wordsNoStopWords,
      wordsAllFilters,
    };
  }
}
