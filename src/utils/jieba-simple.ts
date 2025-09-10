/**
 * 轻量级中文分词实现，专为浏览器环境设计
 * 基于最大正向匹配算法和规则，完全自包含，无外部依赖
 */

// 默认停用词列表（内置常用停用词）
const DEFAULT_STOP_WORDS = new Set([
  '?', '、', '。', '"', '"', '《', '》', '！', '，', '：', '；', '？',
  '啊', '阿', '哎', '哎呀', '哎哟', '唉', '俺', '俺们', '按', '按照',
  '吧', '吧哒', '把', '罢了', '被', '本', '本着', '比', '比方', '比如',
  '鄙人', '彼', '彼此', '边', '别', '别的', '别说', '并', '并且',
  '不比', '不成', '不单', '不但', '不独', '不管', '不光', '不过', '不仅',
  '不拘', '不论', '不怕', '不然', '不如', '不特', '不惟', '不问', '不只',
  '朝', '朝着', '趁', '趁着', '乘', '冲', '除', '除此之外', '除非', '除了',
  '此', '此间', '此外', '从', '从而', '打', '待', '但', '但是', '当',
  '当着', '到', '得', '的', '的话', '等', '等等', '地', '第', '叮咚',
  '对', '对于', '多', '多少', '而', '而况', '而且', '而是', '而外', '而言',
  '而已', '尔后', '反过来', '反过来说', '反之', '非但', '非徒', '否则',
  '嘎', '嘎登', '该', '赶', '个', '各', '各个', '各位', '各种', '各自',
  '给', '根据', '跟', '故', '故此', '固然', '关于', '管', '归', '果然',
  '果真', '过', '哈', '哈哈', '呵', '和', '何', '何况', '何处', '何时',
  '嘿', '哼', '哼唷', '呼哧', '乎', '呼', '忽然', '或', '或是', '或者',
  '极了', '及', '及其', '及至', '即', '即便', '即或', '即令', '即若',
  '即使', '几', '几时', '己', '既', '既然', '既是', '继而', '加之',
  '假如', '假若', '假使', '鉴于', '将', '较', '较之', '叫', '接着',
  '结果', '借', '紧接着', '进而', '尽', '尽管', '经', '经过', '就',
  '就是', '就是说', '据', '具体地说', '具体说来', '开始', '开外', '靠',
  '咳', '可', '可见', '可是', '可以', '况且', '啦', '来', '来着', '离',
  '例如', '哩', '连', '连同', '两者', '了', '临', '另', '另外', '另一方面',
  '论', '嘛', '吗', '慢说', '漫说', '冒', '么', '每', '每当', '们', '莫若',
  '某', '某个', '某些', '拿', '哪', '哪边', '哪儿', '哪个', '哪里', '哪年',
  '哪怕', '哪天', '哪些', '哪样', '那', '那边', '那儿', '那个', '那会儿',
  '那里', '那么', '那么些', '那么样', '那时', '那些', '那样', '乃', '乃至',
  '呢', '能', '你', '你们', '您', '宁', '宁可', '宁肯', '宁愿', '哦', '呕',
  '啪达', '旁人', '呸', '凭', '凭借', '其', '其次', '其二', '其他', '其它',
  '其一', '其余', '其中', '起', '起见', '岂但', '恰恰相反', '前后', '前者',
  '且', '然而', '然后', '然则', '让', '人家', '任', '任何', '任凭', '如',
  '如此', '如果', '如来', '如若', '如上所述', '若', '若非', '若是', '啥',
  '上下', '尚且', '设若', '设使', '甚而', '甚么', '甚至', '省得', '时候',
  '什么', '什么样', '使得', '是', '是的', '首先', '谁', '谁知', '顺', '顺着',
  '似的', '虽', '虽然', '虽说', '虽则', '随', '随着', '所', '所以', '他',
  '他们', '他人', '它', '它们', '她', '她们', '倘', '倘或', '倘然', '倘若',
  '倘使', '腾', '替', '通过', '同', '同时', '哇', '万一', '往', '望', '为',
  '为何', '为了', '为什么', '为着', '喂', '嗡嗡', '我', '我们', '呜', '呜呼',
  '乌乎', '无论', '无宁', '毋宁', '嘻', '吓', '相对而言', '像', '向', '向着',
  '嘘', '呀', '焉', '沿', '沿着', '要', '要不', '要不然', '要不是', '要么',
  '要是', '也', '也罢', '也好', '一', '一般', '一旦', '一方面', '一来',
  '一切', '一样', '一则', '依', '依照', '矣', '以', '以便', '以及', '以免',
  '以至', '以至于', '以致', '抑或', '因', '因此', '因而', '因为', '哟',
  '用', '由', '由此可见', '由于', '有', '有的', '有关', '有些', '又', '于',
  '于是', '于是乎', '与', '与此同时', '与否', '与其', '越是', '云云', '哉',
  '再说', '再者', '在', '在下', '咱', '咱们', '则', '怎', '怎么', '怎么办',
  '怎么样', '怎样', '咋', '照', '照着', '者', '这', '这边', '这儿', '这个',
  '这会儿', '这里', '这么', '这么点儿', '这么些', '这么样', '这时', '这些',
  '这样', '正如', '吱', '之', '之类', '之所以', '之一', '只是', '只限', '只要',
  '只有', '至', '至于', '诸位', '着', '着呢', '自', '自从', '自个儿', '自各儿',
  '自己', '自家', '自身', '综上所述', '总而言之', '总之', '纵', '纵令',
  '纵然', '纵使', '遵照', '作为', '兹', '咦', '呃', '好吧'
]);

// 基本词性标注（简化版）
const SPEECH_TAGS = {
  n: ['人', '天', '地', '国', '家', '公司', '学校', '医院', '银行', '商店'],
  v: ['是', '有', '去', '来', '说', '做', '看', '听', '想', '知道', '觉得'],
  a: ['好', '大', '小', '高', '低', '新', '旧', '美', '丑', '红', '白'],
  d: ['很', '非常', '特别', '比较', '相当', '十分', '极其', '最'],
  p: ['在', '的', '了', '着', '过', '与', '和', '对', '为', '由', '从'],
  m: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '个', '只', '张', '本'],
};

/**
 * 简单中文分词器
 */
export class SimpleJieba {
  private stopWords: Set<string>;

  constructor(stopWords?: string[]) {
    this.stopWords = stopWords ? new Set(stopWords) : DEFAULT_STOP_WORDS;
  }

  /**
   * 基本分词 - 使用正则表达式进行简单分词
   */
  cut(text: string): string[] {
    // 预处理：规范化文本
    text = text.replace(/\s+/g, ' ').trim();
    
    const words: string[] = [];
    let i = 0;
    
    while (i < text.length) {
      const char = text[i];
      
      // 处理中文字符
      if (this.isChinese(char)) {
        // 尝试匹配常见词汇
        const word = this.matchWord(text, i);
        words.push(word);
        i += word.length;
      }
      // 处理英文单词
      else if (this.isEnglish(char)) {
        const word = this.extractEnglishWord(text, i);
        words.push(word);
        i += word.length;
      }
      // 处理数字
      else if (this.isDigit(char)) {
        const word = this.extractNumber(text, i);
        words.push(word);
        i += word.length;
      }
      // 处理标点符号
      else if (this.isPunctuation(char)) {
        if (char.trim()) {
          words.push(char);
        }
        i++;
      }
      // 跳过空格和其他字符
      else {
        i++;
      }
    }
    
    return words.filter(word => word.trim().length > 0);
  }

  /**
   * 带词性标注的分词
   */
  tag(text: string): Array<{ word: string; pos: string }> {
    const words = this.cut(text);
    return words.map(word => ({
      word,
      pos: this.getPartOfSpeech(word)
    }));
  }

  /**
   * 匹配词汇（优先匹配长词）
   */
  private matchWord(text: string, startIndex: number): string {
    // 常见的双字词和三字词匹配
    const maxLength = Math.min(4, text.length - startIndex);
    
    for (let len = maxLength; len >= 1; len--) {
      const word = text.substr(startIndex, len);
      if (len > 1 && this.isCommonWord(word)) {
        return word;
      }
    }
    
    // 如果没有匹配到常见词，返回单个字符
    return text[startIndex];
  }

  /**
   * 判断是否为常见词汇
   */
  private isCommonWord(word: string): boolean {
    // 简单的常见词汇列表（实际使用中可以扩展）
    const commonWords = [
      // 常见双字词
      '人工', '智能', '自然', '语言', '处理', '机器', '学习', '深度', '神经', '网络',
      '文本', '分析', '关键', '提取', '摘要', '生成', '算法', '模型', '训练', '数据',
      '中国', '北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都', '重庆',
      '公司', '企业', '科技', '发展', '经济', '市场', '产品', '服务', '管理', '技术',
      '教育', '学校', '大学', '研究', '科学', '实验', '方法', '理论', '应用', '系统',
      '社会', '政治', '文化', '历史', '传统', '现代', '未来', '世界', '国际', '全球',
      '时间', '空间', '地方', '位置', '方向', '距离', '速度', '温度', '颜色', '声音',
      '问题', '答案', '原因', '结果', '影响', '作用', '效果', '意义', '价值', '重要',
      // 常见三字词
      '计算机', '互联网', '大数据', '云计算', '物联网', '区块链', '人工智能',
      '自动驾驶', '虚拟现实', '增强现实', '机器学习', '深度学习', '神经网络',
      '自然语言', '语言处理', '图像识别', '语音识别', '文本分析', '数据挖掘',
      '信息技术', '软件开发', '程序设计', '数据库', '操作系统', '网络安全'
    ];
    
    return commonWords.includes(word);
  }

  /**
   * 提取英文单词
   */
  private extractEnglishWord(text: string, startIndex: number): string {
    let word = '';
    let i = startIndex;
    
    while (i < text.length && (this.isEnglish(text[i]) || this.isDigit(text[i]))) {
      word += text[i];
      i++;
    }
    
    return word;
  }

  /**
   * 提取数字
   */
  private extractNumber(text: string, startIndex: number): string {
    let word = '';
    let i = startIndex;
    
    while (i < text.length && (this.isDigit(text[i]) || text[i] === '.')) {
      word += text[i];
      i++;
    }
    
    return word;
  }

  /**
   * 获取词性
   */
  private getPartOfSpeech(word: string): string {
    // 简单的词性判断
    if (this.isDigit(word[0])) return 'm'; // 数词
    if (this.isPunctuation(word[0])) return 'w'; // 标点
    if (!this.isChinese(word[0])) return 'eng'; // 英文
    
    // 查找词性
    for (const [pos, words] of Object.entries(SPEECH_TAGS)) {
      if (words.includes(word)) {
        return pos;
      }
    }
    
    // 根据字符特征判断
    if (word.length === 1) {
      const char = word[0];
      if ('很非常特别比较相当十分极其最'.includes(char)) return 'd'; // 副词
      if ('的了着过'.includes(char)) return 'p'; // 助词
      if ('一二三四五六七八九十'.includes(char)) return 'm'; // 数词
    }
    
    return 'n'; // 默认名词
  }

  /**
   * 判断是否为中文字符
   */
  private isChinese(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0x4e00 && code <= 0x9fa5;
  }

  /**
   * 判断是否为英文字符
   */
  private isEnglish(char: string): boolean {
    const code = char.charCodeAt(0);
    return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
  }

  /**
   * 判断是否为数字
   */
  private isDigit(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0x30 && code <= 0x39;
  }

  /**
   * 判断是否为标点符号
   */
  private isPunctuation(char: string): boolean {
    const punctuations = '。，！？；：""\'\'（）【】《》、·…—–';
    return punctuations.includes(char) || /[\p{P}]/u.test(char);
  }

  /**
   * 更新停用词
   */
  setStopWords(stopWords: string[]): void {
    this.stopWords = new Set(stopWords);
  }

  /**
   * 检查是否为停用词
   */
  isStopWord(word: string): boolean {
    return this.stopWords.has(word);
  }
}

// 创建默认实例
export const jieba = new SimpleJieba();