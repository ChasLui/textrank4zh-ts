import {
  generateWordPairs,
  getDefaultSimilarity,
  pageRank,
  buildWordGraph,
  buildSentenceGraph,
  sortWords,
  sortSentences,
} from '../src/utils';

describe('generateWordPairs', () => {
  test('应该生成正确的词对', () => {
    const words = ['a', 'b', 'c', 'd'];
    const pairs = Array.from(generateWordPairs(words, 3));

    expect(pairs).toContainEqual(['a', 'b']);
    expect(pairs).toContainEqual(['a', 'c']);
    expect(pairs).toContainEqual(['b', 'c']);
    expect(pairs).toContainEqual(['b', 'd']);
    expect(pairs).toContainEqual(['c', 'd']);
  });

  test('窗口大小为2时应该只生成相邻词对', () => {
    const words = ['a', 'b', 'c'];
    const pairs = Array.from(generateWordPairs(words, 2));

    expect(pairs).toHaveLength(2);
    expect(pairs).toContainEqual(['a', 'b']);
    expect(pairs).toContainEqual(['b', 'c']);
  });

  test('应该处理空数组', () => {
    const pairs = Array.from(generateWordPairs([], 2));
    expect(pairs).toHaveLength(0);
  });

  test('窗口大小小于2时应该默认为2', () => {
    const words = ['a', 'b', 'c'];
    const pairs = Array.from(generateWordPairs(words, 1));

    expect(pairs).toHaveLength(2);
  });
});

describe('getDefaultSimilarity', () => {
  test('应该计算正确的相似度', () => {
    const words1 = ['苹果', '香蕉'];
    const words2 = ['苹果', '橘子'];

    const similarity = getDefaultSimilarity(words1, words2);

    expect(similarity).toBeGreaterThan(0);
    expect(typeof similarity).toBe('number');
  });

  test('完全相同的词列表相似度应该最高', () => {
    const words = ['苹果', '香蕉'];
    const similarity = getDefaultSimilarity(words, words);

    expect(similarity).toBeGreaterThan(0);
  });

  test('完全不同的词列表相似度应该为0', () => {
    const words1 = ['苹果'];
    const words2 = ['香蕉'];

    const similarity = getDefaultSimilarity(words1, words2);
    expect(similarity).toBe(0);
  });

  test('空词列表应该返回0', () => {
    const similarity1 = getDefaultSimilarity([], ['苹果']);
    const similarity2 = getDefaultSimilarity(['苹果'], []);
    const similarity3 = getDefaultSimilarity([], []);

    expect(similarity1).toBe(0);
    expect(similarity2).toBe(0);
    expect(similarity3).toBe(0);
  });
});

describe('pageRank', () => {
  test('应该计算PageRank值', () => {
    const matrix = [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ];

    const result = pageRank(matrix);

    expect(result.scores).toHaveLength(3);
    expect(result.iterations).toBeGreaterThan(0);

    // 所有分数之和应该约等于1
    const sum = result.scores.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);

    // 分数应该都为正数
    result.scores.forEach((score) => {
      expect(score).toBeGreaterThan(0);
    });
  });

  test('应该处理空矩阵', () => {
    const result = pageRank([]);

    expect(result.scores).toHaveLength(0);
    expect(result.iterations).toBe(0);
  });

  test('不同alpha值应该产生不同结果', () => {
    // 使用更复杂的图结构来确保alpha值的影响
    const matrix = [
      [0, 1, 1],
      [1, 0, 0],
      [0, 1, 0],
    ];

    const result1 = pageRank(matrix, { alpha: 0.5 });
    const result2 = pageRank(matrix, { alpha: 0.9 });

    // 对于更复杂的图，不同的alpha值应该产生不同的分数分布
    const hasSignificantDifference = result1.scores.some(
      (score, i) => Math.abs(score - result2.scores[i]) > 0.001
    );
    expect(hasSignificantDifference).toBe(true);
  });
});

describe('buildWordGraph', () => {
  test('应该构建词图', () => {
    const vertexWords = [
      ['苹果', '好吃'],
      ['香蕉', '甜'],
    ];
    const edgeWords = [
      ['苹果', '好吃'],
      ['香蕉', '甜'],
    ];

    const { adjacencyMatrix, wordIndex, indexWord } = buildWordGraph(vertexWords, edgeWords, 2);

    expect(adjacencyMatrix.length).toBe(4);
    expect(wordIndex.size).toBe(4);
    expect(indexWord.size).toBe(4);

    // 检查映射关系
    wordIndex.forEach((index, word) => {
      expect(indexWord.get(index)).toBe(word);
    });
  });

  test('应该处理重复词汇', () => {
    const vertexWords = [['苹果', '苹果', '好吃']];
    const edgeWords = [['苹果', '苹果', '好吃']];

    const { wordIndex } = buildWordGraph(vertexWords, edgeWords);

    expect(wordIndex.size).toBe(2); // 只有'苹果'和'好吃'两个不同的词
  });
});

describe('buildSentenceGraph', () => {
  test('应该构建句子图', () => {
    const sentences = ['句子一', '句子二', '句子三'];
    const words = [
      ['词1', '词2'],
      ['词2', '词3'],
      ['词1', '词3'],
    ];

    const adjacencyMatrix = buildSentenceGraph(sentences, words);

    expect(adjacencyMatrix.length).toBe(3);
    expect(adjacencyMatrix[0].length).toBe(3);

    // 对角线应该是自相似度（通常较高）
    for (let i = 0; i < 3; i++) {
      expect(adjacencyMatrix[i][i]).toBeGreaterThan(0);
    }

    // 矩阵应该是对称的
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(adjacencyMatrix[i][j]).toEqual(adjacencyMatrix[j][i]);
      }
    }
  });

  test('应该使用自定义相似度函数', () => {
    const sentences = ['a', 'b'];
    const words = [['word1'], ['word2']];

    const customSimilarity = () => 0.5;
    const adjacencyMatrix = buildSentenceGraph(sentences, words, customSimilarity);

    expect(adjacencyMatrix[0][1]).toBe(0.5);
    expect(adjacencyMatrix[1][0]).toBe(0.5);
  });
});

describe('sortWords', () => {
  test('应该返回排序的关键词', () => {
    const vertexWords = [
      ['北京', '首都'],
      ['上海', '城市'],
    ];
    const edgeWords = [
      ['北京', '首都'],
      ['上海', '城市'],
    ];

    const keywords = sortWords(vertexWords, edgeWords, 2);

    expect(keywords.length).toBeGreaterThan(0);
    keywords.forEach((keyword) => {
      expect(keyword).toHaveProperty('word');
      expect(keyword).toHaveProperty('weight');
      expect(typeof keyword.word).toBe('string');
      expect(typeof keyword.weight).toBe('number');
    });

    // 检查排序
    for (let i = 1; i < keywords.length; i++) {
      expect(keywords[i - 1].weight).toBeGreaterThanOrEqual(keywords[i].weight);
    }
  });
});

describe('sortSentences', () => {
  test('应该返回排序的句子', () => {
    const sentences = ['北京是首都', '上海是大城市', '深圳发展很快'];
    const words = [
      ['北京', '首都'],
      ['上海', '大城市'],
      ['深圳', '发展', '很快'],
    ];

    const sentenceItems = sortSentences(sentences, words);

    expect(sentenceItems.length).toBe(3);
    sentenceItems.forEach((item, index) => {
      expect(item).toHaveProperty('index');
      expect(item).toHaveProperty('sentence');
      expect(item).toHaveProperty('weight');
      expect(item.sentence).toBe(sentences[item.index]);
    });

    // 检查排序
    for (let i = 1; i < sentenceItems.length; i++) {
      expect(sentenceItems[i - 1].weight).toBeGreaterThanOrEqual(sentenceItems[i].weight);
    }
  });
});
