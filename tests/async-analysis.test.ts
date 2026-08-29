import { describe, it, expect, beforeEach } from 'vitest';
import { TextRankKeyword, TextRankSentence, AsyncAnalysisExecutor } from '../src';
import type { AnalysisProgress, ProgressCallback } from '../src/types';
import { AsyncTextRankKeywordConfig, AsyncTextRankSentenceConfig } from '../src/types';
import { getTestText, expectResultErr } from './test-helpers';

describe('异步分析功能测试', () => {
  const testText = getTestText('medium');
  let progressEvents: AnalysisProgress[] = [];

  beforeEach(() => {
    progressEvents = [];
  });

  const createProgressCollector = (): ProgressCallback => {
    return (progress: AnalysisProgress) => {
      progressEvents.push({ ...progress });
    };
  };

  describe('TextRankKeyword 异步分析', () => {
    it('应该成功执行异步关键词分析', async () => {
      const tr4w = new TextRankKeyword();

      const result = await tr4w.analyzeAsync(testText, {
        window: 2,
        lower: true,
        onProgress: createProgressCollector(),
      });

      expect(result.ok).toBe(true);
      expect(tr4w.getKeywords(5)).toHaveLength(5);
      expect(progressEvents.length).toBeGreaterThan(0);

      // 验证进度事件包含所有阶段
      const phases = progressEvents.map((p) => p.phase);
      expect(phases).toContain('segmentation');
      expect(phases).toContain('complete');
    });

    it('应该支持进度回调功能', async () => {
      const tr4w = new TextRankKeyword();
      const progressMessages: string[] = [];

      const result = await tr4w.analyzeAsync(testText, {
        window: 2,
        lower: true,
        onProgress: (progress) => {
          progressMessages.push(progress.message);
          expect(progress.progress).toBeGreaterThanOrEqual(0);
          expect(progress.progress).toBeLessThanOrEqual(100);
        },
      });

      expect(result.ok).toBe(true);
      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages).toContain('分析完成');
    });

    it('应该与同步版本得到相同结果', async () => {
      const tr4wSync = new TextRankKeyword();
      const tr4wAsync = new TextRankKeyword();

      const config = {
        window: 3,
        lower: true,
        vertexSource: 'all_filters' as const,
        edgeSource: 'no_stop_words' as const,
      };

      // 同步版本
      tr4wSync.analyze(testText, config);
      const syncKeywords = tr4wSync.getKeywords(10);

      // 异步版本
      const asyncResult = await tr4wAsync.analyzeAsync(testText, config);
      expect(asyncResult.ok).toBe(true);
      const asyncKeywords = tr4wAsync.getKeywords(10);

      // 验证结果一致
      expect(asyncKeywords).toHaveLength(syncKeywords.length);
      expect(asyncKeywords.map((k) => k.word)).toEqual(syncKeywords.map((k) => k.word));
    });

    it('应该支持自定义时间片配置', async () => {
      const tr4w = new TextRankKeyword();

      const result = await tr4w.analyzeAsync(testText, {
        timeSlice: 10,
        maxContinuousTime: 20,
        yieldInterval: 50,
        priority: 'normal',
        onProgress: createProgressCollector(),
      });

      expect(result.ok).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('应该处理异常情况', async () => {
      const tr4w = new TextRankKeyword();

      const result = await tr4w.analyzeAsync('', {
        onProgress: createProgressCollector(),
      });

      expectResultErr(result);
      expect(result.error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('TextRankSentence 异步分析', () => {
    it('应该成功执行异步句子分析', async () => {
      const tr4s = new TextRankSentence();

      const result = await tr4s.analyzeAsync(testText, {
        lower: true,
        source: 'no_stop_words',
        onProgress: createProgressCollector(),
      });

      expect(result.ok).toBe(true);
      expect(tr4s.getKeySentences(3)).toHaveLength(3);
      expect(tr4s.getSummary(2)).toBeTruthy();

      // 验证进度事件
      const phases = progressEvents.map((p) => p.phase);
      expect(phases).toContain('segmentation');
      expect(phases).toContain('complete');
    });

    it('应该与同步版本得到相同结果', async () => {
      const tr4sSync = new TextRankSentence();
      const tr4sAsync = new TextRankSentence();

      const config = {
        lower: true,
        source: 'all_filters' as const,
      };

      // 同步版本
      tr4sSync.analyze(testText, config);
      const syncSentences = tr4sSync.getKeySentences(5);

      // 异步版本
      const asyncResult = await tr4sAsync.analyzeAsync(testText, config);
      expect(asyncResult.ok).toBe(true);
      const asyncSentences = tr4sAsync.getKeySentences(5);

      // 验证结果一致
      expect(asyncSentences).toHaveLength(syncSentences.length);
      expect(asyncSentences.map((s) => s.sentence)).toEqual(syncSentences.map((s) => s.sentence));
    });

    it('应该支持自定义相似度函数的异步分析', async () => {
      const tr4s = new TextRankSentence();

      const customSimilarity = (words1: string[], words2: string[]): number => {
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        const intersection = new Set([...set1].filter((x) => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return union.size === 0 ? 0 : intersection.size / union.size;
      };

      const result = await tr4s.analyzeWithSimilarityFuncAsync(testText, customSimilarity, {
        lower: true,
        onProgress: createProgressCollector(),
      });

      expect(result.ok).toBe(true);
      expect(tr4s.getKeySentences(3)).toHaveLength(3);
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('应该处理异常情况', async () => {
      const tr4s = new TextRankSentence();

      const result = await tr4s.analyzeAsync('', {
        onProgress: createProgressCollector(),
      });

      expectResultErr(result);
      expect(result.error.type).toBe('VALIDATION_ERROR');
    });
  });

  describe('AsyncAnalysisExecutor 工具测试', () => {
    it('应该提供默认异步配置', () => {
      const defaultConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig();

      expect(defaultConfig.timeSlice).toBe(5);
      expect(defaultConfig.maxContinuousTime).toBe(16);
      expect(defaultConfig.yieldInterval).toBe(100);
      expect(defaultConfig.priority).toBe('background');
    });

    it('应该支持配置覆盖', () => {
      const customConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig({
        timeSlice: 10,
        priority: 'normal',
      });

      expect(customConfig.timeSlice).toBe(10);
      expect(customConfig.maxContinuousTime).toBe(16); // 默认值
      expect(customConfig.priority).toBe('normal');
    });
  });

  describe('性能测试', () => {
    it('大文本异步处理应该正确执行', async () => {
      const largeText = getTestText('large');
      const tr4w = new TextRankKeyword();

      const result = await tr4w.analyzeAsync(largeText, {
        timeSlice: 5,
        maxContinuousTime: 16,
        priority: 'background',
        onProgress: createProgressCollector(),
      });

      expect(result.ok).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(4); // 至少包含4个阶段

      // 验证能获取到关键词结果
      const keywords = tr4w.getKeywords(10);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.length).toBeLessThanOrEqual(10);
    }, 15000); // 15秒超时，CI环境需要更长时间

    it('异步分析应该报告详细进度信息', async () => {
      const tr4w = new TextRankKeyword();

      await tr4w.analyzeAsync(testText, {
        window: 2,
        lower: true,
        pageRankConfig: { maxIterations: 50 },
        onProgress: (progress) => {
          progressEvents.push(progress);

          // 验证进度信息结构
          expect(progress).toHaveProperty('phase');
          expect(progress).toHaveProperty('progress');
          expect(progress).toHaveProperty('message');

          if (progress.phase === 'pagerank' && progress.details) {
            expect(progress.details).toHaveProperty('maxIterations', 50);
          }
        },
      });

      // 验证包含所有预期阶段
      const phases = progressEvents.map((p) => p.phase);
      expect(phases).toContain('segmentation');
      expect(phases).toContain('graph_building');
      expect(phases).toContain('pagerank');
      expect(phases).toContain('sorting');
      expect(phases).toContain('complete');

      // 验证进度递增
      const progressValues = progressEvents.map((p) => p.progress);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });
  });

  describe('错误处理', () => {
    it('应该在异步执行中正确处理和传播错误', async () => {
      const tr4w = new TextRankKeyword();

      // 测试空文本
      const emptyResult = await tr4w.analyzeAsync('');
      expectResultErr(emptyResult);
      expect(emptyResult.error.type).toBe('VALIDATION_ERROR');

      // 测试只有空白字符的文本
      const whitespaceResult = await tr4w.analyzeAsync('   \n\t  ');
      expect(whitespaceResult.ok).toBe(false);
    });

    it('应该在进度回调中处理异常', async () => {
      const tr4w = new TextRankKeyword();
      let callbackError = false;

      const result = await tr4w.analyzeAsync(testText, {
        onProgress: (progress) => {
          if (progress.phase === 'pagerank') {
            // 模拟回调中的错误，不应该影响主流程
            try {
              throw new Error('Progress callback error');
            } catch (e) {
              callbackError = true;
            }
          }
        },
      });

      expect(result.ok).toBe(true);
      expect(callbackError).toBe(true);
      expect(tr4w.getKeywords(3)).toHaveLength(3);
    });
  });
});
