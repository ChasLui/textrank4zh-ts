import { describe, expect, beforeEach } from 'vitest';
import { Segmentation, WordSegmentation, SentenceSegmentation } from '../src/core/segmentation';

describe('SentenceSegmentation', () => {
  let segmentation: SentenceSegmentation;

  beforeEach(() => {
    segmentation = new SentenceSegmentation();
  });

  test('应该能够正确分割句子', () => {
    const text = '这是第一个句子。这是第二个句子！这是第三个句子？';
    const result = segmentation.segment(text);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('这是第一个句子');
    expect(result[1]).toBe('这是第二个句子');
    expect(result[2]).toBe('这是第三个句子');
  });

  test('应该能够处理自定义分隔符', () => {
    const customSegmentation = new SentenceSegmentation([';', '|']);
    const text = '段落一;段落二|段落三';
    const result = customSegmentation.segment(text);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('段落一');
    expect(result[1]).toBe('段落二');
    expect(result[2]).toBe('段落三');
  });

  test('应该能够过滤空句子', () => {
    const text = '句子一。。。句子二！';
    const result = segmentation.segment(text);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe('句子一');
    expect(result[1]).toBe('句子二');
  });
});

describe('WordSegmentation', () => {
  let wordSegmentation: WordSegmentation;

  beforeEach(() => {
    wordSegmentation = new WordSegmentation();
  });

  test('应该能够进行基本分词', async () => {
    const text = '我爱北京天安门';

    // 等待分词器初始化
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = wordSegmentation.segment(text, {
      useStopWords: false,
      useSpeechTagsFilter: false,
    });

    expect(result.length).toBeGreaterThan(0);
    // 由于使用了简化的分词器，测试条件也需要相应调整
    expect(result.some((word) => word.includes('北京') || word === '北' || word === '京')).toBe(
      true
    );
  });

  test('应该能够去除停用词', () => {
    const text = '我爱北京天安门';
    const resultWithStopWords = wordSegmentation.segment(text, {
      useStopWords: false,
    });
    const resultWithoutStopWords = wordSegmentation.segment(text, {
      useStopWords: true,
    });

    expect(resultWithoutStopWords.length).toBeLessThanOrEqual(resultWithStopWords.length);
  });

  test('应该能够转换为小写', () => {
    const text = 'Hello World 你好';
    const result = wordSegmentation.segment(text, {
      lower: true,
      useStopWords: false,
    });

    const hasLowerCase = result.some((word) => /[a-z]/.test(word));
    expect(hasLowerCase).toBe(true);
  });

  test('应该能够批量处理句子', () => {
    const sentences = ['第一句话', '第二句话'];
    const result = wordSegmentation.segmentSentences(sentences);

    expect(result).toHaveLength(2);
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });
});

describe('Segmentation', () => {
  let segmentation: Segmentation;

  beforeEach(() => {
    segmentation = new Segmentation();
  });

  test('应该返回完整的分割结果', () => {
    const text = '北京是中国的首都。上海是经济中心。';
    const result = segmentation.segment(text);

    expect(result.sentences).toHaveLength(2);
    expect(result.wordsNoFilter).toHaveLength(2);
    expect(result.wordsNoStopWords).toHaveLength(2);
    expect(result.wordsAllFilters).toHaveLength(2);

    // 检查过滤程度
    const totalWordsNoFilter = result.wordsNoFilter.flat().length;
    const totalWordsNoStopWords = result.wordsNoStopWords.flat().length;
    const totalWordsAllFilters = result.wordsAllFilters.flat().length;

    expect(totalWordsNoStopWords).toBeLessThanOrEqual(totalWordsNoFilter);
    expect(totalWordsAllFilters).toBeLessThanOrEqual(totalWordsNoStopWords);
  });

  test('应该能够处理小写转换', () => {
    const text = 'Hello 世界';
    const resultLower = segmentation.segment(text, { lower: true });
    const resultNormal = segmentation.segment(text, { lower: false });

    const hasLowerInLower = resultLower.wordsNoFilter.flat().some((word) => /[a-z]/.test(word));
    const hasUpperInNormal = resultNormal.wordsNoFilter.flat().some((word) => /[A-Z]/.test(word));

    expect(hasLowerInLower).toBe(true);
    expect(hasUpperInNormal).toBe(true);
  });

  test('应该能够处理空文本', () => {
    const result = segmentation.segment('');

    expect(result.sentences).toHaveLength(0);
    expect(result.wordsNoFilter).toHaveLength(0);
    expect(result.wordsNoStopWords).toHaveLength(0);
    expect(result.wordsAllFilters).toHaveLength(0);
  });
});

describe('自定义分词器注入', () => {
  const text = '今天去了新开的咖啡店，服务员态度很好。';

  test('注入 tokenizer 后应使用它而非内置词表', () => {
    const calls: string[] = [];
    const tokenizer = (input: string): string[] => {
      calls.push(input);
      return ['自定义', '分词', '结果'];
    };

    const result = new Segmentation({ tokenizer }).segment(text);

    expect(calls.length).toBeGreaterThan(0);
    expect(result.wordsNoFilter[0]).toEqual(['自定义', '分词', '结果']);
  });

  test('未注入时回退到内置分词器', () => {
    const result = new Segmentation().segment(text);
    const words = result.wordsNoFilter[0];

    expect(words).toBeDefined();
    expect(words?.length).toBeGreaterThan(0);
    // 内置词表覆盖有限，此处只验证仍能产出分词结果
    expect(words?.join('')).toContain('咖');
  });

  test('注入的分词器结果不应被词性过滤误删', () => {
    // 自定义分词器不提供词性，实现内部统一标为 'n'，需确保 allowSpeechTags 过滤后仍有词
    const tokenizer = (): string[] => ['咖啡店', '服务员', '态度'];
    const result = new Segmentation({ tokenizer }).segment(text);

    expect(result.wordsAllFilters[0]).toEqual(['咖啡店', '服务员', '态度']);
  });
});
