import { describe, it, expect, beforeAll } from 'vitest';
import { TextRankKeyword, TextRankSentence } from '../src/index';

/**
 * 墙钟阈值只用于捕获「数量级退化」（例如复杂度从 O(n) 劣化为 O(n²)），
 * 不是精确性能基准。CI 共享 runner、并行测试进程、GC 时机都会造成显著抖动，
 * 原先贴近实测值的阈值（最紧 20ms）会随机失败。
 * 这里统一留 10 倍余量；仍可用 PERF_TOLERANCE 在更慢的环境中进一步放宽。
 */
const PERF_TOLERANCE = Number(process.env['PERF_TOLERANCE'] ?? 1) || 1;
const perfBudget = (ms: number): number => ms * 10 * PERF_TOLERANCE;

describe('性能基准测试', () => {
  let tr4w: TextRankKeyword;
  let tr4s: TextRankSentence;

  beforeAll(async () => {
    tr4w = new TextRankKeyword();
    tr4s = new TextRankSentence();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('处理速度测试', () => {
    const testTexts = {
      short: '北京是中国的首都，人口众多。',
      medium: `
人工智能技术正在快速发展，深度学习和机器学习成为热门研究方向。
自然语言处理领域取得了重大突破，文本分析和语义理解能力不断提升。
计算机视觉技术在图像识别和目标检测方面表现优异。
语音识别和语音合成技术也日趋成熟，应用场景越来越广泛。
未来人工智能将在更多领域发挥重要作用，推动社会进步。
      `.trim(),
      long: `
在当今数字化时代，人工智能技术正以前所未有的速度发展和普及。从最初的符号主义方法到现在的深度学习革命，AI技术经历了多次重大变革。机器学习作为人工智能的核心技术，包括监督学习、无监督学习和强化学习等多种方法。深度学习作为机器学习的一个重要分支，通过多层神经网络结构，能够自动学习数据的层次化特征表示。卷积神经网络在图像识别领域取得了突破性进展，循环神经网络在序列数据处理方面表现优异。注意力机制和Transformer架构的提出，进一步推动了自然语言处理技术的发展。BERT、GPT等预训练语言模型的出现，使得机器在文本理解和生成方面达到了新的高度。计算机视觉技术在目标检测、图像分割、人脸识别等任务上不断刷新性能记录。语音识别技术已经达到了人类水平，语音合成技术也越来越自然流畅。机器翻译系统能够处理多种语言对，翻译质量持续提升。推荐系统在电商、娱乐、社交媒体等领域广泛应用，为用户提供个性化服务。自动驾驶技术正在逐步走向成熟，有望彻底改变交通出行方式。医疗AI在疾病诊断、药物发现、治疗方案优化等方面展现出巨大潜力。教育领域的AI应用包括智能辅导系统、自动批改、个性化学习路径等。金融科技中的AI技术用于风险控制、量化交易、客户服务等场景。制造业正在拥抱工业4.0，AI技术在质量控制、预测性维护、供应链优化等方面发挥重要作用。
      `.trim(),
    };

    it('短文本处理应该在50ms内完成', () => {
      const startTime = performance.now();

      tr4w.analyze(testTexts.short, { lower: true, window: 2 });
      const keywords = tr4w.getKeywords(5);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(perfBudget(50));
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('中等长度文本处理应该在200ms内完成', () => {
      const startTime = performance.now();

      tr4w.analyze(testTexts.medium, { lower: true, window: 2 });
      const keywords = tr4w.getKeywords(10);
      const keyphrases = tr4w.getKeyphrases(10);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(perfBudget(200));
      expect(keywords.length).toBeGreaterThan(0);
      expect(Array.isArray(keyphrases)).toBe(true);
    });

    it('长文本处理应该在1秒内完成', () => {
      const startTime = performance.now();

      tr4w.analyze(testTexts.long, {
        lower: true,
        window: 3,
        pageRankConfig: { alpha: 0.85, maxIterations: 50 },
      });
      const keywords = tr4w.getKeywords(15);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(perfBudget(1000));
      expect(keywords.length).toBeGreaterThan(5);
    });

    it('句子摘要生成应该在合理时间内完成', () => {
      const startTime = performance.now();

      tr4s.analyze(testTexts.long, {
        lower: true,
        source: 'all_filters',
        pageRankConfig: { alpha: 0.85, maxIterations: 50 },
      });
      const sentences = tr4s.getKeySentences(5);
      const summary = tr4s.getSummary(3);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(perfBudget(1500));
      expect(sentences.length).toBeGreaterThan(0);
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('内存使用测试', () => {
    it('批量处理不应该导致内存泄漏', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 处理多个文档
      for (let i = 0; i < 50; i++) {
        const text = `这是第${i + 1}个测试文档，用于检测内存使用情况。包含人工智能、机器学习、深度学习等技术词汇。`;

        tr4w.analyze(text, { lower: true, window: 2 });
        tr4w.getKeywords(5);
        tr4w.getKeyphrases(5);

        tr4s.analyze(text, { lower: true, source: 'all_filters' });
        tr4s.getKeySentences(2);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该在合理范围内 (小于50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('并发处理测试', () => {
    it('应该能够处理并发分析请求', async () => {
      const texts = [
        '北京是中国首都，历史悠久。',
        '上海是国际化大都市，经济发达。',
        '深圳是改革开放前沿，科技创新活跃。',
        '广州是千年商都，文化底蕴深厚。',
        '杭州是人间天堂，风景秀美。',
      ];

      const promises = texts.map(async (text, index) => {
        const localTr4w = new TextRankKeyword();
        await new Promise((resolve) => setTimeout(resolve, 10)); // 模拟初始化

        localTr4w.analyze(text, { lower: true, window: 2 });
        return {
          index,
          keywords: localTr4w.getKeywords(3),
          text: text.slice(0, 10) + '...',
        };
      });

      const results = await Promise.all(promises);

      expect(results.length).toBe(texts.length);
      results.forEach((result, index) => {
        expect(result.index).toBe(index);
        expect(Array.isArray(result.keywords)).toBe(true);
      });
    });
  });

  describe('不同配置的性能对比', () => {
    const testText = `
人工智能技术发展迅速，深度学习成为研究热点。机器学习算法不断优化，
神经网络架构日益复杂。自然语言处理取得重大突破，文本分析能力提升。
计算机视觉在图像识别方面表现优异，语音技术也日趋成熟。
    `.trim();

    it('不同窗口大小的性能对比', () => {
      const windowSizes = [2, 3, 4, 5];
      const results: Array<{ window: number; duration: number; keywordCount: number }> = [];

      for (const window of windowSizes) {
        const startTime = performance.now();

        tr4w.analyze(testText, { lower: true, window });
        const keywords = tr4w.getKeywords(10);

        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          window,
          duration,
          keywordCount: keywords.length,
        });
      }

      // 所有配置都应该在合理时间内完成
      results.forEach((result) => {
        expect(result.duration).toBeLessThan(perfBudget(300));
        expect(result.keywordCount).toBeGreaterThan(0);
      });

      // 窗口越大，处理时间可能越长（但不是绝对的）
      expect(results.length).toBe(windowSizes.length);
    });

    it('不同PageRank迭代次数的性能对比', () => {
      const maxIterations = [10, 25, 50, 100];
      const results: Array<{ iterations: number; duration: number }> = [];

      for (const maxIter of maxIterations) {
        const startTime = performance.now();

        tr4w.analyze(testText, {
          lower: true,
          window: 2,
          pageRankConfig: { alpha: 0.85, maxIterations: maxIter },
        });
        tr4w.getKeywords(10);

        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          iterations: maxIter,
          duration,
        });
      }

      // 迭代次数越多，时间应该越长（但由于测试环境的不确定性，可能存在波动）
      // 这里只验证最后一个（最多迭代）的时间相对合理
      const slowest = results[results.length - 1];
      expect(slowest).toBeDefined();
      expect(slowest?.duration).toBeGreaterThan(0);

      // 但即使是最大迭代次数，也应该在合理时间内完成
      expect(slowest?.duration).toBeLessThan(perfBudget(500));
    });
  });

  describe('边界性能测试', () => {
    it('超长文本处理', () => {
      // 生成约5000字的文本
      const baseText = '人工智能技术正在改变世界，深度学习推动创新发展。';
      const longText = baseText.repeat(100);

      const startTime = performance.now();

      tr4w.analyze(longText, {
        lower: true,
        window: 2,
        pageRankConfig: { alpha: 0.85, maxIterations: 30 }, // 限制迭代次数
      });
      const keywords = tr4w.getKeywords(20);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 超长文本也应该在5秒内处理完成
      expect(duration).toBeLessThan(perfBudget(5000));
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('极短文本处理', () => {
      const shortTexts = ['你好', '人工智能', 'AI技术很棒', ''];

      for (const text of shortTexts) {
        const startTime = performance.now();

        tr4w.analyze(text, { lower: true, window: 2 });
        const keywords = tr4w.getKeywords(5);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // 极短文本应该瞬间处理完成
        expect(duration).toBeLessThan(perfBudget(20));
        expect(Array.isArray(keywords)).toBe(true);
      }
    });
  });
});
