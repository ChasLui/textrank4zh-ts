Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region src/types/index.ts
/**
* 自定义错误类型
*/
var ErrorType = /* @__PURE__ */ function(ErrorType) {
	ErrorType["INITIALIZATION_ERROR"] = "INITIALIZATION_ERROR";
	ErrorType["WORKER_ERROR"] = "WORKER_ERROR";
	ErrorType["COMPUTATION_ERROR"] = "COMPUTATION_ERROR";
	ErrorType["SERIALIZATION_ERROR"] = "SERIALIZATION_ERROR";
	ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
	ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
	ErrorType["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
	ErrorType["UNSUPPORTED_ERROR"] = "UNSUPPORTED_ERROR";
	return ErrorType;
}({});
/**
* 默认配置常量
*/
var DEFAULT_CONFIG = {
	SENTENCE_DELIMITERS: [
		"?",
		"!",
		";",
		"？",
		"！",
		"。",
		"；",
		"……",
		"…",
		"\n"
	],
	ALLOW_SPEECH_TAGS: [
		"an",
		"i",
		"j",
		"l",
		"n",
		"nr",
		"nrfg",
		"ns",
		"nt",
		"nz",
		"t",
		"v",
		"vd",
		"vn",
		"eng"
	],
	PAGERANK: {
		alpha: .85,
		maxIterations: 100,
		tolerance: 1e-6
	}
};
var WorkerType = /* @__PURE__ */ function(WorkerType) {
	WorkerType["SHARED"] = "shared";
	WorkerType["DEDICATED"] = "dedicated";
	WorkerType["SYNC"] = "sync";
	return WorkerType;
}({});
//#endregion
//#region src/utils/index.ts
/**
* 生成滑动窗口内的单词组合
* @param wordList 单词列表
* @param window 窗口大小
* @returns 单词对的生成器
*/
function* generateWordPairs(wordList, window = 2) {
	if (window < 2) window = 2;
	for (let i = 1; i < window && i < wordList.length; i++) {
		const word1List = wordList.slice(0, wordList.length - i);
		const word2List = wordList.slice(i);
		for (const [j, word1] of word1List.entries()) {
			const word2 = word2List[j];
			if (word2 === void 0) continue;
			yield [word1, word2];
		}
	}
}
/**
* 计算两个词列表的相似度（基于共现词数量和长度）
* @param words1 第一个词列表
* @param words2 第二个词列表
* @returns 相似度值
*/
var getDefaultSimilarity = (words1, words2) => {
	const allWords = Array.from(/* @__PURE__ */ new Set([...words1, ...words2]));
	const vector1 = allWords.map((word) => words1.filter((w) => w === word).length);
	const vector2 = allWords.map((word) => words2.filter((w) => w === word).length);
	const coOccurNum = vector1.reduce((count, v1, i) => count + (v1 * (vector2[i] ?? 0) > 0 ? 1 : 0), 0);
	if (Math.abs(coOccurNum) <= 1e-12) return 0;
	const denominator = Math.log(words1.length) + Math.log(words2.length);
	if (Math.abs(denominator) < 1e-12) return 0;
	return coOccurNum / denominator;
};
/**
* PageRank 算法实现
* @param adjacencyMatrix 邻接矩阵
* @param config PageRank配置
* @returns PageRank结果
*/
function pageRank(adjacencyMatrix, config = {}) {
	const { alpha = DEFAULT_CONFIG.PAGERANK.alpha, maxIterations = DEFAULT_CONFIG.PAGERANK.maxIterations, tolerance = DEFAULT_CONFIG.PAGERANK.tolerance } = config;
	const n = adjacencyMatrix.length;
	if (n === 0) return {
		scores: [],
		iterations: 0
	};
	let scores = Array.from({ length: n }, () => 1 / n);
	const newScores = Array.from({ length: n }, () => 0);
	const transitionMatrix = adjacencyMatrix.map((row) => {
		const rowSum = row.reduce((sum, val) => sum + val, 0);
		return rowSum > 0 ? row.map((val) => val / rowSum) : row;
	});
	let iterations = 0;
	for (let iter = 0; iter < maxIterations; iter++) {
		iterations = iter + 1;
		for (let i = 0; i < n; i++) {
			let newScore = (1 - alpha) / n;
			for (let j = 0; j < n; j++) {
				const weight = transitionMatrix[j]?.[i] ?? 0;
				if (weight > 0) newScore += alpha * (scores[j] ?? 0) * weight;
			}
			newScores[i] = newScore;
		}
		let diff = 0;
		for (let i = 0; i < n; i++) diff += Math.abs((newScores[i] ?? 0) - (scores[i] ?? 0));
		if (diff < tolerance) {
			scores = newScores.slice();
			break;
		}
		scores = newScores.slice();
		newScores.fill(0);
	}
	return {
		scores,
		iterations
	};
}
/**
* 构建单词图的邻接矩阵
* @param vertexWords 用于构建节点的词列表
* @param edgeWords 用于构建边的词列表
* @param window 窗口大小
* @returns 邻接矩阵和词索引映射
*/
function buildWordGraph(vertexWords, edgeWords, window = 2) {
	const wordIndex = /* @__PURE__ */ new Map();
	const indexWord = /* @__PURE__ */ new Map();
	let wordCount = 0;
	for (const sentence of vertexWords) for (const word of sentence) if (!wordIndex.has(word)) {
		wordIndex.set(word, wordCount);
		indexWord.set(wordCount, word);
		wordCount++;
	}
	const adjacencyMatrix = Array(wordCount).fill(null).map(() => Array(wordCount).fill(0));
	for (const sentence of edgeWords) for (const [word1, word2] of generateWordPairs(sentence, window)) {
		const index1 = wordIndex.get(word1);
		const index2 = wordIndex.get(word2);
		if (index1 === void 0 || index2 === void 0) continue;
		const row1 = adjacencyMatrix[index1];
		const row2 = adjacencyMatrix[index2];
		if (!row1 || !row2) continue;
		row1[index2] = 1;
		row2[index1] = 1;
	}
	return {
		adjacencyMatrix,
		wordIndex,
		indexWord
	};
}
/**
* 构建句子图的邻接矩阵
* @param sentences 句子列表
* @param words 对应的词列表
* @param similarityFunc 相似度计算函数
* @returns 邻接矩阵
*/
function buildSentenceGraph(sentences, words, similarityFunc = getDefaultSimilarity) {
	const n = sentences.length;
	const adjacencyMatrix = Array(n).fill(null).map(() => Array(n).fill(0));
	for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
		const wordsI = words[i];
		const wordsJ = words[j];
		const rowI = adjacencyMatrix[i];
		const rowJ = adjacencyMatrix[j];
		if (!wordsI || !wordsJ || !rowI || !rowJ) throw new Error("buildSentenceGraph: 句子列表与词列表长度不一致");
		const similarity = similarityFunc(wordsI, wordsJ);
		rowI[j] = similarity;
		rowJ[i] = similarity;
	}
	return adjacencyMatrix;
}
/**
* 对单词按重要性排序
* @param vertexWords 用于构建节点的词列表
* @param edgeWords 用于构建边的词列表
* @param window 窗口大小
* @param pageRankConfig PageRank配置
* @returns 排序后的关键词列表
*/
function sortWords(vertexWords, edgeWords, window = 2, pageRankConfig = {}) {
	const { adjacencyMatrix, indexWord } = buildWordGraph(vertexWords, edgeWords, window);
	const { scores } = pageRank(adjacencyMatrix, pageRankConfig);
	const keywords = [];
	for (const [i, score] of scores.entries()) {
		const word = indexWord.get(i);
		if (word) keywords.push({
			word,
			weight: score
		});
	}
	return keywords.sort((a, b) => b.weight - a.weight);
}
/**
* 对句子按重要性排序
* @param sentences 句子列表
* @param words 对应的词列表
* @param similarityFunc 相似度计算函数
* @param pageRankConfig PageRank配置
* @returns 排序后的句子列表
*/
function sortSentences(sentences, words, similarityFunc = getDefaultSimilarity, pageRankConfig = {}) {
	const { scores } = pageRank(buildSentenceGraph(sentences, words, similarityFunc), pageRankConfig);
	return sentences.map((sentence, index) => ({
		index,
		sentence,
		weight: scores[index] ?? 0
	})).sort((a, b) => b.weight - a.weight);
}
/**
* 调试输出函数
* @param message 调试信息
*/
function debug(...args) {
	if (typeof process !== "undefined" && process.env?.["DEBUG"] === "1") console.log("[DEBUG]", ...args);
}
//#endregion
//#region src/data/stopwords.ts
/**
* 内置停用词列表
*/
var STOP_WORDS = [
	"?",
	"、",
	"。",
	"\"",
	"\"",
	"《",
	"》",
	"！",
	"，",
	"：",
	"；",
	"？",
	"啊",
	"阿",
	"哎",
	"哎呀",
	"哎哟",
	"唉",
	"俺",
	"俺们",
	"按",
	"按照",
	"吧",
	"吧哒",
	"把",
	"罢了",
	"被",
	"本",
	"本着",
	"比",
	"比方",
	"比如",
	"鄙人",
	"彼",
	"彼此",
	"边",
	"别",
	"别的",
	"别说",
	"并",
	"并且",
	"不比",
	"不成",
	"不单",
	"不但",
	"不独",
	"不管",
	"不光",
	"不过",
	"不仅",
	"不拘",
	"不论",
	"不怕",
	"不然",
	"不如",
	"不特",
	"不惟",
	"不问",
	"不只",
	"朝",
	"朝着",
	"趁",
	"趁着",
	"乘",
	"冲",
	"除",
	"除此之外",
	"除非",
	"除了",
	"此",
	"此间",
	"此外",
	"从",
	"从而",
	"打",
	"待",
	"但",
	"但是",
	"当",
	"当着",
	"到",
	"得",
	"的",
	"的话",
	"等",
	"等等",
	"地",
	"第",
	"叮咚",
	"对",
	"对于",
	"多",
	"多少",
	"而",
	"而况",
	"而且",
	"而是",
	"而外",
	"而言",
	"而已",
	"尔后",
	"反过来",
	"反过来说",
	"反之",
	"非但",
	"非徒",
	"否则",
	"嘎",
	"嘎登",
	"该",
	"赶",
	"个",
	"各",
	"各个",
	"各位",
	"各种",
	"各自",
	"给",
	"根据",
	"跟",
	"故",
	"故此",
	"固然",
	"关于",
	"管",
	"归",
	"果然",
	"果真",
	"过",
	"哈",
	"哈哈",
	"呵",
	"和",
	"何",
	"何况",
	"何处",
	"何时",
	"嘿",
	"哼",
	"哼唷",
	"呼哧",
	"乎",
	"呼",
	"忽然",
	"或",
	"或是",
	"或者",
	"极了",
	"及",
	"及其",
	"及至",
	"即",
	"即便",
	"即或",
	"即令",
	"即若",
	"即使",
	"几",
	"几时",
	"己",
	"既",
	"既然",
	"既是",
	"继而",
	"加之",
	"假如",
	"假若",
	"假使",
	"鉴于",
	"将",
	"较",
	"较之",
	"叫",
	"接着",
	"结果",
	"借",
	"紧接着",
	"进而",
	"尽",
	"尽管",
	"经",
	"经过",
	"就",
	"就是",
	"就是说",
	"据",
	"具体地说",
	"具体说来",
	"开始",
	"开外",
	"靠",
	"咳",
	"可",
	"可见",
	"可是",
	"可以",
	"况且",
	"啦",
	"来",
	"来着",
	"离",
	"例如",
	"哩",
	"连",
	"连同",
	"两者",
	"了",
	"临",
	"另",
	"另外",
	"另一方面",
	"论",
	"嘛",
	"吗",
	"慢说",
	"漫说",
	"冒",
	"么",
	"每",
	"每当",
	"们",
	"莫若",
	"某",
	"某个",
	"某些",
	"拿",
	"哪",
	"哪边",
	"哪儿",
	"哪个",
	"哪里",
	"哪年",
	"哪怕",
	"哪天",
	"哪些",
	"哪样",
	"那",
	"那边",
	"那儿",
	"那个",
	"那会儿",
	"那里",
	"那么",
	"那么些",
	"那么样",
	"那时",
	"那些",
	"那样",
	"乃",
	"乃至",
	"呢",
	"能",
	"你",
	"你们",
	"您",
	"宁",
	"宁可",
	"宁肯",
	"宁愿",
	"哦",
	"呕",
	"啪达",
	"旁人",
	"呸",
	"凭",
	"凭借",
	"其",
	"其次",
	"其二",
	"其他",
	"其它",
	"其一",
	"其余",
	"其中",
	"起",
	"起见",
	"岂但",
	"恰恰相反",
	"前后",
	"前者",
	"且",
	"然而",
	"然后",
	"然则",
	"让",
	"人家",
	"任",
	"任何",
	"任凭",
	"如",
	"如此",
	"如果",
	"如来",
	"如若",
	"如上所述",
	"若",
	"若非",
	"若是",
	"啥",
	"上下",
	"尚且",
	"设若",
	"设使",
	"甚而",
	"甚么",
	"甚至",
	"省得",
	"时候",
	"什么",
	"什么样",
	"使得",
	"是",
	"是的",
	"首先",
	"谁",
	"谁知",
	"顺",
	"顺着",
	"似的",
	"虽",
	"虽然",
	"虽说",
	"虽则",
	"随",
	"随着",
	"所",
	"所以",
	"他",
	"他们",
	"他人",
	"它",
	"它们",
	"她",
	"她们",
	"倘",
	"倘或",
	"倘然",
	"倘若",
	"倘使",
	"腾",
	"替",
	"通过",
	"同",
	"同时",
	"哇",
	"万一",
	"往",
	"望",
	"为",
	"为何",
	"为了",
	"为什么",
	"为着",
	"喂",
	"嗡嗡",
	"我",
	"我们",
	"呜",
	"呜呼",
	"乌乎",
	"无论",
	"无宁",
	"毋宁",
	"嘻",
	"吓",
	"相对而言",
	"像",
	"向",
	"向着",
	"嘘",
	"呀",
	"焉",
	"沿",
	"沿着",
	"要",
	"要不",
	"要不然",
	"要不是",
	"要么",
	"要是",
	"也",
	"也罢",
	"也好",
	"一",
	"一般",
	"一旦",
	"一方面",
	"一来",
	"一切",
	"一样",
	"一则",
	"依",
	"依照",
	"矣",
	"以",
	"以便",
	"以及",
	"以免",
	"以至",
	"以至于",
	"以致",
	"抑或",
	"因",
	"因此",
	"因而",
	"因为",
	"哟",
	"用",
	"由",
	"由此可见",
	"由于",
	"有",
	"有的",
	"有关",
	"有些",
	"又",
	"于",
	"于是",
	"于是乎",
	"与",
	"与此同时",
	"与否",
	"与其",
	"越是",
	"云云",
	"哉",
	"再说",
	"再者",
	"在",
	"在下",
	"咱",
	"咱们",
	"则",
	"怎",
	"怎么",
	"怎么办",
	"怎么样",
	"怎样",
	"咋",
	"照",
	"照着",
	"者",
	"这",
	"这边",
	"这儿",
	"这个",
	"这会儿",
	"这里",
	"这么",
	"这么点儿",
	"这么些",
	"这么样",
	"这时",
	"这些",
	"这样",
	"正如",
	"吱",
	"之",
	"之类",
	"之所以",
	"之一",
	"只是",
	"只限",
	"只要",
	"只有",
	"至",
	"至于",
	"诸位",
	"着",
	"着呢",
	"自",
	"自从",
	"自个儿",
	"自各儿",
	"自己",
	"自家",
	"自身",
	"综上所述",
	"总而言之",
	"总之",
	"纵",
	"纵令",
	"纵然",
	"纵使",
	"遵照",
	"作为",
	"兹",
	"咦",
	"呃",
	"好吧"
];
//#endregion
//#region src/utils/jieba-simple.ts
/**
* 轻量级中文分词实现，专为浏览器环境设计
* 基于最大正向匹配算法和规则，完全自包含，无外部依赖
*/
/**
* 内置词表。原先声明在 isCommonWord 方法内部，导致每次调用都重建整个数组
* 并做 O(n) 的 includes 查找；而 matchWord 对每个中文字符最多调用 4 次。
* 提为模块级 Set：只构造一次，查找降为 O(1)。词条内容未作增删。
*/
var COMMON_WORDS = /* @__PURE__ */ new Set([
	"人工",
	"智能",
	"自然",
	"语言",
	"处理",
	"机器",
	"学习",
	"深度",
	"神经",
	"网络",
	"文本",
	"分析",
	"关键",
	"提取",
	"摘要",
	"生成",
	"算法",
	"模型",
	"训练",
	"数据",
	"中国",
	"北京",
	"上海",
	"广州",
	"深圳",
	"杭州",
	"南京",
	"武汉",
	"成都",
	"重庆",
	"公司",
	"企业",
	"科技",
	"发展",
	"经济",
	"市场",
	"产品",
	"服务",
	"管理",
	"技术",
	"教育",
	"学校",
	"大学",
	"研究",
	"科学",
	"实验",
	"方法",
	"理论",
	"应用",
	"系统",
	"社会",
	"政治",
	"文化",
	"历史",
	"传统",
	"现代",
	"未来",
	"世界",
	"国际",
	"全球",
	"时间",
	"空间",
	"地方",
	"位置",
	"方向",
	"距离",
	"速度",
	"温度",
	"颜色",
	"声音",
	"问题",
	"答案",
	"原因",
	"结果",
	"影响",
	"作用",
	"效果",
	"意义",
	"价值",
	"重要",
	"计算机",
	"互联网",
	"大数据",
	"云计算",
	"物联网",
	"区块链",
	"人工智能",
	"自动驾驶",
	"虚拟现实",
	"增强现实",
	"机器学习",
	"深度学习",
	"神经网络",
	"自然语言",
	"语言处理",
	"图像识别",
	"语音识别",
	"文本分析",
	"数据挖掘",
	"信息技术",
	"软件开发",
	"程序设计",
	"数据库",
	"操作系统",
	"网络安全"
]);
var DEFAULT_STOP_WORDS = /* @__PURE__ */ new Set([
	"?",
	"、",
	"。",
	"\"",
	"\"",
	"《",
	"》",
	"！",
	"，",
	"：",
	"；",
	"？",
	"啊",
	"阿",
	"哎",
	"哎呀",
	"哎哟",
	"唉",
	"俺",
	"俺们",
	"按",
	"按照",
	"吧",
	"吧哒",
	"把",
	"罢了",
	"被",
	"本",
	"本着",
	"比",
	"比方",
	"比如",
	"鄙人",
	"彼",
	"彼此",
	"边",
	"别",
	"别的",
	"别说",
	"并",
	"并且",
	"不比",
	"不成",
	"不单",
	"不但",
	"不独",
	"不管",
	"不光",
	"不过",
	"不仅",
	"不拘",
	"不论",
	"不怕",
	"不然",
	"不如",
	"不特",
	"不惟",
	"不问",
	"不只",
	"朝",
	"朝着",
	"趁",
	"趁着",
	"乘",
	"冲",
	"除",
	"除此之外",
	"除非",
	"除了",
	"此",
	"此间",
	"此外",
	"从",
	"从而",
	"打",
	"待",
	"但",
	"但是",
	"当",
	"当着",
	"到",
	"得",
	"的",
	"的话",
	"等",
	"等等",
	"地",
	"第",
	"叮咚",
	"对",
	"对于",
	"多",
	"多少",
	"而",
	"而况",
	"而且",
	"而是",
	"而外",
	"而言",
	"而已",
	"尔后",
	"反过来",
	"反过来说",
	"反之",
	"非但",
	"非徒",
	"否则",
	"嘎",
	"嘎登",
	"该",
	"赶",
	"个",
	"各",
	"各个",
	"各位",
	"各种",
	"各自",
	"给",
	"根据",
	"跟",
	"故",
	"故此",
	"固然",
	"关于",
	"管",
	"归",
	"果然",
	"果真",
	"过",
	"哈",
	"哈哈",
	"呵",
	"和",
	"何",
	"何况",
	"何处",
	"何时",
	"嘿",
	"哼",
	"哼唷",
	"呼哧",
	"乎",
	"呼",
	"忽然",
	"或",
	"或是",
	"或者",
	"极了",
	"及",
	"及其",
	"及至",
	"即",
	"即便",
	"即或",
	"即令",
	"即若",
	"即使",
	"几",
	"几时",
	"己",
	"既",
	"既然",
	"既是",
	"继而",
	"加之",
	"假如",
	"假若",
	"假使",
	"鉴于",
	"将",
	"较",
	"较之",
	"叫",
	"接着",
	"结果",
	"借",
	"紧接着",
	"进而",
	"尽",
	"尽管",
	"经",
	"经过",
	"就",
	"就是",
	"就是说",
	"据",
	"具体地说",
	"具体说来",
	"开始",
	"开外",
	"靠",
	"咳",
	"可",
	"可见",
	"可是",
	"可以",
	"况且",
	"啦",
	"来",
	"来着",
	"离",
	"例如",
	"哩",
	"连",
	"连同",
	"两者",
	"了",
	"临",
	"另",
	"另外",
	"另一方面",
	"论",
	"嘛",
	"吗",
	"慢说",
	"漫说",
	"冒",
	"么",
	"每",
	"每当",
	"们",
	"莫若",
	"某",
	"某个",
	"某些",
	"拿",
	"哪",
	"哪边",
	"哪儿",
	"哪个",
	"哪里",
	"哪年",
	"哪怕",
	"哪天",
	"哪些",
	"哪样",
	"那",
	"那边",
	"那儿",
	"那个",
	"那会儿",
	"那里",
	"那么",
	"那么些",
	"那么样",
	"那时",
	"那些",
	"那样",
	"乃",
	"乃至",
	"呢",
	"能",
	"你",
	"你们",
	"您",
	"宁",
	"宁可",
	"宁肯",
	"宁愿",
	"哦",
	"呕",
	"啪达",
	"旁人",
	"呸",
	"凭",
	"凭借",
	"其",
	"其次",
	"其二",
	"其他",
	"其它",
	"其一",
	"其余",
	"其中",
	"起",
	"起见",
	"岂但",
	"恰恰相反",
	"前后",
	"前者",
	"且",
	"然而",
	"然后",
	"然则",
	"让",
	"人家",
	"任",
	"任何",
	"任凭",
	"如",
	"如此",
	"如果",
	"如来",
	"如若",
	"如上所述",
	"若",
	"若非",
	"若是",
	"啥",
	"上下",
	"尚且",
	"设若",
	"设使",
	"甚而",
	"甚么",
	"甚至",
	"省得",
	"时候",
	"什么",
	"什么样",
	"使得",
	"是",
	"是的",
	"首先",
	"谁",
	"谁知",
	"顺",
	"顺着",
	"似的",
	"虽",
	"虽然",
	"虽说",
	"虽则",
	"随",
	"随着",
	"所",
	"所以",
	"他",
	"他们",
	"他人",
	"它",
	"它们",
	"她",
	"她们",
	"倘",
	"倘或",
	"倘然",
	"倘若",
	"倘使",
	"腾",
	"替",
	"通过",
	"同",
	"同时",
	"哇",
	"万一",
	"往",
	"望",
	"为",
	"为何",
	"为了",
	"为什么",
	"为着",
	"喂",
	"嗡嗡",
	"我",
	"我们",
	"呜",
	"呜呼",
	"乌乎",
	"无论",
	"无宁",
	"毋宁",
	"嘻",
	"吓",
	"相对而言",
	"像",
	"向",
	"向着",
	"嘘",
	"呀",
	"焉",
	"沿",
	"沿着",
	"要",
	"要不",
	"要不然",
	"要不是",
	"要么",
	"要是",
	"也",
	"也罢",
	"也好",
	"一",
	"一般",
	"一旦",
	"一方面",
	"一来",
	"一切",
	"一样",
	"一则",
	"依",
	"依照",
	"矣",
	"以",
	"以便",
	"以及",
	"以免",
	"以至",
	"以至于",
	"以致",
	"抑或",
	"因",
	"因此",
	"因而",
	"因为",
	"哟",
	"用",
	"由",
	"由此可见",
	"由于",
	"有",
	"有的",
	"有关",
	"有些",
	"又",
	"于",
	"于是",
	"于是乎",
	"与",
	"与此同时",
	"与否",
	"与其",
	"越是",
	"云云",
	"哉",
	"再说",
	"再者",
	"在",
	"在下",
	"咱",
	"咱们",
	"则",
	"怎",
	"怎么",
	"怎么办",
	"怎么样",
	"怎样",
	"咋",
	"照",
	"照着",
	"者",
	"这",
	"这边",
	"这儿",
	"这个",
	"这会儿",
	"这里",
	"这么",
	"这么点儿",
	"这么些",
	"这么样",
	"这时",
	"这些",
	"这样",
	"正如",
	"吱",
	"之",
	"之类",
	"之所以",
	"之一",
	"只是",
	"只限",
	"只要",
	"只有",
	"至",
	"至于",
	"诸位",
	"着",
	"着呢",
	"自",
	"自从",
	"自个儿",
	"自各儿",
	"自己",
	"自家",
	"自身",
	"综上所述",
	"总而言之",
	"总之",
	"纵",
	"纵令",
	"纵然",
	"纵使",
	"遵照",
	"作为",
	"兹",
	"咦",
	"呃",
	"好吧"
]);
var SPEECH_TAGS = {
	n: [
		"人",
		"天",
		"地",
		"国",
		"家",
		"公司",
		"学校",
		"医院",
		"银行",
		"商店"
	],
	v: [
		"是",
		"有",
		"去",
		"来",
		"说",
		"做",
		"看",
		"听",
		"想",
		"知道",
		"觉得"
	],
	a: [
		"好",
		"大",
		"小",
		"高",
		"低",
		"新",
		"旧",
		"美",
		"丑",
		"红",
		"白"
	],
	d: [
		"很",
		"非常",
		"特别",
		"比较",
		"相当",
		"十分",
		"极其",
		"最"
	],
	p: [
		"在",
		"的",
		"了",
		"着",
		"过",
		"与",
		"和",
		"对",
		"为",
		"由",
		"从"
	],
	m: [
		"一",
		"二",
		"三",
		"四",
		"五",
		"六",
		"七",
		"八",
		"九",
		"十",
		"个",
		"只",
		"张",
		"本"
	]
};
/**
* 简单中文分词器
*/
var SimpleJieba = class {
	constructor(stopWords) {
		this.stopWords = stopWords ? new Set(stopWords) : DEFAULT_STOP_WORDS;
	}
	/**
	* 基本分词 - 使用正则表达式进行简单分词
	*/
	cut(text) {
		text = text.replace(/\s+/g, " ").trim();
		const words = [];
		let i = 0;
		while (i < text.length) {
			const char = text[i];
			if (char === void 0) break;
			if (this.isChinese(char)) {
				const word = this.matchWord(text, i);
				words.push(word);
				i += word.length;
			} else if (this.isEnglish(char)) {
				const word = this.extractEnglishWord(text, i);
				words.push(word);
				i += word.length;
			} else if (this.isDigit(char)) {
				const word = this.extractNumber(text, i);
				words.push(word);
				i += word.length;
			} else if (this.isPunctuation(char)) {
				if (char.trim()) words.push(char);
				i++;
			} else i++;
		}
		return words.filter((word) => word.trim().length > 0);
	}
	/**
	* 带词性标注的分词
	*/
	tag(text) {
		return this.cut(text).map((word) => ({
			word,
			pos: this.getPartOfSpeech(word)
		}));
	}
	/**
	* 匹配词汇（优先匹配长词）
	*/
	matchWord(text, startIndex) {
		const maxLength = Math.min(4, text.length - startIndex);
		for (let len = maxLength; len >= 1; len--) {
			const word = text.substr(startIndex, len);
			if (len > 1 && this.isCommonWord(word)) return word;
		}
		const char = text[startIndex];
		if (char === void 0) throw new Error(`matchWord: startIndex ${startIndex} 越界（文本长度 ${text.length}）`);
		return char;
	}
	/**
	* 判断是否为常见词汇
	*/
	isCommonWord(word) {
		return COMMON_WORDS.has(word);
	}
	/**
	* 提取英文单词
	*/
	extractEnglishWord(text, startIndex) {
		let word = "";
		let i = startIndex;
		while (i < text.length) {
			const char = text[i];
			if (char === void 0) break;
			if (!this.isEnglish(char) && !this.isDigit(char)) break;
			word += char;
			i++;
		}
		return word;
	}
	/**
	* 提取数字
	*/
	extractNumber(text, startIndex) {
		let word = "";
		let i = startIndex;
		while (i < text.length) {
			const char = text[i];
			if (char === void 0) break;
			if (!this.isDigit(char) && char !== ".") break;
			word += char;
			i++;
		}
		return word;
	}
	/**
	* 获取词性
	*/
	getPartOfSpeech(word) {
		const firstChar = word[0];
		if (firstChar === void 0) return "n";
		if (this.isDigit(firstChar)) return "m";
		if (this.isPunctuation(firstChar)) return "w";
		if (!this.isChinese(firstChar)) return "eng";
		for (const [pos, words] of Object.entries(SPEECH_TAGS)) if (words.includes(word)) return pos;
		if (word.length === 1) {
			if ("很非常特别比较相当十分极其最".includes(firstChar)) return "d";
			if ("的了着过".includes(firstChar)) return "p";
			if ("一二三四五六七八九十".includes(firstChar)) return "m";
		}
		return "n";
	}
	/**
	* 判断是否为中文字符
	*/
	isChinese(char) {
		const code = char.charCodeAt(0);
		return code >= 19968 && code <= 40869;
	}
	/**
	* 判断是否为英文字符
	*/
	isEnglish(char) {
		const code = char.charCodeAt(0);
		return code >= 65 && code <= 90 || code >= 97 && code <= 122;
	}
	/**
	* 判断是否为数字
	*/
	isDigit(char) {
		const code = char.charCodeAt(0);
		return code >= 48 && code <= 57;
	}
	/**
	* 判断是否为标点符号
	*/
	isPunctuation(char) {
		return "。，！？；：\"\"''（）【】《》、·…—–".includes(char) || /[\p{P}]/u.test(char);
	}
	/**
	* 更新停用词
	*/
	setStopWords(stopWords) {
		this.stopWords = new Set(stopWords);
	}
	/**
	* 检查是否为停用词
	*/
	isStopWord(word) {
		return this.stopWords.has(word);
	}
};
var jieba = new SimpleJieba();
//#endregion
//#region \0@oxc-project+runtime@0.147.0/helpers/esm/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}
//#endregion
//#region \0@oxc-project+runtime@0.147.0/helpers/esm/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}
//#endregion
//#region \0@oxc-project+runtime@0.147.0/helpers/esm/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.147.0/helpers/esm/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}
//#endregion
//#region node_modules/.pnpm/typescript-result@3.5.2/node_modules/typescript-result/dist/index.js
function isPromise(value) {
	if (value === null || value === void 0) return false;
	if (typeof value !== "object") return false;
	return value instanceof Promise || "then" in value;
}
function isFunction(value) {
	return typeof value === "function";
}
function isAsyncFn(fn) {
	return fn.constructor.name === "AsyncFunction";
}
function isGenerator(obj) {
	return typeof obj === "object" && obj !== null && typeof obj.next === "function" && typeof obj.throw === "function" && typeof obj.return === "function" && typeof obj[Symbol.iterator] === "function" && obj[Symbol.iterator]() === obj;
}
function isAsyncGenerator(obj) {
	return typeof obj === "object" && obj !== null && typeof obj.next === "function" && typeof obj.throw === "function" && typeof obj.return === "function" && typeof obj[Symbol.asyncIterator] === "function" && obj[Symbol.asyncIterator]() === obj;
}
var NonExhaustiveError = class extends Error {
	constructor(error) {
		super("Not all error cases were handled");
		this.error = error;
	}
};
var Matcher = class {
	constructor(error) {
		_defineProperty(this, "cases", []);
		_defineProperty(this, "defaultHandler", void 0);
		_defineProperty(this, "else", (handler) => {
			if (this.defaultHandler) throw new Error("already registered an 'else' handler");
			this.defaultHandler = handler;
			return this;
		});
		_defineProperty(this, "run", () => {
			const isAsync = this.cases.some((item) => isAsyncFn(item.handler));
			for (const item of this.cases) if (isFunction(item.value) && this.error instanceof item.value || item.value === this.error) {
				const value = item.handler(this.error);
				return isPromise(value) ? value : isAsync ? Promise.resolve(value) : value;
			}
			if (this.defaultHandler) return this.defaultHandler(this.error);
			throw new NonExhaustiveError(this.error);
		});
		this.error = error;
	}
	when(value, ...args) {
		const cases = [value, ...args.slice(0, -1)];
		const handler = args.at(-1);
		this.cases.push(...cases.map((value2) => ({
			value: value2,
			handler
		})));
		return this;
	}
};
var AsyncResult = class _AsyncResult extends Promise {
	constructor(executor) {
		super(executor);
	}
	*[Symbol.iterator]() {
		return yield this;
	}
	get isAsyncResult() {
		return true;
	}
	async toTuple() {
		return (await this).toTuple();
	}
	async errorOrNull() {
		return (await this).errorOrNull();
	}
	async getOrNull() {
		return (await this).getOrNull();
	}
	async getOrDefault(defaultValue) {
		return (await this).getOrDefault(defaultValue);
	}
	async getOrElse(onFailure) {
		return (await this).getOrElse(onFailure);
	}
	async getOrThrow() {
		return (await this).getOrThrow();
	}
	async fold(onSuccess, onFailure) {
		return (await this).fold(onSuccess, onFailure);
	}
	onFailure(action) {
		return new _AsyncResult((resolve, reject) => this.then(async (result) => {
			try {
				if (!result.ok) await action(result.error);
				resolve(result);
			} catch (e) {
				reject(e);
			}
		}).catch(reject));
	}
	onSuccess(action) {
		return new _AsyncResult((resolve, reject) => this.then(async (result) => {
			try {
				if (result.ok) await action(result.value);
				resolve(result);
			} catch (error) {
				reject(error);
			}
		}).catch(reject));
	}
	map(transform) {
		return new _AsyncResult((resolve, reject) => {
			this.then(async (result) => resolve(await result.map(transform))).catch(reject);
		});
	}
	mapCatching(transformValue, transformError) {
		return new _AsyncResult((resolve, reject) => {
			this.map(transformValue).then((result) => resolve(result)).catch((error) => {
				try {
					resolve(ResultFactory.error(transformError ? transformError(error) : error));
				} catch (err) {
					reject(err);
				}
			});
		});
	}
	mapError(transform) {
		return new _AsyncResult((resolve, reject) => this.then(async (result) => {
			try {
				resolve(result.mapError(transform));
			} catch (error) {
				reject(error);
			}
		}).catch(reject));
	}
	recover(onFailure) {
		return new _AsyncResult((resolve, reject) => this.then(async (result) => {
			try {
				resolve(await result.recover(onFailure));
			} catch (error) {
				reject(error);
			}
		}).catch(reject));
	}
	recoverCatching(onFailure, transformError) {
		return new _AsyncResult((resolve, reject) => this.then((result) => {
			resolve(result.recoverCatching(onFailure, transformError));
		}).catch(reject));
	}
	toString() {
		return "AsyncResult";
	}
	static error(error) {
		return new _AsyncResult((resolve) => resolve(ResultFactory.error(error)));
	}
	static ok(value) {
		return new _AsyncResult((resolve) => resolve(ResultFactory.ok(value)));
	}
	static fromPromise(promise) {
		return new _AsyncResult((resolve, reject) => {
			promise.then((value) => resolve(ResultFactory.isResult(value) ? value : ResultFactory.ok(value))).catch(reject);
		});
	}
	static fromPromiseCatching(promise, transform) {
		return new _AsyncResult((resolve, reject) => {
			promise.then((value) => resolve(ResultFactory.isResult(value) ? value : ResultFactory.ok(value))).catch((caughtError) => {
				resolve(ResultFactory.error(transform?.(caughtError) ?? caughtError));
			}).catch(reject);
		});
	}
};
var Result = class {
	constructor(_value, _error) {
		this._value = _value;
		this._error = _error;
	}
	*[Symbol.iterator]() {
		return yield this;
	}
	get isResult() {
		return true;
	}
	get value() {
		return this._value;
	}
	get error() {
		return this._error;
	}
	get success() {
		return this.error === void 0;
	}
	get failure() {
		return this.error !== void 0;
	}
	get ok() {
		return this.success;
	}
	isOk() {
		return this.success;
	}
	isError() {
		return this.failure;
	}
	toTuple() {
		return [this._value ?? null, this._error ?? null];
	}
	errorOrNull() {
		return this.failure ? this._error : null;
	}
	getOrNull() {
		return this.success ? this._value : null;
	}
	getOrDefault(defaultValue) {
		return this.success ? this._value : defaultValue;
	}
	getOrElse(onFailure) {
		if (isAsyncFn(onFailure)) return this.success ? Promise.resolve(this._value) : onFailure(this._error);
		return this.success ? this._value : onFailure(this._error);
	}
	getOrThrow() {
		if (this.success) return this._value;
		throw this._error;
	}
	fold(onSuccess, onFailure) {
		const isAsync = isAsyncFn(onSuccess) || isAsyncFn(onFailure);
		const outcome = this.success ? onSuccess(this._value) : onFailure(this._error);
		return isAsync && !isPromise(outcome) ? Promise.resolve(outcome) : outcome;
	}
	match() {
		return this.failure ? new Matcher(this._error) : void 0;
	}
	onFailure(action) {
		const isAsync = isAsyncFn(action);
		if (this.failure) {
			const outcome = action(this._error);
			if (isAsync) return new AsyncResult((resolve) => {
				outcome.then(() => resolve(ResultFactory.error(this._error)));
			});
			return this;
		}
		return isAsync ? AsyncResult.ok(this._value) : this;
	}
	onSuccess(action) {
		const isAsync = isAsyncFn(action);
		if (this.success) {
			const outcome = action(this._value);
			if (isAsync) return new AsyncResult((resolve) => {
				outcome.then(() => resolve(ResultFactory.ok(this._value)));
			});
			return this;
		}
		return isAsync ? AsyncResult.error(this._error) : this;
	}
	map(transform) {
		return this.success ? ResultFactory.run(() => transform(this._value)) : isAsyncFn(transform) ? AsyncResult.error(this._error) : this;
	}
	mapCatching(transformValue, transformError) {
		return this.success ? ResultFactory.try(() => transformValue(this._value), transformError) : this;
	}
	mapError(transform) {
		if (this.success) return this;
		return ResultFactory.error(transform(this._error));
	}
	recover(onFailure) {
		return this.success ? isAsyncFn(onFailure) ? AsyncResult.ok(this._value) : this : ResultFactory.run(() => onFailure(this._error));
	}
	recoverCatching(onFailure, transformError) {
		return this.success ? isAsyncFn(onFailure) ? AsyncResult.ok(this._value) : this : ResultFactory.try(() => onFailure(this._error), transformError);
	}
	toString() {
		if (this.success) return `Result.ok(${this._value})`;
		return `Result.error(${this.error})`;
	}
};
var ResultFactory = class _ResultFactory {
	constructor() {}
	static ok(value) {
		return new Result(value, void 0);
	}
	static error(error) {
		return new Result(void 0, error);
	}
	static isResult(possibleResult) {
		return possibleResult instanceof Result;
	}
	static isAsyncResult(possibleAsyncResult) {
		return possibleAsyncResult instanceof AsyncResult;
	}
	static run(fn) {
		const returnValue = fn();
		if (isGenerator(returnValue) || isAsyncGenerator(returnValue)) return _ResultFactory.handleGenerator(returnValue);
		if (isPromise(returnValue)) return AsyncResult.fromPromise(returnValue);
		return _ResultFactory.isResult(returnValue) ? returnValue : _ResultFactory.ok(returnValue);
	}
	static allInternal(items, opts) {
		const runner = opts.catching ? _ResultFactory.try : _ResultFactory.run;
		const flattened = [];
		let isAsync = items.some(isPromise);
		let hasFailure = false;
		for (const item of items) if (isFunction(item)) {
			if (hasFailure) continue;
			const returnValue = runner(item);
			if (_ResultFactory.isResult(returnValue) && !returnValue.ok) {
				hasFailure = true;
				if (!isAsync) return returnValue;
			}
			if (_ResultFactory.isAsyncResult(returnValue)) isAsync = true;
			flattened.push(returnValue);
		} else if (_ResultFactory.isResult(item)) {
			if (!item.ok) {
				hasFailure = true;
				if (!isAsync) return item;
			}
			flattened.push(item);
		} else if (_ResultFactory.isAsyncResult(item)) {
			isAsync = true;
			flattened.push(item);
		} else if (isPromise(item)) {
			isAsync = true;
			flattened.push(opts.catching ? AsyncResult.fromPromiseCatching(item) : AsyncResult.fromPromise(item));
		} else flattened.push(_ResultFactory.ok(item));
		if (isAsync) return new AsyncResult((resolve, reject) => {
			const asyncResults = [];
			const asyncIndexes = [];
			for (let i = 0; i < flattened.length; i++) {
				const item = flattened[i];
				if (_ResultFactory.isAsyncResult(item)) {
					asyncResults.push(item);
					asyncIndexes.push(i);
				}
			}
			Promise.all(asyncResults).then((resolvedResults) => {
				const merged = [...flattened];
				for (let i = 0; i < resolvedResults.length; i++) merged[asyncIndexes[i]] = resolvedResults[i];
				const firstFailedResult = merged.find((resolvedResult) => !resolvedResult.ok);
				if (firstFailedResult) {
					resolve(firstFailedResult);
					return;
				}
				resolve(_ResultFactory.ok(merged.map((result) => result.getOrNull())));
			}).catch((reason) => {
				reject(reason);
			});
		});
		return _ResultFactory.ok(flattened.map((result) => result.getOrNull()));
	}
	static all(...items) {
		return _ResultFactory.allInternal(items, { catching: false });
	}
	static allCatching(...items) {
		return _ResultFactory.allInternal(items, { catching: true });
	}
	static wrap(fn, transformError) {
		return function wrapped(...args) {
			return _ResultFactory.try(() => fn(...args), transformError);
		};
	}
	static try(fn, transform) {
		try {
			const returnValue = fn();
			if (isGenerator(returnValue)) return _ResultFactory.handleGenerator(returnValue);
			if (isAsyncGenerator(returnValue)) {
				const asyncResult = _ResultFactory.handleGenerator(returnValue);
				return AsyncResult.fromPromiseCatching(asyncResult, transform);
			}
			if (isPromise(returnValue)) return AsyncResult.fromPromiseCatching(returnValue, transform);
			return _ResultFactory.isResult(returnValue) ? returnValue : _ResultFactory.ok(returnValue);
		} catch (caughtError) {
			return _ResultFactory.error(transform?.(caughtError) ?? caughtError);
		}
	}
	static fromAsync(valueOrFn) {
		return _ResultFactory.run(typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn);
	}
	static fromAsyncCatching(valueOrFn, transformError) {
		return _ResultFactory.try(typeof valueOrFn === "function" ? valueOrFn : () => valueOrFn, transformError);
	}
	static handleGenerator(it) {
		function handleResult(result2) {
			if (!result2.ok) return iterate(it.return(result2));
			return iterate(it.next(result2.value));
		}
		function handleStep(step) {
			if (step.done) {
				if (step.value instanceof Result || step.value instanceof AsyncResult) return step.value;
				return _ResultFactory.ok(step.value);
			}
			if (step.value instanceof Result) return handleResult(step.value);
			if (step.value instanceof AsyncResult) return step.value.then(handleResult);
			return iterate(it.next(step.value));
		}
		function iterate(iteratorResult) {
			return isPromise(iteratorResult) ? iteratorResult.then(handleStep) : handleStep(iteratorResult);
		}
		const result = iterate(it.next());
		return isPromise(result) ? AsyncResult.fromPromise(result) : result;
	}
	static gen(generatorOrSelfOrFn, fn) {
		const it = isGenerator(generatorOrSelfOrFn) || isAsyncGenerator(generatorOrSelfOrFn) ? generatorOrSelfOrFn : typeof generatorOrSelfOrFn === "function" ? generatorOrSelfOrFn() : fn?.apply(generatorOrSelfOrFn);
		return _ResultFactory.handleGenerator(it);
	}
	static genCatching(generatorOrSelfOrFn, transformValueOrError, transformError) {
		const isGen = isGenerator(generatorOrSelfOrFn) || isAsyncGenerator(generatorOrSelfOrFn);
		const self = typeof generatorOrSelfOrFn === "function" || isGen ? void 0 : generatorOrSelfOrFn;
		const tValue = typeof generatorOrSelfOrFn === "function" ? generatorOrSelfOrFn : transformValueOrError;
		const tError = typeof generatorOrSelfOrFn === "function" || isGen ? transformValueOrError : transformError;
		try {
			const it = isGen ? generatorOrSelfOrFn : self ? tValue.apply(generatorOrSelfOrFn) : tValue();
			const result = _ResultFactory.handleGenerator(it);
			if (_ResultFactory.isAsyncResult(result)) return result.catch((error) => AsyncResult.error(tError?.(error) ?? error));
			return result;
		} catch (error) {
			return _ResultFactory.error(tError?.(error) ?? error);
		}
	}
	static assertOk(result) {
		if (!result.ok) throw new Error("Expected a successful result, but got an error instead");
	}
	static assertError(result) {
		if (result.ok) throw new Error("Expected a failed result, but got a value instead");
	}
	static [Symbol.hasInstance](instance) {
		return instance instanceof Result;
	}
};
var Result2 = ResultFactory;
//#endregion
//#region src/utils/result-helpers.ts
/**
* Result 辅助工具函数
* 提供统一的错误处理和 Result 操作方法
*/
/**
* 创建 TextRankError
*/
function createError(type, message, cause, context) {
	const error = {
		type,
		message
	};
	if (cause !== void 0) error.cause = cause;
	if (context !== void 0) error.context = context;
	return error;
}
/**
* 创建成功的 Result
*/
function ok(value) {
	return Result2.ok(value);
}
/**
* 创建失败的 Result
*/
function err(error) {
	return Result2.error(error);
}
/**
* 创建失败的 Result （简化版）
*/
function errOf(type, message, cause, context) {
	return Result2.error(createError(type, message, cause, context));
}
/**
* 安全执行同步函数，返回 Result
*/
function safeSync(fn, errorType = ErrorType.COMPUTATION_ERROR, context) {
	try {
		const result = fn();
		return Result2.ok(result);
	} catch (error) {
		return Result2.error(createError(errorType, error instanceof Error ? error.message : String(error), error instanceof Error ? error : void 0, context));
	}
}
/**
* 安全执行异步函数，返回 AsyncResult
*/
async function safeAsync(fn, errorType = ErrorType.COMPUTATION_ERROR, context) {
	try {
		const result = await fn();
		return Result2.ok(result);
	} catch (error) {
		return Result2.error(createError(errorType, error instanceof Error ? error.message : String(error), error instanceof Error ? error : void 0, context));
	}
}
/**
* 将普通的 Promise 转换为 AsyncResult
*/
async function fromPromise(promise, errorType = ErrorType.COMPUTATION_ERROR, context) {
	try {
		const result = await promise;
		return Result2.ok(result);
	} catch (error) {
		return Result2.error(createError(errorType, error instanceof Error ? error.message : String(error), error instanceof Error ? error : void 0, context));
	}
}
/**
* 检查输入参数的有效性
*/
function validateInput(text, minLength = 1) {
	if (!text || typeof text !== "string") return errOf(ErrorType.VALIDATION_ERROR, "文本内容不能为空且必须为字符串类型", void 0, {
		text,
		type: typeof text
	});
	if (text.trim().length < minLength) return errOf(ErrorType.VALIDATION_ERROR, `文本长度不能少于 ${minLength} 个字符`, void 0, {
		text: text.trim(),
		length: text.trim().length,
		minLength
	});
	return Result2.ok(text.trim());
}
/**
* 组合多个 Result，全部成功才返回成功
*/
function combineResults(results) {
	const values = [];
	for (const result of results) {
		if (result.isError()) return result;
		values.push(result.value);
	}
	return Result2.ok(values);
}
/**
* 映射 Result 的值
*/
function mapResult(result, mapper) {
	return result.map(mapper);
}
/**
* 链式处理 Result
*/
function chainResult(result, chainer) {
	if (result.isOk()) return chainer(result.value);
	else return result;
}
/**
* 提供默认值处理失败的 Result
*/
function withDefault(result, defaultValue) {
	return result.getOrDefault(defaultValue);
}
/**
* 记录错误日志
*/
function logError(error, prefix = "TextRank") {
	console.error(`[${prefix}] ${error.type}:`, error.message);
	if (error.cause) console.error("原因:", error.cause);
	if (error.context) console.error("上下文:", error.context);
}
/**
* 处理 Result，成功时执行 onOk，失败时执行 onErr
*/
function handleResult(result, onOk, onErr) {
	if (result.isOk()) return onOk(result.value);
	else return onErr(result.error);
}
/**
* 超时处理包装器
*/
async function withTimeout(promise, timeoutMs, context) {
	const timeoutPromise = new Promise((_, reject) => {
		setTimeout(() => {
			reject(createError(ErrorType.TIMEOUT_ERROR, `操作超时（${timeoutMs}ms）`, void 0, {
				timeout: timeoutMs,
				...context
			}));
		}, timeoutMs);
	});
	try {
		const result = await Promise.race([promise, timeoutPromise]);
		return Result2.ok(result);
	} catch (error) {
		if (error instanceof Error && error.message.includes("操作超时")) return Result2.error(error);
		return Result2.error(createError(ErrorType.COMPUTATION_ERROR, error instanceof Error ? error.message : String(error), error instanceof Error ? error : void 0, context));
	}
}
//#endregion
//#region src/core/segmentation.ts
/**
* 中文分词类
*/
var WordSegmentation = class {
	constructor(config = {}) {
		const { stopWords, allowSpeechTags = DEFAULT_CONFIG.ALLOW_SPEECH_TAGS } = config;
		this.allowSpeechTags = new Set(allowSpeechTags);
		this.stopWords = this.loadStopWords(stopWords);
		if (!this.initJieba().ok) debug("分词器初始化失败，已使用fallback分词器");
	}
	/**
	* 初始化分词器
	*/
	initJieba() {
		if (!safeSync(() => {
			this.jieba = jieba;
			debug("使用内置轻量级分词器");
		}, ErrorType.INITIALIZATION_ERROR, { component: "jieba" }).ok) {
			debug("分词器初始化失败，使用 fallback 分词器");
			this.jieba = this.createFallbackSegmenter();
		}
		return Result2.ok(void 0);
	}
	/**
	* 创建fallback分词器
	*/
	createFallbackSegmenter() {
		return {
			cut: (text) => {
				return text.split("").filter((char) => char.trim().length > 0);
			},
			tag: (text) => {
				return text.split("").filter((char) => char.trim().length > 0).map((word) => ({
					word,
					pos: "n"
				}));
			}
		};
	}
	/**
	* 加载停用词
	*/
	loadStopWords(customStopWords) {
		if (customStopWords && customStopWords.length > 0) return new Set(customStopWords);
		return new Set(STOP_WORDS);
	}
	/**
	* 对文本进行分词
	*/
	segment(text, options = {}) {
		const { lower = false, useStopWords = true, useSpeechTagsFilter = false } = options;
		if (!this.jieba) this.jieba = this.createFallbackSegmenter();
		let result;
		if (useSpeechTagsFilter) {
			result = this.jieba.tag(text).map((item) => ({
				word: item.word,
				pos: item.pos || item.tag || "n"
			}));
			result = result.filter((item) => this.allowSpeechTags.has(item.pos));
		} else result = this.jieba.cut(text).map((word) => ({
			word,
			pos: ""
		}));
		let wordList = result.map((item) => item.word.trim()).filter((word) => word.length > 0 && !/^[\s\p{P}]+$/u.test(word));
		if (lower) wordList = wordList.map((word) => word.toLowerCase());
		if (useStopWords) wordList = wordList.filter((word) => !this.stopWords.has(word));
		return wordList;
	}
	/**
	* 对句子列表进行分词
	*/
	segmentSentences(sentences, options = {}) {
		return sentences.map((sentence) => this.segment(sentence, options));
	}
};
/**
* 句子分割类
*/
var SentenceSegmentation = class {
	constructor(delimiters = DEFAULT_CONFIG.SENTENCE_DELIMITERS) {
		this.delimiters = new Set(delimiters);
	}
	/**
	* 将文本分割为句子
	*/
	segment(text) {
		let sentences = [text];
		for (const delimiter of this.delimiters) {
			const newSentences = [];
			for (const sentence of sentences) newSentences.push(...sentence.split(delimiter));
			sentences = newSentences;
		}
		return sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
	}
};
/**
* 统一的文本分割类
*/
var Segmentation = class {
	constructor(config = {}) {
		this.wordSegmentation = new WordSegmentation(config);
		this.sentenceSegmentation = new SentenceSegmentation(config.delimiters);
	}
	/**
	* 对文本进行完整的分词分句处理
	*/
	segment(text, options = {}) {
		const { lower = false } = options;
		const sentences = this.sentenceSegmentation.segment(text);
		debug("分句结果:", sentences);
		const wordsNoFilter = this.wordSegmentation.segmentSentences(sentences, {
			lower,
			useStopWords: false,
			useSpeechTagsFilter: false
		});
		const wordsNoStopWords = this.wordSegmentation.segmentSentences(sentences, {
			lower,
			useStopWords: true,
			useSpeechTagsFilter: false
		});
		const wordsAllFilters = this.wordSegmentation.segmentSentences(sentences, {
			lower,
			useStopWords: true,
			useSpeechTagsFilter: true
		});
		debug("分词结果 - wordsNoFilter:", wordsNoFilter);
		debug("分词结果 - wordsNoStopWords:", wordsNoStopWords);
		debug("分词结果 - wordsAllFilters:", wordsAllFilters);
		return {
			sentences,
			wordsNoFilter,
			wordsNoStopWords,
			wordsAllFilters
		};
	}
};
//#endregion
//#region src/utils/main-thread-scheduler.ts
/**
* 主线程任务调度器
*/
var MainThreadScheduler = class {
	constructor() {
		this.runningTasks = /* @__PURE__ */ new Map();
		this.taskQueue = [];
		this.capabilities = this.detectCapabilities();
		this.logCapabilities();
	}
	/**
	* 检测浏览器调度 API 支持能力
	*/
	detectCapabilities() {
		const capabilities = {
			requestIdleCallback: false,
			scheduler: false,
			messageChannel: false,
			postTaskScheduler: false
		};
		const detectionResult = safeSync(() => {
			capabilities.requestIdleCallback = typeof window !== "undefined" && typeof window.requestIdleCallback === "function";
			capabilities.scheduler = typeof window !== "undefined" && "scheduler" in window && typeof window.scheduler?.postTask === "function";
			capabilities.messageChannel = typeof MessageChannel !== "undefined";
			capabilities.postTaskScheduler = typeof window !== "undefined" && "scheduler" in window && typeof window.scheduler?.postTask === "function";
			return capabilities;
		}, ErrorType.UNSUPPORTED_ERROR, { feature: "scheduler-detection" });
		if (detectionResult && detectionResult.isError()) console.warn("TextRank4ZH-TS: 调度能力检测失败", detectionResult.error.message);
		else if (detectionResult && detectionResult.value) Object.assign(capabilities, detectionResult.value);
		return capabilities;
	}
	/**
	* 记录支持能力
	*/
	logCapabilities() {
		if (typeof console !== "undefined" && console.debug) console.debug("TextRank4ZH-TS 主线程调度能力:", {
			requestIdleCallback: this.capabilities.requestIdleCallback ? "✅ 支持" : "❌ 不支持",
			scheduler: this.capabilities.scheduler ? "✅ 支持" : "❌ 不支持",
			messageChannel: this.capabilities.messageChannel ? "✅ 支持" : "❌ 不支持",
			postTaskScheduler: this.capabilities.postTaskScheduler ? "✅ 支持" : "❌ 不支持"
		});
	}
	/**
	* 获取推荐的调度方式
	*/
	getRecommendedSchedulingMethod() {
		if (this.capabilities.requestIdleCallback || this.capabilities.postTaskScheduler) return "background-task";
		if (this.capabilities.messageChannel || typeof Promise !== "undefined") return "promise";
		return "sync";
	}
	/**
	* 调度执行任务（智能选择调度方式）
	*/
	async scheduleTask(taskFn, options = {}) {
		const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		const schedulingMethod = this.getRecommendedSchedulingMethod();
		const task = {
			id: taskId,
			execute: taskFn,
			...options.priority === "user-blocking" ? {} : { onProgress: () => {} }
		};
		const executeResult = await safeAsync(async () => {
			switch (schedulingMethod) {
				case "background-task": return await this.executeWithBackgroundTask(task, options);
				case "promise": return await this.executeWithPromise(task, options);
				default: return await this.executeSync(task);
			}
		}, ErrorType.COMPUTATION_ERROR, {
			taskId,
			schedulingMethod
		});
		if (executeResult.isError()) {
			console.warn(`TextRank4ZH-TS: ${schedulingMethod} 调度失败，降级执行:`, executeResult.error.message);
			if (schedulingMethod === "background-task") {
				const promiseResult = await safeAsync(() => this.executeWithPromise(task, options), ErrorType.COMPUTATION_ERROR, {
					taskId,
					fallback: "promise"
				});
				if (!promiseResult.ok) return await safeAsync(() => this.executeSync(task), ErrorType.COMPUTATION_ERROR, {
					taskId,
					fallback: "sync"
				});
				return promiseResult;
			} else if (schedulingMethod === "promise") return await safeAsync(() => this.executeSync(task), ErrorType.COMPUTATION_ERROR, {
				taskId,
				fallback: "sync"
			});
			return executeResult;
		}
		return executeResult;
	}
	/**
	* 使用后台任务 API 执行（最优选择）
	*/
	async executeWithBackgroundTask(task, options) {
		const { maxContinuousTime = 16, idleTimeout = 50 } = options;
		return new Promise((resolve, reject) => {
			const abortController = new AbortController();
			this.runningTasks.set(task.id, abortController);
			const executeWithIdleCallback = () => {
				if (abortController.signal.aborted) {
					reject(/* @__PURE__ */ new Error("Task aborted"));
					return;
				}
				if (this.capabilities.requestIdleCallback) window.requestIdleCallback((deadline) => {
					const executeResult = safeSync(() => {
						const startTime = performance.now();
						const executeInIdleTime = () => {
							if (abortController.signal.aborted) throw new Error("Task aborted");
							const elapsed = performance.now() - startTime;
							if (deadline.timeRemaining() > 0 && elapsed < maxContinuousTime) {
								const result = task.execute();
								if (result instanceof Promise) result.then(resolve).catch(reject);
								else resolve(result);
							} else executeWithIdleCallback();
						};
						executeInIdleTime();
					}, ErrorType.COMPUTATION_ERROR, {
						taskId: task.id,
						method: "requestIdleCallback"
					});
					if (executeResult.isError()) reject(new Error(executeResult.error.message));
				}, { timeout: idleTimeout });
				else if (this.capabilities.postTaskScheduler) {
					const scheduler = window.scheduler;
					const priority = options.priority === "user-blocking" ? "user-blocking" : options.priority === "normal" ? "user-visible" : "background";
					const taskResult = safeSync(() => {
						return scheduler.postTask(() => {
							if (abortController.signal.aborted) throw new Error("Task aborted");
							const result = task.execute();
							if (result instanceof Promise) result.then(resolve).catch(reject);
							else resolve(result);
						}, {
							priority,
							signal: abortController.signal
						});
					}, ErrorType.COMPUTATION_ERROR, {
						taskId: task.id,
						method: "postTask"
					});
					if (taskResult.isError()) reject(new Error(taskResult.error.message));
					else taskResult.value.catch(reject);
				} else {
					const fallbackResult = safeSync(() => {
						const result = task.execute();
						if (result instanceof Promise) result.then(resolve).catch(reject);
						else resolve(result);
					}, ErrorType.COMPUTATION_ERROR, {
						taskId: task.id,
						method: "sync-fallback"
					});
					if (fallbackResult.isError()) reject(new Error(fallbackResult.error.message));
				}
			};
			executeWithIdleCallback();
		}).finally(() => {
			this.runningTasks.delete(task.id);
		});
	}
	/**
	* 使用 Promise 微任务执行（降级选择）
	*/
	async executeWithPromise(task, options) {
		const { timeSlice = 5 } = options;
		return new Promise((resolve, reject) => {
			const abortController = new AbortController();
			this.runningTasks.set(task.id, abortController);
			const executeWithYielding = async () => {
				const executeResult = await safeAsync(async () => {
					if (abortController.signal.aborted) throw new Error("Task aborted");
					const yieldControl = () => {
						return new Promise((yieldResolve) => {
							if (this.capabilities.messageChannel) {
								const channel = new MessageChannel();
								channel.port1.onmessage = () => yieldResolve();
								channel.port2.postMessage(null);
							} else setTimeout(yieldResolve, 0);
						});
					};
					const startTime = performance.now();
					const executeChunk = async () => {
						const result = task.execute();
						if (result instanceof Promise) return await result;
						return result;
					};
					const result = await executeChunk();
					if (performance.now() - startTime > timeSlice) await yieldControl();
					return result;
				}, ErrorType.COMPUTATION_ERROR, {
					taskId: task.id,
					method: "promise"
				});
				if (executeResult.isError()) reject(new Error(executeResult.error.message));
				else resolve(executeResult.value);
			};
			executeWithYielding();
		}).finally(() => {
			this.runningTasks.delete(task.id);
		});
	}
	/**
	* 同步执行（最后降级选择）
	*/
	async executeSync(task) {
		const executeResult = await safeAsync(async () => {
			const result = task.execute();
			if (result instanceof Promise) return await result;
			return result;
		}, ErrorType.COMPUTATION_ERROR, {
			taskId: task.id,
			method: "sync"
		});
		if (executeResult.isError()) throw new Error(executeResult.error.message);
		return executeResult.value;
	}
	/**
	* 批量调度执行任务
	*/
	async scheduleBatch(tasks, options = {}) {
		const { priority = "background" } = options;
		return await safeAsync(async () => {
			if (priority === "user-blocking") {
				const taskResults = await Promise.all(tasks.map((task) => this.scheduleTask(task, options)));
				const values = [];
				for (const result of taskResults) {
					if (!result.ok) throw new Error(`任务执行失败: ${result.error.message}`);
					values.push(result.value);
				}
				return values;
			} else {
				const results = [];
				for (const task of tasks) {
					const result = await this.scheduleTask(task, options);
					if (!result.ok) throw new Error(`任务执行失败: ${result.error.message}`);
					results.push(result.value);
				}
				return results;
			}
		}, ErrorType.COMPUTATION_ERROR, {
			batchSize: tasks.length,
			priority
		});
	}
	/**
	* 取消任务
	*/
	cancelTask(taskId) {
		const controller = this.runningTasks.get(taskId);
		if (controller) {
			controller.abort();
			this.runningTasks.delete(taskId);
			return true;
		}
		return false;
	}
	/**
	* 取消所有任务
	*/
	cancelAllTasks() {
		this.runningTasks.forEach((controller) => controller.abort());
		this.runningTasks.clear();
		this.taskQueue = [];
	}
	/**
	* 获取调度器状态
	*/
	getStatus() {
		return {
			runningTasks: this.runningTasks.size,
			queuedTasks: this.taskQueue.length,
			capabilities: this.capabilities,
			recommendedMethod: this.getRecommendedSchedulingMethod()
		};
	}
	/**
	* 检测当前主线程繁忙程度
	*/
	async measureMainThreadBusyness() {
		return await safeAsync(async () => {
			return new Promise((resolve) => {
				const measurements = [];
				let measurementCount = 0;
				const maxMeasurements = 10;
				const measure = () => {
					const start = performance.now();
					if (this.capabilities.requestIdleCallback) window.requestIdleCallback(() => {
						const frameTime = performance.now() - start;
						measurements.push(frameTime);
						measurementCount++;
						if (measurementCount < maxMeasurements) measure();
						else {
							const averageFrameTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
							const isBlocked = averageFrameTime > 16.67;
							let recommendation;
							if (averageFrameTime < 8) recommendation = "aggressive";
							else if (averageFrameTime < 16.67) recommendation = "moderate";
							else recommendation = "conservative";
							resolve({
								averageFrameTime,
								isBlocked,
								recommendation
							});
						}
					});
					else setTimeout(() => {
						const frameTime = performance.now() - start;
						measurements.push(frameTime);
						measurementCount++;
						if (measurementCount < maxMeasurements) measure();
						else {
							const averageFrameTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
							resolve({
								averageFrameTime,
								isBlocked: averageFrameTime > 20,
								recommendation: averageFrameTime < 10 ? "aggressive" : averageFrameTime < 20 ? "moderate" : "conservative"
							});
						}
					}, 0);
				};
				measure();
			});
		}, ErrorType.COMPUTATION_ERROR, { feature: "busyness-measurement" });
	}
};
/**
* 单例调度器实例
*/
var mainThreadScheduler = new MainThreadScheduler();
//#endregion
//#region src/utils/async-analysis.ts
/**
* 异步分析辅助工具
* 基于主线程调度器提供非阻塞的文本分析能力
*/
/**
* 异步执行工厂
*/
var AsyncAnalysisExecutor = class {
	/**
	* 创建进度报告函数
	*/
	static createProgressReporter(onProgress) {
		if (!onProgress) return () => {};
		return (phase, progress, message, details) => {
			const progressInfo = {
				phase,
				progress: Math.min(100, {
					segmentation: 0,
					graph_building: 25,
					pagerank: 60,
					sorting: 95,
					complete: 100
				}[phase] + progress * {
					segmentation: .25,
					graph_building: .35,
					pagerank: .35,
					sorting: .05,
					complete: 0
				}[phase]),
				message
			};
			if (details !== void 0) progressInfo.details = details;
			onProgress(progressInfo);
		};
	}
	/**
	* 异步执行分词分析
	*/
	static async executeSegmentation(segmentationFn, config, reportProgress) {
		const { timeSlice = 5, maxContinuousTime = 16, yieldInterval = 100, priority = "background" } = config;
		reportProgress("segmentation", 0, "开始文本分词...");
		return await mainThreadScheduler.scheduleTask(() => {
			reportProgress("segmentation", 50, "执行分词处理...");
			const segmentationResult = segmentationFn();
			reportProgress("segmentation", 100, "分词完成");
			return segmentationResult;
		}, {
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
	}
	/**
	* 异步执行图构建
	*/
	static async executeGraphBuilding(graphBuildingFn, config, reportProgress, itemCount) {
		const { timeSlice = 5, maxContinuousTime = 16, yieldInterval = 100, priority = "background" } = config;
		reportProgress("graph_building", 0, "构建关系图...", itemCount === void 0 ? void 0 : { totalItems: itemCount });
		if (itemCount && itemCount > 1e3) return await mainThreadScheduler.scheduleTask(async () => {
			let processedItems = 0;
			const chunkSize = Math.max(100, Math.floor(itemCount / 10));
			const executeChunk = () => {
				const startTime = performance.now();
				let localProcessed = 0;
				while (localProcessed < chunkSize && processedItems < itemCount) {
					processedItems++;
					localProcessed++;
					if (performance.now() - startTime > timeSlice) break;
				}
				reportProgress("graph_building", processedItems / itemCount * 100, `构建关系图... (${processedItems}/${itemCount})`, {
					processedItems,
					totalItems: itemCount
				});
				return processedItems >= itemCount;
			};
			while (processedItems < itemCount) if (!executeChunk() && performance.now() % 16 < timeSlice) await new Promise((resolve) => setTimeout(resolve, 0));
			reportProgress("graph_building", 100, "关系图构建完成");
			return graphBuildingFn();
		}, {
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
		return await mainThreadScheduler.scheduleTask(() => {
			reportProgress("graph_building", 50, "构建关系图...");
			const result = graphBuildingFn();
			reportProgress("graph_building", 100, "关系图构建完成");
			return result;
		}, {
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
	}
	/**
	* 异步执行PageRank算法
	*/
	static async executePageRank(pageRankFn, config, reportProgress, maxIterations = 100) {
		const { timeSlice = 5, maxContinuousTime = 16, yieldInterval = 50, priority = "background" } = config;
		reportProgress("pagerank", 0, "PageRank算法开始...", { maxIterations });
		return await mainThreadScheduler.scheduleTask(async () => {
			let currentIteration = 0;
			const iterationProgressCallback = (iteration, max) => {
				currentIteration = iteration;
				reportProgress("pagerank", iteration / max * 100, `PageRank迭代中... (${iteration}/${max})`, {
					iterations: iteration,
					maxIterations: max
				});
			};
			if (maxIterations > 50) {
				let result;
				const executePageRankChunked = async () => {
					return new Promise((resolve, reject) => {
						const processChunk = async () => {
							try {
								const startTime = performance.now();
								result = pageRankFn(iterationProgressCallback);
								if (performance.now() - startTime > maxContinuousTime && currentIteration < maxIterations) setTimeout(processChunk, 0);
								else resolve(result);
							} catch (error) {
								reject(error);
							}
						};
						processChunk();
					});
				};
				result = await executePageRankChunked();
				reportProgress("pagerank", 100, "PageRank算法完成");
				return result;
			}
			const result = pageRankFn(iterationProgressCallback);
			reportProgress("pagerank", 100, "PageRank算法完成");
			return result;
		}, {
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
	}
	/**
	* 异步执行结果排序
	*/
	static async executeSorting(sortingFn, config, reportProgress) {
		const { timeSlice = 5, maxContinuousTime = 16, yieldInterval = 100, priority = "background" } = config;
		reportProgress("sorting", 0, "结果排序中...");
		return await mainThreadScheduler.scheduleTask(() => {
			reportProgress("sorting", 50, "执行排序...");
			const sortedResult = sortingFn();
			reportProgress("sorting", 100, "排序完成");
			return sortedResult;
		}, {
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
	}
	/**
	* 完整的异步分析流程
	*/
	static async executeFullAnalysis(phases, config, options) {
		const reportProgress = this.createProgressReporter(config.onProgress);
		try {
			const segmentationResult = await this.executeSegmentation(phases.segmentation, config, reportProgress);
			if (!segmentationResult.ok) return segmentationResult;
			const graphResult = await this.executeGraphBuilding(phases.graphBuilding, config, reportProgress, options?.itemCount);
			if (!graphResult.ok) return graphResult;
			const pageRankResult = await this.executePageRank(phases.pageRank, config, reportProgress, options?.maxIterations);
			if (!pageRankResult.ok) return pageRankResult;
			const sortingResult = await this.executeSorting(phases.sorting, config, reportProgress);
			if (!sortingResult.ok) return sortingResult;
			reportProgress("complete", 100, "分析完成");
			return sortingResult;
		} catch (error) {
			return errOf(ErrorType.COMPUTATION_ERROR, `异步分析失败: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : void 0, {
				config,
				options
			});
		}
	}
	/**
	* 获取默认的异步配置
	*/
	static getDefaultAsyncConfig(overrides = {}) {
		return {
			timeSlice: 5,
			maxContinuousTime: 16,
			yieldInterval: 100,
			priority: "background",
			...overrides
		};
	}
};
//#endregion
//#region src/core/textrank-keyword.ts
/**
* TextRank 关键词提取类
*/
var TextRankKeyword = class {
	constructor(config = {}) {
		this.text = "";
		this.keywords = [];
		this.segmentationResult = null;
		this.segmentation = new Segmentation(config);
	}
	/**
	* 分析文本，提取关键词（同步版本）
	*/
	analyze(text, config = {}) {
		const { window = 2, lower = false, vertexSource = "all_filters", edgeSource = "no_stop_words", pageRankConfig = {} } = config;
		this.text = text;
		this.keywords = [];
		return safeSync(() => {
			this.segmentationResult = this.segmentation.segment(this.text, { lower });
			debug("=".repeat(40));
			debug("TextRankKeyword 分析结果:");
			debug("sentences:", this.segmentationResult.sentences.join(" || "));
			debug("wordsNoFilter:", this.segmentationResult.wordsNoFilter);
			debug("wordsNoStopWords:", this.segmentationResult.wordsNoStopWords);
			debug("wordsAllFilters:", this.segmentationResult.wordsAllFilters);
			const analysisResult = this.performTextRankAnalysis(window, vertexSource, edgeSource, pageRankConfig);
			if (analysisResult.isError()) throw new Error(analysisResult.error.message);
		}, ErrorType.COMPUTATION_ERROR, {
			text: this.text.substring(0, 100),
			config,
			phase: "text_analysis"
		});
	}
	/**
	* 异步分析文本，提取关键词（推荐用于大文本）
	* 使用主线程调度器避免阻塞UI，支持进度回调
	*/
	async analyzeAsync(text, config = {}) {
		const validationResult = validateInput(text);
		if (validationResult.isError()) {
			const error = validationResult.error;
			return Result2.error({
				...error,
				context: {
					...error.context,
					config
				}
			});
		}
		const { window = 2, lower = false, vertexSource = "all_filters", edgeSource = "no_stop_words", pageRankConfig = {}, onProgress, timeSlice = 5, maxContinuousTime = 16, yieldInterval = 100, priority = "background" } = config;
		this.text = validationResult.value;
		this.keywords = [];
		const asyncConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig({
			onProgress,
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
		return await AsyncAnalysisExecutor.executeFullAnalysis({
			segmentation: () => {
				this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });
				debug("=".repeat(40));
				debug("TextRankKeyword 异步分析结果:");
				debug("sentences:", this.segmentationResult.sentences.join(" || "));
				debug("wordsNoFilter:", this.segmentationResult.wordsNoFilter);
				debug("wordsNoStopWords:", this.segmentationResult.wordsNoStopWords);
				debug("wordsAllFilters:", this.segmentationResult.wordsAllFilters);
				return this.segmentationResult;
			},
			graphBuilding: () => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const vertexWordsResult = this.getWordSource(vertexSource);
				const edgeWordsResult = this.getWordSource(edgeSource);
				if (vertexWordsResult.isError()) throw new Error(`获取vertex词源失败: ${vertexWordsResult.error.message}`);
				if (edgeWordsResult.isError()) throw new Error(`获取edge词源失败: ${edgeWordsResult.error.message}`);
				return {
					vertexWords: vertexWordsResult.value,
					edgeWords: edgeWordsResult.value
				};
			},
			pageRank: (progressCallback) => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const vertexWordsResult = this.getWordSource(vertexSource);
				const edgeWordsResult = this.getWordSource(edgeSource);
				if (!vertexWordsResult.ok || !edgeWordsResult.ok) throw new Error("获取词源失败");
				const sortWordsWithProgress = (vertexWords, edgeWords, windowSize, prConfig) => {
					const result = sortWords(vertexWords, edgeWords, windowSize, prConfig);
					if (progressCallback) {
						const maxIterations = prConfig.maxIterations || 100;
						for (let i = 0; i <= maxIterations; i += 10) progressCallback(Math.min(i, maxIterations), maxIterations);
					}
					return result;
				};
				return sortWordsWithProgress(vertexWordsResult.value, edgeWordsResult.value, window, pageRankConfig);
			},
			sorting: () => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const vertexWordsResult = this.getWordSource(vertexSource);
				const edgeWordsResult = this.getWordSource(edgeSource);
				if (!vertexWordsResult.ok || !edgeWordsResult.ok) throw new Error("获取词源失败");
				this.keywords = sortWords(vertexWordsResult.value, edgeWordsResult.value, window, pageRankConfig);
				debug("异步分析完成，关键词数量:", this.keywords.length);
			}
		}, asyncConfig, {
			itemCount: this.segmentationResult?.sentences.length || 0,
			maxIterations: pageRankConfig.maxIterations || 100
		});
	}
	/**
	* 执行 TextRank 算法分析
	*/
	performTextRankAnalysis(window, vertexSource, edgeSource, pageRankConfig) {
		const vertexWordsResult = this.getWordSource(vertexSource);
		if (vertexWordsResult.isError()) return errOf(ErrorType.COMPUTATION_ERROR, `获取 vertex 词源失败: ${vertexWordsResult.error.message}`);
		const edgeWordsResult = this.getWordSource(edgeSource);
		if (edgeWordsResult.isError()) return errOf(ErrorType.COMPUTATION_ERROR, `获取 edge 词源失败: ${edgeWordsResult.error.message}`);
		return safeSync(() => {
			this.keywords = sortWords(vertexWordsResult.value, edgeWordsResult.value, window, pageRankConfig);
		}, ErrorType.COMPUTATION_ERROR, {
			vertexSource,
			edgeSource,
			window
		});
	}
	/**
	* 根据源类型获取对应的词列表
	*/
	getWordSource(source) {
		if (!this.segmentationResult) return errOf(ErrorType.VALIDATION_ERROR, "请先调用 analyze 方法", void 0, { source });
		const segmentationResult = this.segmentationResult;
		return Result2.ok((() => {
			switch (source) {
				case "no_filter": return segmentationResult.wordsNoFilter;
				case "no_stop_words": return segmentationResult.wordsNoStopWords;
				case "all_filters": return segmentationResult.wordsAllFilters;
				default: return segmentationResult.wordsAllFilters;
			}
		})());
	}
	/**
	* 获取关键词
	* @param num 返回的关键词数量
	* @param wordMinLen 关键词最小长度
	* @returns 关键词列表
	*/
	getKeywords(num = 6, wordMinLen = 1) {
		const result = [];
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
	getKeyphrases(keywordsNum = 12, minOccurNum = 2) {
		if (!this.segmentationResult) return [];
		const keywordsSet = new Set(this.getKeywords(keywordsNum, 1).map((item) => item.word));
		const keyphrases = /* @__PURE__ */ new Set();
		for (const sentence of this.segmentationResult.wordsNoFilter) {
			let currentPhrase = [];
			for (const word of sentence) if (keywordsSet.has(word)) currentPhrase.push(word);
			else {
				if (currentPhrase.length > 1) keyphrases.add(currentPhrase.join(""));
				currentPhrase = [];
			}
			if (currentPhrase.length > 1) keyphrases.add(currentPhrase.join(""));
		}
		return Array.from(keyphrases).filter((phrase) => {
			return (this.text.match(new RegExp(phrase, "g")) || []).length >= minOccurNum;
		});
	}
	/**
	* 获取分割后的句子
	*/
	get sentences() {
		return this.segmentationResult?.sentences || [];
	}
	/**
	* 获取原始分词结果
	*/
	get wordsNoFilter() {
		return this.segmentationResult?.wordsNoFilter || [];
	}
	/**
	* 获取去停用词的分词结果
	*/
	get wordsNoStopWords() {
		return this.segmentationResult?.wordsNoStopWords || [];
	}
	/**
	* 获取过滤后的分词结果
	*/
	get wordsAllFilters() {
		return this.segmentationResult?.wordsAllFilters || [];
	}
};
//#endregion
//#region src/core/textrank-sentence.ts
/**
* TextRank 句子摘要生成类
*/
var TextRankSentence = class {
	constructor(config = {}) {
		this.segmentationResult = null;
		this.keySentences = [];
		this.segmentation = new Segmentation(config);
	}
	/**
	* 分析文本，计算句子重要性（同步版本）
	* @param text 输入文本
	* @param config 配置参数
	*/
	analyze(text, config = {}) {
		const validationResult = validateInput(text);
		if (validationResult.isError()) {
			const error = validationResult.error;
			return Result2.error({
				...error,
				context: {
					...error.context,
					config
				}
			});
		}
		const { lower = false, source = "no_stop_words", pageRankConfig = {} } = config;
		this.keySentences = [];
		return safeSync(() => {
			this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });
			debug("=".repeat(40));
			debug("TextRankSentence 分析结果:");
			debug("sentences:", this.segmentationResult.sentences);
			debug("使用的词源:", source);
			const sourceWordsResult = this.getWordSource(source);
			if (sourceWordsResult.isError()) throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
			this.keySentences = sortSentences(this.segmentationResult.sentences, sourceWordsResult.value, getDefaultSimilarity, pageRankConfig);
			debug("句子重要性排序结果:");
			this.keySentences.slice(0, 5).forEach((item) => {
				debug(`[${item.index}] ${item.weight.toFixed(6)} - ${item.sentence.slice(0, 50)}...`);
			});
		}, ErrorType.COMPUTATION_ERROR, {
			text: validationResult.value.substring(0, 100),
			config,
			phase: "sentence_analysis"
		});
	}
	/**
	* 异步分析文本，计算句子重要性（推荐用于大文本）
	* 使用主线程调度器避免阻塞UI，支持进度回调
	* @param text 输入文本
	* @param config 异步配置参数
	*/
	async analyzeAsync(text, config = {}) {
		const validationResult = validateInput(text);
		if (validationResult.isError()) {
			const error = validationResult.error;
			return Result2.error({
				...error,
				context: {
					...error.context,
					config
				}
			});
		}
		const { lower = false, source = "no_stop_words", pageRankConfig = {}, onProgress, timeSlice = 5, maxContinuousTime = 16, yieldInterval = 100, priority = "background" } = config;
		this.keySentences = [];
		const asyncConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig({
			onProgress,
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
		return await AsyncAnalysisExecutor.executeFullAnalysis({
			segmentation: () => {
				this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });
				debug("=".repeat(40));
				debug("TextRankSentence 异步分析结果:");
				debug("sentences:", this.segmentationResult.sentences);
				debug("使用的词源:", source);
				return this.segmentationResult;
			},
			graphBuilding: () => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const sourceWordsResult = this.getWordSource(source);
				if (sourceWordsResult.isError()) throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
				debug("准备计算句子相似度，句子数量:", this.segmentationResult.sentences.length);
				return {
					sentences: this.segmentationResult.sentences,
					sourceWords: sourceWordsResult.value
				};
			},
			pageRank: (progressCallback) => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const sourceWordsResult = this.getWordSource(source);
				if (!sourceWordsResult.ok) throw new Error("获取词源失败");
				const sortSentencesWithProgress = (sentences, sourceWords, similarityFunc, prConfig) => {
					const result = sortSentences(sentences, sourceWords, similarityFunc, prConfig);
					if (progressCallback) {
						const maxIterations = prConfig.maxIterations || 100;
						for (let i = 0; i <= maxIterations; i += 10) progressCallback(Math.min(i, maxIterations), maxIterations);
					}
					return result;
				};
				return sortSentencesWithProgress(this.segmentationResult.sentences, sourceWordsResult.value, getDefaultSimilarity, pageRankConfig);
			},
			sorting: () => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const sourceWordsResult = this.getWordSource(source);
				if (!sourceWordsResult.ok) throw new Error("获取词源失败");
				this.keySentences = sortSentences(this.segmentationResult.sentences, sourceWordsResult.value, getDefaultSimilarity, pageRankConfig);
				debug("异步句子分析完成，关键句子数量:", this.keySentences.length);
				debug("句子重要性排序结果:");
				this.keySentences.slice(0, 5).forEach((item) => {
					debug(`[${item.index}] ${item.weight.toFixed(6)} - ${item.sentence.slice(0, 50)}...`);
				});
			}
		}, asyncConfig, {
			itemCount: this.segmentationResult?.sentences.length || 0,
			maxIterations: pageRankConfig.maxIterations || 100
		});
	}
	/**
	* 根据源类型获取对应的词列表
	*/
	getWordSource(source) {
		if (!this.segmentationResult) return errOf(ErrorType.VALIDATION_ERROR, "请先调用 analyze 方法");
		const segmentationResult = this.segmentationResult;
		return safeSync(() => {
			switch (source) {
				case "no_filter": return segmentationResult.wordsNoFilter;
				case "no_stop_words": return segmentationResult.wordsNoStopWords;
				case "all_filters": return segmentationResult.wordsAllFilters;
				default: return segmentationResult.wordsNoStopWords;
			}
		}, ErrorType.COMPUTATION_ERROR, { source });
	}
	/**
	* 获取关键句子用于生成摘要
	* @param num 返回的句子数量
	* @param sentenceMinLen 句子最小长度
	* @returns 关键句子列表
	*/
	getKeySentences(num = 6, sentenceMinLen = 6) {
		const result = [];
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
	getSummary(num = 3, sentenceMinLen = 6, sortByIndex = true) {
		let sentences = this.getKeySentences(num, sentenceMinLen);
		if (sortByIndex) sentences = sentences.sort((a, b) => a.index - b.index);
		return sentences.map((item) => item.sentence).join("");
	}
	/**
	* 使用自定义相似度函数分析（同步版本）
	* @param text 输入文本
	* @param similarityFunc 自定义相似度函数
	* @param config 其他配置参数
	*/
	analyzeWithSimilarityFunc(text, similarityFunc, config = {}) {
		const validationResult = validateInput(text);
		if (validationResult.isError()) {
			const error = validationResult.error;
			return Result2.error({
				...error,
				context: {
					...error.context,
					config
				}
			});
		}
		const { lower = false, source = "no_stop_words", pageRankConfig = {} } = config;
		this.keySentences = [];
		return safeSync(() => {
			this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });
			const sourceWordsResult = this.getWordSource(source);
			if (sourceWordsResult.isError()) throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
			this.keySentences = sortSentences(this.segmentationResult.sentences, sourceWordsResult.value, similarityFunc, pageRankConfig);
			debug("自定义相似度函数分析完成，关键句子数量:", this.keySentences.length);
		}, ErrorType.COMPUTATION_ERROR, {
			text: validationResult.value.substring(0, 100),
			config,
			phase: "custom_similarity_analysis"
		});
	}
	/**
	* 使用自定义相似度函数异步分析（推荐用于大文本）
	* @param text 输入文本
	* @param similarityFunc 自定义相似度函数
	* @param config 异步配置参数
	*/
	async analyzeWithSimilarityFuncAsync(text, similarityFunc, config = {}) {
		const validationResult = validateInput(text);
		if (validationResult.isError()) {
			const error = validationResult.error;
			return Result2.error({
				...error,
				context: {
					...error.context,
					config
				}
			});
		}
		const { lower = false, source = "no_stop_words", pageRankConfig = {}, onProgress, timeSlice = 5, maxContinuousTime = 16, yieldInterval = 100, priority = "background" } = config;
		this.keySentences = [];
		const asyncConfig = AsyncAnalysisExecutor.getDefaultAsyncConfig({
			onProgress,
			timeSlice,
			maxContinuousTime,
			yieldInterval,
			priority
		});
		return await AsyncAnalysisExecutor.executeFullAnalysis({
			segmentation: () => {
				this.segmentationResult = this.segmentation.segment(validationResult.value, { lower });
				debug("=".repeat(40));
				debug("TextRankSentence 自定义相似度函数异步分析:");
				debug("sentences:", this.segmentationResult.sentences);
				debug("使用的词源:", source);
				return this.segmentationResult;
			},
			graphBuilding: () => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const sourceWordsResult = this.getWordSource(source);
				if (sourceWordsResult.isError()) throw new Error(`获取词源失败: ${sourceWordsResult.error.message}`);
				debug("使用自定义相似度函数准备计算，句子数量:", this.segmentationResult.sentences.length);
				return {
					sentences: this.segmentationResult.sentences,
					sourceWords: sourceWordsResult.value,
					customSimilarityFunc: similarityFunc
				};
			},
			pageRank: (progressCallback) => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const sourceWordsResult = this.getWordSource(source);
				if (!sourceWordsResult.ok) throw new Error("获取词源失败");
				const sortSentencesWithCustomFunc = (sentences, sourceWords, customSimilarityFunc, prConfig) => {
					const result = sortSentences(sentences, sourceWords, customSimilarityFunc, prConfig);
					if (progressCallback) {
						const maxIterations = prConfig.maxIterations || 100;
						for (let i = 0; i <= maxIterations; i += 10) progressCallback(Math.min(i, maxIterations), maxIterations);
					}
					return result;
				};
				return sortSentencesWithCustomFunc(this.segmentationResult.sentences, sourceWordsResult.value, similarityFunc, pageRankConfig);
			},
			sorting: () => {
				if (!this.segmentationResult) throw new Error("分词结果为空");
				const sourceWordsResult = this.getWordSource(source);
				if (!sourceWordsResult.ok) throw new Error("获取词源失败");
				this.keySentences = sortSentences(this.segmentationResult.sentences, sourceWordsResult.value, similarityFunc, pageRankConfig);
				debug("自定义相似度函数异步分析完成，关键句子数量:", this.keySentences.length);
				debug("句子重要性排序结果:");
				this.keySentences.slice(0, 5).forEach((item) => {
					debug(`[${item.index}] ${item.weight.toFixed(6)} - ${item.sentence.slice(0, 50)}...`);
				});
			}
		}, asyncConfig, {
			itemCount: this.segmentationResult?.sentences.length || 0,
			maxIterations: pageRankConfig.maxIterations || 100
		});
	}
	/**
	* 获取分割后的句子
	*/
	get sentences() {
		return this.segmentationResult?.sentences || [];
	}
	/**
	* 获取原始分词结果
	*/
	get wordsNoFilter() {
		return this.segmentationResult?.wordsNoFilter || [];
	}
	/**
	* 获取去停用词的分词结果
	*/
	get wordsNoStopWords() {
		return this.segmentationResult?.wordsNoStopWords || [];
	}
	/**
	* 获取过滤后的分词结果
	*/
	get wordsAllFilters() {
		return this.segmentationResult?.wordsAllFilters || [];
	}
	/**
	* 获取所有句子的权重分布
	*/
	getSentenceWeights() {
		return this.keySentences.map((item) => ({
			index: item.index,
			sentence: item.sentence,
			weight: item.weight
		}));
	}
};
//#endregion
//#region src/utils/data-transfer.ts
/**
* 判断值是否为可按键遍历的对象（Object.entries 的安全前提）
*/
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
/**
* 判断值是否为「键 -> ArrayBuffer」映射，即 batchSerialize 的产物
*/
function isArrayBufferRecord(value) {
	return isRecord(value) && Object.values(value).every((item) => item instanceof ArrayBuffer);
}
/**
* 数据传输工具类 - 优化 Web Worker 数据传输性能
* 使用 Transferable 对象避免数据拷贝开销，自动降级兼容不支持的环境
*/
var WorkerDataTransfer = class {
	constructor() {
		this.isTransferableSupported = this.detectTransferableSupport();
		this.isWorkerSupported = this.detectWorkerSupport();
		this.isSharedWorkerSupported = this.detectSharedWorkerSupport();
		this.isTextEncoderSupported = this.detectTextEncoderSupport();
		this.logSupportStatus();
	}
	/**
	* 检测 Transferable 对象支持
	*/
	detectTransferableSupport() {
		const result = safeSync(() => {
			if (typeof ArrayBuffer === "undefined") return false;
			if (typeof window !== "undefined" && typeof window.postMessage === "function") return true;
			if (typeof self !== "undefined" && typeof self.postMessage === "function") return true;
			return false;
		}, ErrorType.UNSUPPORTED_ERROR, { feature: "transferable" });
		return result.isOk() ? result.value : false;
	}
	/**
	* 检测 Web Worker 支持
	*/
	detectWorkerSupport() {
		const result = safeSync(() => typeof Worker !== "undefined", ErrorType.UNSUPPORTED_ERROR, { feature: "worker" });
		return result.isOk() ? result.value : false;
	}
	/**
	* 检测 SharedWorker 支持
	*/
	detectSharedWorkerSupport() {
		const result = safeSync(() => typeof SharedWorker !== "undefined", ErrorType.UNSUPPORTED_ERROR, { feature: "sharedWorker" });
		return result.isOk() ? result.value : false;
	}
	/**
	* 检测 TextEncoder/TextDecoder 支持
	*/
	detectTextEncoderSupport() {
		const result = safeSync(() => typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined", ErrorType.UNSUPPORTED_ERROR, { feature: "textEncoder" });
		return result.isOk() ? result.value : false;
	}
	/**
	* 记录支持状态
	*/
	logSupportStatus() {
		if (typeof console !== "undefined" && console.debug) console.debug("TextRank4ZH-TS 兼容性检测:", {
			sharedWorker: this.isSharedWorkerSupported ? "✅ 支持" : "❌ 不支持",
			worker: this.isWorkerSupported ? "✅ 支持" : "❌ 不支持",
			transferable: this.isTransferableSupported ? "✅ 支持" : "❌ 不支持",
			textEncoder: this.isTextEncoderSupported ? "✅ 支持" : "❌ 不支持"
		});
	}
	/**
	* 将文本转换为 ArrayBuffer 格式（兼容降级版本）
	*/
	textToArrayBuffer(text) {
		if (this.isTextEncoderSupported) return safeSync(() => {
			return new TextEncoder().encode(text).buffer;
		}, ErrorType.SERIALIZATION_ERROR, { text: text.substring(0, 100) });
		else return this.manualTextToArrayBuffer(text);
	}
	/**
	* 将 ArrayBuffer 转换为文本（兼容降级版本）
	*/
	arrayBufferToText(buffer) {
		if (this.isTextEncoderSupported) return safeSync(() => {
			return new TextDecoder().decode(buffer);
		}, ErrorType.SERIALIZATION_ERROR, { bufferSize: buffer.byteLength });
		else return this.manualArrayBufferToText(buffer);
	}
	/**
	* 手动文本到 ArrayBuffer 转换（兼容性降级）
	*/
	manualTextToArrayBuffer(text) {
		return safeSync(() => {
			const utf8 = [];
			for (let i = 0; i < text.length; i++) {
				let charcode = text.charCodeAt(i);
				if (charcode < 128) utf8.push(charcode);
				else if (charcode < 2048) utf8.push(192 | charcode >> 6, 128 | charcode & 63);
				else if ((charcode & 64512) == 55296 && i + 1 < text.length && (text.charCodeAt(i + 1) & 64512) == 56320) {
					charcode = 65536 + (((charcode & 1023) << 10) + (text.charCodeAt(++i) & 1023));
					utf8.push(240 | charcode >> 18, 128 | charcode >> 12 & 63, 128 | charcode >> 6 & 63, 128 | charcode & 63);
				} else if (charcode >= 55296 && charcode <= 57343) utf8.push(239, 191, 189);
				else utf8.push(224 | charcode >> 12, 128 | charcode >> 6 & 63, 128 | charcode & 63);
			}
			return new Uint8Array(utf8).buffer;
		}, ErrorType.SERIALIZATION_ERROR, {
			text: text.substring(0, 100),
			method: "manual"
		});
	}
	/**
	* 手动 ArrayBuffer 到文本转换（兼容性降级）
	*/
	manualArrayBufferToText(buffer) {
		return safeSync(() => {
			const bytes = new Uint8Array(buffer);
			const length = bytes.length;
			let result = "";
			let i = 0;
			const byteAt = (index) => {
				const byte = bytes[index];
				if (byte === void 0) throw new Error(`UTF-8 解码失败：字节序列在位置 ${index} 被截断`);
				return byte;
			};
			while (i < length) {
				const byte1 = byteAt(i++);
				if (byte1 < 128) result += String.fromCharCode(byte1);
				else if (byte1 >> 5 === 6) {
					const byte2 = byteAt(i++);
					result += String.fromCharCode((byte1 & 31) << 6 | byte2 & 63);
				} else if (byte1 >> 4 === 14) {
					const byte2 = byteAt(i++);
					const byte3 = byteAt(i++);
					result += String.fromCharCode((byte1 & 15) << 12 | (byte2 & 63) << 6 | byte3 & 63);
				} else if (byte1 >> 3 === 30) {
					const byte2 = byteAt(i++);
					const byte3 = byteAt(i++);
					const byte4 = byteAt(i++);
					const codepoint = (byte1 & 7) << 18 | (byte2 & 63) << 12 | (byte3 & 63) << 6 | byte4 & 63;
					result += String.fromCharCode(55296 + (codepoint - 65536 >> 10), 56320 + (codepoint - 65536 & 1023));
				} else result += "�";
			}
			return result;
		}, ErrorType.SERIALIZATION_ERROR, {
			bufferSize: buffer.byteLength,
			method: "manual"
		});
	}
	/**
	* 将对象序列化为 ArrayBuffer
	*/
	serializeToArrayBuffer(obj) {
		return safeSync(() => {
			const jsonString = JSON.stringify(obj);
			const bufferResult = this.textToArrayBuffer(jsonString);
			if (bufferResult.isError()) throw new Error(bufferResult.error.message);
			return bufferResult.value;
		}, ErrorType.SERIALIZATION_ERROR, { objectType: typeof obj });
	}
	/**
	* 将 ArrayBuffer 反序列化为对象
	*/
	deserializeFromArrayBuffer(buffer) {
		const textResult = this.arrayBufferToText(buffer);
		if (!textResult.ok) return {
			ok: false,
			error: textResult.error
		};
		return safeSync(() => JSON.parse(textResult.value), ErrorType.SERIALIZATION_ERROR, { bufferSize: buffer.byteLength });
	}
	/**
	* 创建可传输的文本数据
	*/
	createTransferableTextData(text) {
		return this.textToArrayBuffer(text).map((textBuffer) => ({
			textBuffer,
			textLength: text.length,
			encoding: "utf-8"
		}));
	}
	/**
	* 从可传输数据中提取文本
	*/
	extractTextFromTransferableData(data) {
		return this.arrayBufferToText(data.textBuffer);
	}
	/**
	* 批量序列化数据为 Transferable 格式
	*/
	batchSerialize(data) {
		return safeSync(() => {
			const serializedData = {};
			const transferables = [];
			for (const [key, value] of Object.entries(data)) if (value !== void 0 && value !== null) {
				const bufferResult = this.serializeToArrayBuffer(value);
				if (bufferResult.ok === false) throw new Error(`序列化键 '${key}' 失败: ${bufferResult.error.message}`);
				const buffer = bufferResult.value;
				serializedData[key] = buffer;
				transferables.push(buffer);
			}
			return {
				serializedData,
				transferables
			};
		}, ErrorType.SERIALIZATION_ERROR, { dataKeys: Object.keys(data) });
	}
	/**
	* 批量反序列化数据
	*/
	batchDeserialize(serializedData) {
		return safeSync(() => {
			const result = {};
			for (const [key, buffer] of Object.entries(serializedData)) {
				const deserializeResult = this.deserializeFromArrayBuffer(buffer);
				if (deserializeResult.ok === false) throw new Error(`反序列化键 '${key}' 失败: ${deserializeResult.error.message}`);
				result[key] = deserializeResult.value;
			}
			return result;
		}, ErrorType.SERIALIZATION_ERROR, { dataKeys: Object.keys(serializedData) });
	}
	/**
	* 检查数据大小是否适合使用 Transferable
	* 只有当数据足够大且环境支持时，使用 Transferable 才有性能优势
	*/
	shouldUseTransferable(data, threshold = 1024) {
		if (!this.isTransferableSupported) return ok(false);
		const result = safeSync(() => {
			return JSON.stringify(data).length > threshold;
		}, ErrorType.VALIDATION_ERROR, { threshold });
		if (!result.ok) return ok(false);
		return result;
	}
	/**
	* 智能选择传输方式（带兼容性检测）
	*/
	prepareDataForTransfer(data) {
		const shouldUseResult = this.shouldUseTransferable(data);
		if (shouldUseResult.ok === false) return {
			transferData: data,
			useTransferable: false
		};
		if (shouldUseResult.value && isRecord(data)) {
			const serializeResult = this.batchSerialize(data);
			if (serializeResult.ok === false) {
				if (typeof console !== "undefined" && console.warn) console.warn("TextRank4ZH-TS: Transferable 准备失败，降级到传统传输:", serializeResult.error.message);
				return {
					transferData: data,
					useTransferable: false
				};
			}
			const { serializedData, transferables } = serializeResult.value;
			return {
				transferData: {
					__transferable: true,
					data: serializedData
				},
				transferables,
				useTransferable: true
			};
		}
		return {
			transferData: data,
			useTransferable: false
		};
	}
	/**
	* 处理接收到的数据（带错误处理）
	*/
	processReceivedData(data) {
		if (isRecord(data) && data["__transferable"] === true) {
			if (!this.isTransferableSupported) {
				if (typeof console !== "undefined" && console.warn) console.warn("TextRank4ZH-TS: 收到 Transferable 数据但环境不支持，尝试降级处理");
			}
			const serializedData = data["data"];
			if (!isArrayBufferRecord(serializedData)) return serializedData || data;
			const deserializeResult = this.batchDeserialize(serializedData);
			if (deserializeResult.ok === false) {
				if (typeof console !== "undefined" && console.warn) console.warn("TextRank4ZH-TS: 数据处理失败，返回原始数据:", deserializeResult.error.message);
				return serializedData || data;
			}
			return deserializeResult.value;
		}
		return data;
	}
	/**
	* 获取环境支持状态
	*/
	getSupportStatus() {
		return {
			sharedWorker: this.isSharedWorkerSupported,
			worker: this.isWorkerSupported,
			transferable: this.isTransferableSupported,
			textEncoder: this.isTextEncoderSupported
		};
	}
	/**
	* 获取推荐的 Worker 类型
	*/
	getRecommendedWorkerType() {
		if (this.isSharedWorkerSupported) return WorkerType.SHARED;
		else if (this.isWorkerSupported) return WorkerType.DEDICATED;
		else return WorkerType.SYNC;
	}
	/**
	* 安全的批量序列化（带错误处理）
	*/
	safeBatchSerialize(data) {
		const result = this.batchSerialize(data);
		if (!result.ok) return {
			serializedData: {},
			transferables: [],
			success: false,
			error: result.error.message
		};
		return {
			...result.value,
			success: true
		};
	}
	/**
	* 安全的批量反序列化（带错误处理）
	*/
	safeBatchDeserialize(serializedData) {
		const result = this.batchDeserialize(serializedData);
		if (!result.ok) return {
			data: null,
			success: false,
			error: result.error.message
		};
		return {
			data: result.value,
			success: true
		};
	}
};
/**
* 单例模式的数据传输工具
*/
var dataTransfer = new WorkerDataTransfer();
//#endregion
//#region src/worker/textrank-worker-client.ts
var TextRankWorkerClient = class {
	constructor(workerUrl, options = {}) {
		this.worker = null;
		this.pendingTasks = /* @__PURE__ */ new Map();
		this.taskCounter = 0;
		this.workerUrl = workerUrl || this.createWorkerUrl();
		this.options = {
			timeout: 3e4,
			maxConcurrent: 10,
			...options
		};
		this.isWorkerSupported = this.detectWorkerSupport();
		this.supportStatus = dataTransfer.getSupportStatus();
		this.logCompatibilityStatus();
	}
	/**
	* 检测 Web Worker 支持
	*/
	detectWorkerSupport() {
		return safeSync(() => typeof Worker !== "undefined" && typeof window !== "undefined", ErrorType.UNSUPPORTED_ERROR, { feature: "web-worker" }).getOrDefault(false);
	}
	/**
	* 记录兼容性状态
	*/
	logCompatibilityStatus() {
		if (typeof console !== "undefined" && console.debug) console.debug("TextRank Worker 客户端兼容性状态:", {
			worker: this.isWorkerSupported ? "✅ 支持" : "❌ 不支持",
			transferable: this.supportStatus.transferable ? "✅ 支持" : "❌ 不支持",
			fallback: !this.isWorkerSupported ? "⚠️ 将使用同步降级模式" : ""
		});
	}
	/**
	* 初始化 Worker（带兼容性检测）
	*/
	async initWorker() {
		if (this.worker) return ok(void 0);
		if (!this.isWorkerSupported) return errOf(ErrorType.UNSUPPORTED_ERROR, "Web Worker 不支持，请使用同步模式或检查浏览器兼容性");
		return await safeAsync(async () => {
			return new Promise((resolve, reject) => {
				const workerResult = safeSync(() => {
					this.worker = new Worker(this.workerUrl, { type: "module" });
					this.worker.onmessage = (event) => {
						this.handleWorkerMessage(event.data);
					};
					this.worker.onerror = (error) => {
						console.error("Worker error:", error);
						this.worker = null;
						reject(/* @__PURE__ */ new Error(`Worker 初始化失败: ${error.message || "Unknown error"}`));
					};
					return this.worker;
				}, ErrorType.WORKER_ERROR, { url: this.workerUrl });
				if (workerResult.isError()) {
					reject(/* @__PURE__ */ new Error(`Worker 创建失败: ${workerResult.error.message}`));
					return;
				}
				const worker = workerResult.value;
				const initTimeout = setTimeout(() => {
					if (this.worker) {
						this.worker.terminate();
						this.worker = null;
					}
					reject(/* @__PURE__ */ new Error("Worker 初始化超时"));
				}, this.options.timeout || 3e4);
				const readyHandler = (event) => {
					if (event.data.id === "worker-ready") {
						clearTimeout(initTimeout);
						worker.removeEventListener("message", readyHandler);
						resolve();
					}
				};
				worker.addEventListener("message", readyHandler);
			});
		}, ErrorType.WORKER_ERROR, { phase: "initialization" });
	}
	/**
	* 创建 Worker URL（从模块代码创建）
	*/
	createWorkerUrl() {
		return "./textrank.worker.js";
	}
	/**
	* 处理 Worker 消息
	*/
	handleWorkerMessage(message) {
		if (message.id === "worker-ready") return;
		const pending = this.pendingTasks.get(message.id);
		if (!pending) return;
		if (pending.timeout) clearTimeout(pending.timeout);
		this.pendingTasks.delete(message.id);
		if (message.type === "result") {
			const payload = dataTransfer.processReceivedData(message.payload);
			pending.resolve(payload);
		} else if (message.type === "error") {
			const payload = dataTransfer.processReceivedData(message.payload);
			pending.reject(new Error(payload.error));
		}
	}
	/**
	* 发送任务到 Worker
	*/
	async sendTask(type, config) {
		const initResult = await this.initWorker();
		if (initResult.isError()) throw new Error(`Worker 初始化失败: ${initResult.error.message}`);
		const worker = this.worker;
		if (!worker) throw new Error("Worker not initialized");
		if (this.pendingTasks.size >= this.options.maxConcurrent) throw new Error(`Too many concurrent tasks (max: ${this.options.maxConcurrent})`);
		const taskId = `task_${++this.taskCounter}_${Date.now()}`;
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingTasks.delete(taskId);
				reject(/* @__PURE__ */ new Error(`Task timeout after ${this.options.timeout}ms`));
			}, this.options.timeout);
			this.pendingTasks.set(taskId, {
				resolve,
				reject,
				timeout
			});
			const { transferData, transferables, useTransferable } = dataTransfer.prepareDataForTransfer(config);
			const message = {
				id: taskId,
				type,
				payload: transferData
			};
			const sendResult = safeSync(() => {
				if (useTransferable && transferables && transferables.length > 0) {
					message.transferable = transferables;
					worker.postMessage(message, transferables);
					if (typeof console !== "undefined" && console.debug) console.debug(`TextRank Worker: 使用 Transferable 发送 ${transferables.length} 个对象`);
				} else {
					worker.postMessage(message);
					if (useTransferable && typeof console !== "undefined" && console.debug) console.debug("TextRank Worker: Transferable 准备失败，使用传统方式发送");
				}
			}, ErrorType.WORKER_ERROR, {
				taskId,
				messageType: type
			});
			if (sendResult.isError()) {
				if (useTransferable) {
					if (typeof console !== "undefined" && console.warn) console.warn("TextRank Worker: Transferable 发送失败，降级到传统方式:", sendResult.error.message);
					const fallbackResult = safeSync(() => {
						const fallbackMessage = {
							id: taskId,
							type,
							payload: config
						};
						worker.postMessage(fallbackMessage);
					}, ErrorType.WORKER_ERROR, {
						taskId,
						fallback: true
					});
					if (fallbackResult.isError()) {
						this.pendingTasks.delete(taskId);
						clearTimeout(timeout);
						reject(/* @__PURE__ */ new Error(`消息发送失败: ${fallbackResult.error.message}`));
						return;
					}
				} else {
					this.pendingTasks.delete(taskId);
					clearTimeout(timeout);
					reject(/* @__PURE__ */ new Error(`消息发送失败: ${sendResult.error.message}`));
					return;
				}
			}
		});
	}
	/**
	* 关键词分析
	*/
	async analyzeKeywords(text, config, options) {
		const taskConfig = {
			text,
			...config ? { config } : {},
			...options ? { options } : {}
		};
		const result = await this.sendTask("analyze_keywords", taskConfig);
		if (!result.success) throw new Error(result.error || "Analysis failed");
		const { keywords, keyphrases } = result.data ?? {};
		return {
			...keywords !== void 0 ? { keywords } : {},
			...keyphrases !== void 0 ? { keyphrases } : {},
			duration: result.duration || 0
		};
	}
	/**
	* 句子分析和摘要生成
	*/
	async analyzeSentences(text, config, options) {
		const taskConfig = {
			text,
			...config ? { config } : {},
			...options ? { options } : {}
		};
		const result = await this.sendTask("analyze_sentences", taskConfig);
		if (!result.success) throw new Error(result.error || "Analysis failed");
		const { sentences, summary } = result.data ?? {};
		return {
			...sentences !== void 0 ? { sentences } : {},
			...summary !== void 0 ? { summary } : {},
			duration: result.duration || 0
		};
	}
	/**
	* 完整分析（关键词 + 句子摘要）
	*/
	async analyzeText(text, keywordConfig, sentenceConfig, options) {
		const [keywordResult, sentenceResult] = await Promise.all([this.analyzeKeywords(text, keywordConfig, {
			...options?.keywords ? { keywords: options.keywords } : {},
			...options?.keyphrases ? { keyphrases: options.keyphrases } : {}
		}), this.analyzeSentences(text, sentenceConfig, {
			...options?.sentences ? { sentences: options.sentences } : {},
			...options?.summary ? { summary: options.summary } : {}
		})]);
		return {
			...keywordResult.keywords !== void 0 ? { keywords: keywordResult.keywords } : {},
			...keywordResult.keyphrases !== void 0 ? { keyphrases: keywordResult.keyphrases } : {},
			...sentenceResult.sentences !== void 0 ? { sentences: sentenceResult.sentences } : {},
			...sentenceResult.summary !== void 0 ? { summary: sentenceResult.summary } : {},
			totalDuration: keywordResult.duration + sentenceResult.duration
		};
	}
	/**
	* 获取当前任务状态
	*/
	getStatus() {
		return {
			pendingTasks: this.pendingTasks.size,
			maxConcurrent: this.options.maxConcurrent,
			workerReady: this.worker !== null,
			workerSupported: this.isWorkerSupported,
			transferableSupported: this.supportStatus.transferable
		};
	}
	/**
	* 获取完整的兼容性信息
	*/
	getCompatibilityInfo() {
		const recommendations = [];
		if (!this.isWorkerSupported) recommendations.push("建议升级到支持 Web Workers 的现代浏览器");
		if (!this.supportStatus.transferable) recommendations.push("Transferable 对象不支持，将使用传统数据传输");
		if (!this.supportStatus.textEncoder) recommendations.push("TextEncoder/TextDecoder 不支持，将使用手动编码");
		return {
			worker: {
				supported: this.isWorkerSupported,
				available: this.worker !== null
			},
			transferable: { supported: this.supportStatus.transferable },
			textEncoder: { supported: this.supportStatus.textEncoder },
			recommendations
		};
	}
	/**
	* 健康检查 - 验证 Worker 是否正常工作
	*/
	async healthCheck() {
		if (!this.isWorkerSupported) return errOf(ErrorType.UNSUPPORTED_ERROR, "Web Worker 不支持");
		return await safeAsync(async () => {
			const startTime = performance.now();
			await this.analyzeKeywords("测试", { window: 2 }, { keywords: { num: 1 } });
			return {
				healthy: true,
				latency: performance.now() - startTime
			};
		}, ErrorType.WORKER_ERROR, { feature: "health-check" });
	}
	/**
	* 清理资源
	*/
	terminate() {
		for (const task of this.pendingTasks.values()) {
			if (task.timeout) clearTimeout(task.timeout);
			task.reject(/* @__PURE__ */ new Error("Worker terminated"));
		}
		this.pendingTasks.clear();
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}
};
//#endregion
//#region src/worker/textrank-universal-client.ts
/**
* 通用 TextRank Worker 客户端
* 支持三级降级策略：SharedWorker → DedicatedWorker → SyncMode
*/
var TextRankUniversalClient = class {
	constructor(workerUrl, options = {}) {
		this.worker = null;
		this.sharedWorkerPort = null;
		this.pendingTasks = /* @__PURE__ */ new Map();
		this.syncHandlers = null;
		this.connectionCount = 0;
		this.isInitialized = false;
		this.workerUrl = workerUrl;
		this.options = {
			timeout: options.timeout || 3e4,
			maxConcurrent: options.maxConcurrent || 10,
			preferredWorkerType: options.preferredWorkerType || "auto",
			fallbackToSync: options.fallbackToSync !== false,
			syncScheduling: options.syncScheduling || {
				timeSlice: 5,
				maxContinuousTime: 16,
				priority: "background",
				idleTimeout: 50
			}
		};
		this.currentWorkerType = this.selectWorkerType();
		this.initSyncHandlers();
		this.initializeWorker();
	}
	/**
	* 选择最佳的 Worker 类型
	*/
	selectWorkerType() {
		const supportStatus = dataTransfer.getSupportStatus();
		const recommended = dataTransfer.getRecommendedWorkerType();
		if (this.options.preferredWorkerType !== "auto") switch (this.options.preferredWorkerType) {
			case "shared": return supportStatus.sharedWorker ? WorkerType.SHARED : recommended;
			case "dedicated": return supportStatus.worker ? WorkerType.DEDICATED : recommended;
			default: return recommended;
		}
		return recommended;
	}
	/**
	* 初始化同步模式处理器
	*/
	initSyncHandlers() {
		this.syncHandlers = {
			analyzeKeywords: async (text, config, options) => {
				const taskResult = await mainThreadScheduler.scheduleTask(async () => {
					const tr4w = new TextRankKeyword();
					tr4w.analyze(text, config);
					const result = {};
					if (options?.keywords) result.keywords = tr4w.getKeywords(options.keywords.num || 10, options.keywords.wordMinLen || 1);
					if (options?.keyphrases) result.keyphrases = tr4w.getKeyphrases(options.keyphrases.keywordsNum || 12, options.keyphrases.minOccurNum || 2);
					return result;
				}, this.options.syncScheduling || {});
				if (!taskResult.ok) throw new Error(`关键词分析失败: ${taskResult.error?.message || "未知错误"}`);
				return taskResult.value;
			},
			analyzeSentences: async (text, config, options) => {
				const taskResult = await mainThreadScheduler.scheduleTask(async () => {
					const tr4s = new TextRankSentence();
					tr4s.analyze(text, config);
					const result = {};
					if (options?.sentences) result.sentences = tr4s.getKeySentences(options.sentences.num || 5, options.sentences.sentenceMinLen || 6);
					if (options?.summary) result.summary = tr4s.getSummary(options.summary.num || 3, options.summary.sentenceMinLen || 6, options.summary.sortByIndex !== false);
					return result;
				}, this.options.syncScheduling || {});
				if (!taskResult.ok) throw new Error(`句子分析失败: ${taskResult.error?.message || "未知错误"}`);
				return taskResult.value;
			}
		};
	}
	/**
	* 初始化 Worker
	*/
	async initializeWorker() {
		const initResult = await safeAsync(async () => {
			if (this.currentWorkerType === WorkerType.SYNC) {
				console.log("TextRank4ZH-TS: 使用同步模式处理");
				this.isInitialized = true;
				return;
			}
			if (this.currentWorkerType === WorkerType.SHARED) await this.initSharedWorker();
			else await this.initDedicatedWorker();
			this.isInitialized = true;
			console.log(`TextRank4ZH-TS: ${this.currentWorkerType} Worker 初始化成功`);
		}, ErrorType.WORKER_ERROR, { workerType: this.currentWorkerType });
		if (!initResult.ok) {
			console.warn(`TextRank4ZH-TS: ${this.currentWorkerType} Worker 初始化失败:`, initResult.error?.message || "未知错误");
			return await this.fallbackToNextWorkerType();
		}
		return initResult;
	}
	/**
	* 初始化 SharedWorker
	*/
	async initSharedWorker() {
		const initResult = await safeAsync(async () => {
			this.worker = new SharedWorker(this.workerUrl, { type: "module" });
			this.sharedWorkerPort = this.worker.port;
			this.sharedWorkerPort.onmessage = this.handleMessage.bind(this);
			this.sharedWorkerPort.addEventListener("messageerror", ((error) => {
				this.handleError(error);
			}));
			this.sharedWorkerPort.start();
			this.connectionCount++;
			await this.waitForWorkerReady();
		}, ErrorType.WORKER_ERROR, {
			workerType: "SharedWorker",
			url: this.workerUrl
		});
		if (!initResult.ok) throw new Error(`SharedWorker 初始化失败: ${initResult.error?.message || "未知错误"}`);
	}
	/**
	* 初始化专用 Worker
	*/
	async initDedicatedWorker() {
		const initResult = await safeAsync(async () => {
			this.worker = new Worker(this.workerUrl, { type: "module" });
			this.worker.onmessage = this.handleMessage.bind(this);
			this.worker.onerror = this.handleError.bind(this);
			await this.waitForWorkerReady();
		}, ErrorType.WORKER_ERROR, {
			workerType: "DedicatedWorker",
			url: this.workerUrl
		});
		if (!initResult.ok) throw new Error(`DedicatedWorker 初始化失败: ${initResult.error?.message || "未知错误"}`);
	}
	/**
	* 等待 Worker 准备就绪
	*/
	waitForWorkerReady() {
		return new Promise((resolve, reject) => {
			const target = this.currentWorkerType === WorkerType.SHARED ? this.sharedWorkerPort : this.worker;
			if (!target) {
				reject(/* @__PURE__ */ new Error("Worker 尚未创建，无法等待就绪"));
				return;
			}
			function readyHandler(event) {
				if (event.data?.id !== "worker-ready") return;
				clearTimeout(timeout);
				target?.removeEventListener("message", readyHandler);
				resolve();
			}
			const timeout = setTimeout(() => {
				target?.removeEventListener("message", readyHandler);
				reject(/* @__PURE__ */ new Error("Worker 初始化超时"));
			}, 5e3);
			target.addEventListener("message", readyHandler);
		});
	}
	/**
	* 降级到下一个 Worker 类型
	*/
	async fallbackToNextWorkerType() {
		console.warn(`TextRank4ZH-TS: 正在从 ${this.currentWorkerType} 降级...`);
		return await safeAsync(async () => {
			if (this.currentWorkerType === WorkerType.SHARED) {
				this.currentWorkerType = WorkerType.DEDICATED;
				console.log("TextRank4ZH-TS: 降级到 DedicatedWorker");
			} else if (this.currentWorkerType === WorkerType.DEDICATED) {
				if (this.options.fallbackToSync) {
					this.currentWorkerType = WorkerType.SYNC;
					console.log("TextRank4ZH-TS: 降级到同步模式");
				} else throw new Error("Worker 不可用且未启用同步模式降级");
			} else throw new Error("所有 Worker 类型都不可用");
			const initResult = await this.initializeWorker();
			if (!initResult.ok) throw new Error(`降级后初始化失败: ${initResult.error?.message || "未知错误"}`);
		}, ErrorType.WORKER_ERROR, {
			originalType: this.currentWorkerType,
			fallback: true
		});
	}
	/**
	* 处理消息
	*/
	handleMessage(event) {
		const message = event.data;
		const task = this.pendingTasks.get(message.id);
		if (!task) return;
		if (message.type === "error") {
			clearTimeout(task.timeout);
			this.pendingTasks.delete(message.id);
			const errorPayload = message.payload;
			task.reject(new Error(errorPayload?.error || "未知错误"));
		} else if (message.type === "result") {
			clearTimeout(task.timeout);
			this.pendingTasks.delete(message.id);
			const resultPayload = message.payload;
			const processedData = dataTransfer.processReceivedData(message.payload);
			task.resolve({
				id: message.id,
				success: true,
				data: processedData,
				...resultPayload?.duration !== void 0 ? { duration: resultPayload.duration } : {}
			});
		}
	}
	/**
	* 处理错误
	*/
	handleError(error) {
		console.error("TextRank4ZH-TS Worker 错误:", error);
		this.pendingTasks.forEach((task) => {
			clearTimeout(task.timeout);
			task.reject(/* @__PURE__ */ new Error(`Worker 错误: ${error.message}`));
		});
		this.pendingTasks.clear();
	}
	/**
	* 发送消息到 Worker
	*/
	async postMessage(message) {
		if (this.currentWorkerType === WorkerType.SYNC) return Promise.resolve();
		const { transferData, transferables } = dataTransfer.prepareDataForTransfer(message.payload);
		const finalMessage = {
			...message,
			payload: transferData
		};
		if (this.currentWorkerType === WorkerType.SHARED && this.sharedWorkerPort) {
			if (transferables && transferables.length > 0) this.sharedWorkerPort.postMessage(finalMessage, transferables);
			else this.sharedWorkerPort.postMessage(finalMessage);
		} else if (this.worker && this.currentWorkerType === WorkerType.DEDICATED) {
			if (transferables && transferables.length > 0) this.worker.postMessage(finalMessage, transferables);
			else this.worker.postMessage(finalMessage);
		}
	}
	/**
	* 关键词分析
	*/
	async analyzeKeywords(text, config, options) {
		if (!this.isInitialized) throw new Error("Worker 客户端未初始化");
		if (this.currentWorkerType === WorkerType.SYNC && this.syncHandlers) {
			const syncHandlers = this.syncHandlers;
			const startTime = Date.now();
			const syncResult = await safeAsync(() => syncHandlers.analyzeKeywords(text, config, options), ErrorType.COMPUTATION_ERROR, {
				method: "analyzeKeywords",
				mode: "sync"
			});
			const errorMessage = syncResult.ok ? void 0 : syncResult.error?.message;
			return {
				id: `sync-${Date.now()}`,
				success: syncResult.ok,
				...syncResult.ok && syncResult.value !== void 0 ? { data: syncResult.value } : {},
				...errorMessage !== void 0 ? { error: errorMessage } : {},
				duration: Date.now() - startTime
			};
		}
		return this.executeWorkerTask("analyze_keywords", {
			text,
			config,
			options
		});
	}
	/**
	* 句子分析
	*/
	async analyzeSentences(text, config, options) {
		if (!this.isInitialized) throw new Error("Worker 客户端未初始化");
		if (this.currentWorkerType === WorkerType.SYNC && this.syncHandlers) {
			const syncHandlers = this.syncHandlers;
			const startTime = Date.now();
			const syncResult = await safeAsync(() => syncHandlers.analyzeSentences(text, config, options), ErrorType.COMPUTATION_ERROR, {
				method: "analyzeSentences",
				mode: "sync"
			});
			const errorMessage = syncResult.ok ? void 0 : syncResult.error?.message;
			return {
				id: `sync-${Date.now()}`,
				success: syncResult.ok,
				...syncResult.ok && syncResult.value !== void 0 ? { data: syncResult.value } : {},
				...errorMessage !== void 0 ? { error: errorMessage } : {},
				duration: Date.now() - startTime
			};
		}
		return this.executeWorkerTask("analyze_sentences", {
			text,
			config,
			options
		});
	}
	/**
	* 执行 Worker 任务
	*/
	executeWorkerTask(type, payload) {
		return new Promise((resolve, reject) => {
			if (this.pendingTasks.size >= this.options.maxConcurrent) {
				reject(/* @__PURE__ */ new Error("任务队列已满"));
				return;
			}
			const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			const timeout = setTimeout(() => {
				this.pendingTasks.delete(id);
				reject(/* @__PURE__ */ new Error("任务超时"));
			}, this.options.timeout);
			this.pendingTasks.set(id, {
				resolve,
				reject,
				timeout
			});
			const message = {
				id,
				type,
				payload
			};
			this.postMessage(message).catch((error) => {
				clearTimeout(timeout);
				this.pendingTasks.delete(id);
				reject(error);
			});
		});
	}
	/**
	* 获取客户端状态
	*/
	getStatus() {
		return {
			type: this.currentWorkerType,
			supported: this.currentWorkerType !== WorkerType.SYNC || this.options.fallbackToSync,
			available: this.isInitialized,
			...this.currentWorkerType === WorkerType.SHARED ? { connectionCount: this.connectionCount } : {}
		};
	}
	/**
	* 获取详细状态（包含调度器信息）
	*/
	async getDetailedStatus() {
		const basicStatus = this.getStatus();
		if (this.currentWorkerType === WorkerType.SYNC) {
			const [schedulerStatus, busyness] = await Promise.all([Promise.resolve(mainThreadScheduler.getStatus()), mainThreadScheduler.measureMainThreadBusyness()]);
			return {
				...basicStatus,
				schedulerStatus,
				mainThreadBusyness: busyness
			};
		}
		return basicStatus;
	}
	/**
	* 自适应调整同步模式调度配置
	*/
	async optimizeSyncScheduling() {
		if (this.currentWorkerType !== WorkerType.SYNC) return ok(void 0);
		const optimizeResult = await safeAsync(async () => {
			const busynessResult = await mainThreadScheduler.measureMainThreadBusyness();
			if (!busynessResult.ok) throw new Error(`主线程繁忙程度检测失败: ${busynessResult.error?.message || "未知错误"}`);
			const busyness = busynessResult.value;
			const currentScheduling = this.options.syncScheduling || {};
			switch (busyness.recommendation) {
				case "aggressive":
					this.options.syncScheduling = {
						...currentScheduling,
						timeSlice: 10,
						maxContinuousTime: 32,
						priority: "normal"
					};
					break;
				case "moderate":
					this.options.syncScheduling = {
						...currentScheduling,
						timeSlice: 5,
						maxContinuousTime: 16,
						priority: "background"
					};
					break;
				case "conservative": this.options.syncScheduling = {
					...currentScheduling,
					timeSlice: 2,
					maxContinuousTime: 8,
					priority: "background",
					idleTimeout: 20
				};
			}
			console.log(`TextRank4ZH-TS: 根据主线程繁忙程度 (${busyness.averageFrameTime.toFixed(2)}ms) 调整为 ${busyness.recommendation} 调度策略`);
		}, ErrorType.COMPUTATION_ERROR, { feature: "sync-scheduling-optimization" });
		if (!optimizeResult.ok) console.warn("TextRank4ZH-TS: 主线程繁忙程度检测失败", optimizeResult.error?.message || "未知错误");
		return optimizeResult;
	}
	/**
	* 获取待处理任务数量
	*/
	getPendingTasksCount() {
		return this.pendingTasks.size;
	}
	/**
	* 终止 Worker
	*/
	terminate() {
		this.pendingTasks.forEach((task) => {
			clearTimeout(task.timeout);
			task.reject(/* @__PURE__ */ new Error("Worker 已终止"));
		});
		this.pendingTasks.clear();
		if (this.worker) {
			if (this.currentWorkerType === WorkerType.SHARED) {
				if (this.sharedWorkerPort) {
					this.sharedWorkerPort.close();
					this.sharedWorkerPort = null;
				}
				this.connectionCount--;
			} else if (this.currentWorkerType === WorkerType.DEDICATED) this.worker.terminate();
			this.worker = null;
		}
		this.isInitialized = false;
	}
	/**
	* 检查是否支持指定的 Worker 类型
	*/
	static supportsWorkerType(type) {
		const supportStatus = dataTransfer.getSupportStatus();
		switch (type) {
			case WorkerType.SHARED: return supportStatus.sharedWorker;
			case WorkerType.DEDICATED: return supportStatus.worker;
			case WorkerType.SYNC: return true;
			default: return false;
		}
	}
	/**
	* 获取推荐的 Worker 类型
	*/
	static getRecommendedWorkerType() {
		return dataTransfer.getRecommendedWorkerType();
	}
};
//#endregion
//#region src/index.ts
var src_default = {
	TextRankKeyword,
	TextRankSentence,
	Segmentation,
	TextRankWorkerClient,
	TextRankUniversalClient,
	WorkerDataTransfer,
	dataTransfer,
	MainThreadScheduler,
	mainThreadScheduler,
	AsyncAnalysisExecutor
};
//#endregion
exports.AsyncAnalysisExecutor = AsyncAnalysisExecutor;
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
exports.ErrorType = ErrorType;
exports.MainThreadScheduler = MainThreadScheduler;
exports.Segmentation = Segmentation;
exports.SentenceSegmentation = SentenceSegmentation;
exports.TextRankKeyword = TextRankKeyword;
exports.TextRankSentence = TextRankSentence;
exports.TextRankUniversalClient = TextRankUniversalClient;
exports.TextRankWorkerClient = TextRankWorkerClient;
exports.WordSegmentation = WordSegmentation;
exports.WorkerDataTransfer = WorkerDataTransfer;
exports.WorkerType = WorkerType;
exports.buildSentenceGraph = buildSentenceGraph;
exports.buildWordGraph = buildWordGraph;
exports.chainResult = chainResult;
exports.combineResults = combineResults;
exports.createError = createError;
exports.dataTransfer = dataTransfer;
exports.debug = debug;
exports.default = src_default;
exports.err = err;
exports.errOf = errOf;
exports.fromPromise = fromPromise;
exports.generateWordPairs = generateWordPairs;
exports.getDefaultSimilarity = getDefaultSimilarity;
exports.handleResult = handleResult;
exports.logError = logError;
exports.mainThreadScheduler = mainThreadScheduler;
exports.mapResult = mapResult;
exports.ok = ok;
exports.pageRank = pageRank;
exports.safeAsync = safeAsync;
exports.safeSync = safeSync;
exports.sortSentences = sortSentences;
exports.sortWords = sortWords;
exports.validateInput = validateInput;
exports.withDefault = withDefault;
exports.withTimeout = withTimeout;
