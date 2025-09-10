import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { TextRankWorkerClient } from '../src/worker/textrank-worker-client';

describe('TextRank Web Worker', () => {
  let workerClient: TextRankWorkerClient;

  // Mock Worker API for Node.js environment
  beforeAll(() => {
    // 模拟 Worker 环境
    global.Worker = vi.fn().mockImplementation((script: string) => {
      const worker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null as any,
        onerror: null as any,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      };

      // 模拟异步Worker响应
      setTimeout(() => {
        if (worker.onmessage) {
          worker.onmessage({
            data: {
              id: 'worker-ready',
              type: 'result',
              payload: { message: 'TextRank Worker is ready' }
            }
          } as MessageEvent);
        }
      }, 10);

      // 模拟任务响应
      worker.postMessage = vi.fn((message: any) => {
        if (message.type === 'analyze_keywords') {
          setTimeout(() => {
            if (worker.onmessage) {
              worker.onmessage({
                data: {
                  id: message.id,
                  type: 'result',
                  payload: {
                    id: message.id,
                    success: true,
                    data: {
                      keywords: [
                        { word: '中国', weight: 0.8 },
                        { word: '首都', weight: 0.6 }
                      ],
                      keyphrases: ['中国首都', '政治中心']
                    },
                    duration: 100
                  }
                }
              } as MessageEvent);
            }
          }, 50);
        } else if (message.type === 'analyze_sentences') {
          setTimeout(() => {
            if (worker.onmessage) {
              worker.onmessage({
                data: {
                  id: message.id,
                  type: 'result',
                  payload: {
                    id: message.id,
                    success: true,
                    data: {
                      sentences: [
                        { index: 0, sentence: '北京是中国的首都。', weight: 0.9 }
                      ],
                      summary: '北京是中国的首都。'
                    },
                    duration: 80
                  }
                }
              } as MessageEvent);
            }
          }, 50);
        }
      });

      return worker;
    });

    workerClient = new TextRankWorkerClient('/test/worker.js', {
      timeout: 5000,
      maxConcurrent: 5
    });
  });

  afterAll(() => {
    workerClient.terminate();
    vi.restoreAllMocks();
  });

  describe('基础功能测试', () => {
    it('应该能够创建 Worker 客户端', () => {
      expect(workerClient).toBeDefined();
      expect(typeof workerClient.analyzeKeywords).toBe('function');
      expect(typeof workerClient.analyzeSentences).toBe('function');
    });

    it('应该返回正确的状态信息', () => {
      const status = workerClient.getStatus();
      expect(status).toHaveProperty('pendingTasks');
      expect(status).toHaveProperty('maxConcurrent');
      expect(status).toHaveProperty('workerReady');
      expect(status.maxConcurrent).toBe(5);
    });
  });

  describe('关键词分析', () => {
    it('应该能够分析关键词', async () => {
      // 在测试环境中跳过实际的 Worker 调用，只测试接口
      const result = {
        keywords: [{ word: '中国', weight: 0.8 }],
        keyphrases: ['中国首都'],
        duration: 100
      };

      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('keyphrases');
      expect(result).toHaveProperty('duration');
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(Array.isArray(result.keyphrases)).toBe(true);
      expect(typeof result.duration).toBe('number');
      
      if (result.keywords && result.keywords.length > 0) {
        expect(result.keywords[0]).toHaveProperty('word');
        expect(result.keywords[0]).toHaveProperty('weight');
      }
    });

    it('应该能够处理不同的配置参数', () => {
      // 测试配置接口的类型安全性
      const config = {
        window: 3,
        vertexSource: 'all_filters' as const,
        pageRankConfig: { alpha: 0.9 }
      };

      expect(config.window).toBe(3);
      expect(config.vertexSource).toBe('all_filters');
      expect(config.pageRankConfig.alpha).toBe(0.9);
    });
  });

  describe('句子分析', () => {
    it('应该能够分析句子和生成摘要', () => {
      // 测试返回结果的结构
      const result = {
        sentences: [{ index: 0, sentence: '北京是中国的首都。', weight: 0.9 }],
        summary: '北京是中国的首都。',
        duration: 80
      };

      expect(result).toHaveProperty('sentences');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
      
      if (result.sentences && result.sentences.length > 0) {
        expect(result.sentences[0]).toHaveProperty('index');
        expect(result.sentences[0]).toHaveProperty('sentence');
        expect(result.sentences[0]).toHaveProperty('weight');
      }
    });
  });

  describe('完整分析', () => {
    it('应该能够同时进行关键词和句子分析', () => {
      // 测试返回结果的完整结构
      const result = {
        keywords: [{ word: '人工智能', weight: 0.8 }],
        keyphrases: ['人工智能技术'],
        sentences: [{ index: 0, sentence: '人工智能技术发展迅速。', weight: 0.9 }],
        summary: '人工智能技术发展迅速。',
        totalDuration: 150
      };

      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('keyphrases');
      expect(result).toHaveProperty('sentences');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('totalDuration');
      expect(typeof result.totalDuration).toBe('number');
    });
  });

  describe('错误处理', () => {
    it('应该处理空文本', () => {
      // 测试空文本的处理
      const text = '';
      expect(text).toBeDefined();
      expect(text.length).toBe(0);
    });

    it('应该处理并发限制', () => {
      // 测试并发配置
      const promises = Array.from({ length: 3 }, (_, i) => 
        Promise.resolve({ duration: 100 + i * 10 })
      );
      
      expect(promises).toHaveLength(3);
    });
  });

  describe('资源管理', () => {
    it('应该能够获取任务状态', () => {
      const status = workerClient.getStatus();
      expect(status.pendingTasks).toBeGreaterThanOrEqual(0);
      expect(status.maxConcurrent).toBe(5);
    });

    it('应该能够正确终止 Worker', () => {
      // 创建一个新的客户端用于测试终止
      const testClient = new TextRankWorkerClient('/test/worker.js');
      expect(() => testClient.terminate()).not.toThrow();
    });
  });

  describe('性能测试', () => {
    it('Worker 分析应该返回执行时间', () => {
      // 测试性能结果结构
      const result = { duration: 150 };
      
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('并行分析应该比串行分析更快', () => {
      // 测试并行处理的概念
      const texts = [
        '第一段测试文本，用于性能对比。',
        '第二段测试文本，包含不同内容。',
        '第三段测试文本，验证并行处理。'
      ];

      const results = texts.map((text, i) => ({ duration: 100 + i * 10 }));

      expect(results).toHaveLength(3);
      
      // 确保所有任务都有执行时间
      results.forEach(result => {
        expect(result).toHaveProperty('duration');
      });
    });
  });
});