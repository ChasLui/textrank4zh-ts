export declare type AdjacencyMatrix = number[][];

export declare interface AnalysisProgress {
    phase: 'segmentation' | 'graph_building' | 'pagerank' | 'sorting' | 'complete';
    progress: number;
    message: string;
    details?: {
        totalItems?: number;
        processedItems?: number;
        iterations?: number;
        maxIterations?: number;
    };
}

export declare interface AsyncAnalysisConfig {
    onProgress?: ProgressCallback | undefined;
    timeSlice?: number;
    maxContinuousTime?: number;
    yieldInterval?: number;
    priority?: 'background' | 'normal' | 'user-blocking';
}

export declare class AsyncAnalysisExecutor {
    private static createProgressReporter;
    static executeSegmentation<T>(segmentationFn: () => T, config: AsyncAnalysisConfig, reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>): AsyncTextRankResult<T>;
    static executeGraphBuilding<T>(graphBuildingFn: () => T, config: AsyncAnalysisConfig, reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>, itemCount?: number): AsyncTextRankResult<T>;
    static executePageRank<T>(pageRankFn: (progressCallback?: (iteration: number, maxIterations: number) => void) => T, config: AsyncAnalysisConfig, reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>, maxIterations?: number): AsyncTextRankResult<T>;
    static executeSorting<T>(sortingFn: () => T, config: AsyncAnalysisConfig, reportProgress: ReturnType<typeof AsyncAnalysisExecutor.createProgressReporter>): AsyncTextRankResult<T>;
    static executeFullAnalysis<T>(phases: {
        segmentation: () => unknown;
        graphBuilding: () => unknown;
        pageRank: (progressCallback?: (iteration: number, max: number) => void) => unknown;
        sorting: () => T;
    }, config: AsyncAnalysisConfig, options?: {
        itemCount?: number;
        maxIterations?: number;
    }): AsyncTextRankResult<T>;
    static getDefaultAsyncConfig(overrides?: Partial<AsyncAnalysisConfig>): AsyncAnalysisConfig;
}

export declare interface AsyncTextRankKeywordConfig extends TextRankKeywordConfig, AsyncAnalysisConfig {
}

export declare type AsyncTextRankResult<T> = Promise<Result<T, TextRankError>>;

export declare interface AsyncTextRankSentenceConfig extends TextRankSentenceConfig, AsyncAnalysisConfig {
}

export declare function buildSentenceGraph(sentences: string[], words: string[][], similarityFunc?: SimilarityFunction): AdjacencyMatrix;

export declare function buildWordGraph(vertexWords: string[][], edgeWords: string[][], window?: number): {
    adjacencyMatrix: AdjacencyMatrix;
    wordIndex: Map<string, number>;
    indexWord: Map<number, string>;
};

export declare function chainResult<T, U>(result: TextRankResult<T>, chainer: (value: T) => TextRankResult<U>): TextRankResult<U>;

export declare function combineResults<T>(results: TextRankResult<T>[]): TextRankResult<T[]>;

export declare function createError(type: ErrorType, message: string, cause?: Error, context?: Record<string, unknown>): TextRankError;

export declare const dataTransfer: WorkerDataTransfer;

export declare interface DataTransferUtils {
    textToArrayBuffer(text: string): TextRankResult<ArrayBuffer>;
    arrayBufferToText(buffer: ArrayBuffer): TextRankResult<string>;
    serializeToArrayBuffer<T>(obj: T): TextRankResult<ArrayBuffer>;
    deserializeFromArrayBuffer<T>(buffer: ArrayBuffer): TextRankResult<T>;
}

export declare function debug(...args: unknown[]): void;

declare const _default: {
    TextRankKeyword: typeof TextRankKeyword;
    TextRankSentence: typeof TextRankSentence;
    Segmentation: typeof Segmentation;
    TextRankWorkerClient: typeof TextRankWorkerClient;
    TextRankUniversalClient: typeof TextRankUniversalClient;
    WorkerDataTransfer: typeof WorkerDataTransfer;
    dataTransfer: WorkerDataTransfer;
    MainThreadScheduler: typeof MainThreadScheduler;
    mainThreadScheduler: MainThreadScheduler;
    AsyncAnalysisExecutor: typeof AsyncAnalysisExecutor;
};
export default _default;

export declare const DEFAULT_CONFIG: {
    readonly SENTENCE_DELIMITERS: readonly ["?", "!", ";", "？", "！", "。", "；", "……", "…", "\n"];
    readonly ALLOW_SPEECH_TAGS: readonly ["an", "i", "j", "l", "n", "nr", "nrfg", "ns", "nt", "nz", "t", "v", "vd", "vn", "eng"];
    readonly PAGERANK: {
        readonly alpha: 0.85;
        readonly maxIterations: 100;
        readonly tolerance: 0.000001;
    };
};

export declare interface Err<T, E> extends ResultOps<T, E> {
    readonly ok: false;
    readonly value: undefined;
    readonly error: E;
}

export declare function err<T>(error: TextRankError): TextRankResult<T>;

export declare function errOf<T>(type: ErrorType, message: string, cause?: Error, context?: Record<string, unknown>): TextRankResult<T>;

export declare enum ErrorType {
    INITIALIZATION_ERROR = "INITIALIZATION_ERROR",
    WORKER_ERROR = "WORKER_ERROR",
    COMPUTATION_ERROR = "COMPUTATION_ERROR",
    SERIALIZATION_ERROR = "SERIALIZATION_ERROR",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    UNSUPPORTED_ERROR = "UNSUPPORTED_ERROR"
}

export declare function fromPromise<T>(promise: Promise<T>, errorType?: ErrorType, context?: Record<string, unknown>): AsyncTextRankResult<T>;

export declare function generateWordPairs(wordList: string[], window?: number): Generator<[string, string]>;

export declare const getDefaultSimilarity: SimilarityFunction;

export declare function handleResult<T, U>(result: TextRankResult<T>, onOk: (value: T) => U, onErr: (error: TextRankError) => U): U;

export declare interface KeywordItem {
    word: string;
    weight: number;
}

export declare function logError(error: TextRankError, prefix?: string): void;

export declare class MainThreadScheduler {
    private capabilities;
    private runningTasks;
    private taskQueue;
    constructor();
    private detectCapabilities;
    private logCapabilities;
    getRecommendedSchedulingMethod(): 'background-task' | 'promise' | 'sync';
    scheduleTask<T>(taskFn: () => T | Promise<T>, options?: SchedulerOptions): Promise<TextRankResult<T>>;
    private executeWithBackgroundTask;
    private executeWithPromise;
    private executeSync;
    scheduleBatch<T>(tasks: Array<() => T | Promise<T>>, options?: SchedulerOptions): Promise<TextRankResult<T[]>>;
    cancelTask(taskId: string): boolean;
    cancelAllTasks(): void;
    getStatus(): {
        runningTasks: number;
        queuedTasks: number;
        capabilities: SchedulerCapabilities;
        recommendedMethod: string;
    };
    measureMainThreadBusyness(): Promise<TextRankResult<{
        averageFrameTime: number;
        isBlocked: boolean;
        recommendation: 'aggressive' | 'moderate' | 'conservative';
    }>>;
}

export declare const mainThreadScheduler: MainThreadScheduler;

export declare function mapResult<T, U>(result: TextRankResult<T>, mapper: (value: T) => U): TextRankResult<U>;

export declare interface Ok<T, E> extends ResultOps<T, E> {
    readonly ok: true;
    readonly value: T;
    readonly error: undefined;
}

export declare function ok<T>(value: T): TextRankResult<T>;

export declare function pageRank(adjacencyMatrix: AdjacencyMatrix, config?: PageRankConfig): PageRankResult;

export declare interface PageRankConfig {
    alpha?: number;
    maxIterations?: number;
    tolerance?: number;
}

export declare interface PageRankResult {
    scores: number[];
    iterations: number;
}

export declare type ProgressCallback = (progress: AnalysisProgress) => void;

export declare type Result<T, E> = Ok<T, E> | Err<T, E>;

export declare const Result: {
    ok<T, E = never>(value: T): Result<T, E>;
    error<E, T = never>(error: E): Result<T, E>;
};

export declare interface ResultOps<T, E> {
    isOk(): this is Ok<T, E> & this;
    isError(): this is Err<T, E> & this;
    map<U>(fn: (value: T) => U): Result<U, E>;
    getOrDefault<D>(defaultValue: D): T | D;
}

export declare function safeAsync<T>(fn: () => Promise<T>, errorType?: ErrorType, context?: Record<string, unknown>): AsyncTextRankResult<T>;

export declare function safeSync<T>(fn: () => T, errorType?: ErrorType, context?: Record<string, unknown>): TextRankResult<T>;

declare interface SchedulerCapabilities {
    requestIdleCallback: boolean;
    scheduler: boolean;
    messageChannel: boolean;
    postTaskScheduler: boolean;
}

declare interface SchedulerOptions {
    timeSlice?: number;
    maxContinuousTime?: number;
    idleTimeout?: number;
    yieldInterval?: number;
    priority?: 'background' | 'normal' | 'user-blocking';
}

export declare class Segmentation {
    private wordSegmentation;
    private sentenceSegmentation;
    constructor(config?: SegmentationConfig);
    segment(text: string, options?: {
        lower?: boolean;
    }): SegmentationResult;
}

export declare interface SegmentationConfig {
    stopWords?: string[];
    allowSpeechTags?: string[];
    delimiters?: string[];
    tokenizer?: ((text: string) => string[]) | undefined;
}

export declare interface SegmentationResult {
    sentences: string[];
    wordsNoFilter: string[][];
    wordsNoStopWords: string[][];
    wordsAllFilters: string[][];
}

export declare interface SentenceItem {
    index: number;
    sentence: string;
    weight: number;
}

export declare class SentenceSegmentation {
    private delimiters;
    constructor(delimiters?: readonly string[]);
    segment(text: string): string[];
}

export declare type SimilarityFunction = (words1: string[], words2: string[]) => number;

export declare function sortSentences(sentences: string[], words: string[][], similarityFunc?: SimilarityFunction, pageRankConfig?: PageRankConfig): SentenceItem[];

export declare function sortWords(vertexWords: string[][], edgeWords: string[][], window?: number, pageRankConfig?: PageRankConfig): KeywordItem[];

export declare interface SyncModeHandlers {
    analyzeKeywords: (text: string, config?: TextRankKeywordConfig, options?: WorkerTaskConfig['options']) => Promise<WorkerResult['data']>;
    analyzeSentences: (text: string, config?: TextRankSentenceConfig, options?: WorkerTaskConfig['options']) => Promise<WorkerResult['data']>;
}

export declare interface TextRankError {
    type: ErrorType;
    message: string;
    cause?: Error;
    context?: Record<string, unknown>;
}

export declare class TextRankKeyword {
    private segmentation;
    private text;
    private keywords;
    private segmentationResult;
    constructor(config?: SegmentationConfig);
    analyze(text: string, config?: TextRankKeywordConfig): TextRankResult<void>;
    analyzeAsync(text: string, config?: AsyncTextRankKeywordConfig): AsyncTextRankResult<void>;
    private performTextRankAnalysis;
    private getWordSource;
    getKeywords(num?: number, wordMinLen?: number): KeywordItem[];
    getKeyphrases(keywordsNum?: number, minOccurNum?: number): string[];
    get sentences(): string[];
    get wordsNoFilter(): string[][];
    get wordsNoStopWords(): string[][];
    get wordsAllFilters(): string[][];
}

export declare interface TextRankKeywordConfig {
    window?: number;
    lower?: boolean;
    vertexSource?: 'no_filter' | 'no_stop_words' | 'all_filters';
    edgeSource?: 'no_filter' | 'no_stop_words' | 'all_filters';
    pageRankConfig?: PageRankConfig;
}

export declare type TextRankResult<T> = Result<T, TextRankError>;

export declare class TextRankSentence {
    private segmentation;
    private segmentationResult;
    private keySentences;
    constructor(config?: SegmentationConfig);
    analyze(text: string, config?: TextRankSentenceConfig): TextRankResult<void>;
    analyzeAsync(text: string, config?: AsyncTextRankSentenceConfig): AsyncTextRankResult<void>;
    private getWordSource;
    getKeySentences(num?: number, sentenceMinLen?: number): SentenceItem[];
    getSummary(num?: number, sentenceMinLen?: number, sortByIndex?: boolean): string;
    analyzeWithSimilarityFunc(text: string, similarityFunc: SimilarityFunction, config?: TextRankSentenceConfig): TextRankResult<void>;
    analyzeWithSimilarityFuncAsync(text: string, similarityFunc: SimilarityFunction, config?: AsyncTextRankSentenceConfig): AsyncTextRankResult<void>;
    get sentences(): string[];
    get wordsNoFilter(): string[][];
    get wordsNoStopWords(): string[][];
    get wordsAllFilters(): string[][];
    getSentenceWeights(): Array<{
        index: number;
        sentence: string;
        weight: number;
    }>;
}

export declare interface TextRankSentenceConfig {
    lower?: boolean;
    source?: 'no_filter' | 'no_stop_words' | 'all_filters';
    pageRankConfig?: PageRankConfig;
}

export declare class TextRankUniversalClient {
    private workerUrl;
    private options;
    private currentWorkerType;
    private worker;
    private sharedWorkerPort;
    private pendingTasks;
    private syncHandlers;
    private connectionCount;
    private isInitialized;
    constructor(workerUrl: string, options?: WorkerOptions_2);
    private selectWorkerType;
    private initSyncHandlers;
    private initializeWorker;
    private initSharedWorker;
    private initDedicatedWorker;
    private waitForWorkerReady;
    private fallbackToNextWorkerType;
    private handleMessage;
    private handleError;
    private postMessage;
    analyzeKeywords(text: string, config?: TextRankKeywordConfig, options?: WorkerTaskConfig['options']): Promise<WorkerResult>;
    analyzeSentences(text: string, config?: TextRankSentenceConfig, options?: WorkerTaskConfig['options']): Promise<WorkerResult>;
    private executeWorkerTask;
    getStatus(): WorkerStatus;
    getDetailedStatus(): Promise<WorkerStatus & {
        schedulerStatus?: ReturnType<typeof mainThreadScheduler.getStatus>;
        mainThreadBusyness?: Awaited<ReturnType<typeof mainThreadScheduler.measureMainThreadBusyness>>;
    }>;
    optimizeSyncScheduling(): Promise<TextRankResult<void>>;
    getPendingTasksCount(): number;
    terminate(): void;
    static supportsWorkerType(type: WorkerType_2): boolean;
    static getRecommendedWorkerType(): WorkerType_2;
}

export declare class TextRankWorkerClient {
    private worker;
    private pendingTasks;
    private taskCounter;
    private workerUrl;
    private options;
    private isWorkerSupported;
    private supportStatus;
    constructor(workerUrl?: string, options?: WorkerOptions_2);
    private detectWorkerSupport;
    private logCompatibilityStatus;
    private initWorker;
    private createWorkerUrl;
    private handleWorkerMessage;
    private sendTask;
    analyzeKeywords(text: string, config?: TextRankKeywordConfig, options?: {
        keywords?: {
            num?: number;
            wordMinLen?: number;
        };
        keyphrases?: {
            keywordsNum?: number;
            minOccurNum?: number;
        };
    }): Promise<{
        keywords?: KeywordItem[];
        keyphrases?: string[];
        duration: number;
    }>;
    analyzeSentences(text: string, config?: TextRankSentenceConfig, options?: {
        sentences?: {
            num?: number;
            sentenceMinLen?: number;
        };
        summary?: {
            num?: number;
            sentenceMinLen?: number;
            sortByIndex?: boolean;
        };
    }): Promise<{
        sentences?: SentenceItem[];
        summary?: string;
        duration: number;
    }>;
    analyzeText(text: string, keywordConfig?: TextRankKeywordConfig, sentenceConfig?: TextRankSentenceConfig, options?: {
        keywords?: {
            num?: number;
            wordMinLen?: number;
        };
        keyphrases?: {
            keywordsNum?: number;
            minOccurNum?: number;
        };
        sentences?: {
            num?: number;
            sentenceMinLen?: number;
        };
        summary?: {
            num?: number;
            sentenceMinLen?: number;
            sortByIndex?: boolean;
        };
    }): Promise<{
        keywords?: KeywordItem[];
        keyphrases?: string[];
        sentences?: SentenceItem[];
        summary?: string;
        totalDuration: number;
    }>;
    getStatus(): {
        pendingTasks: number;
        maxConcurrent: number;
        workerReady: boolean;
        workerSupported: boolean;
        transferableSupported: boolean;
    };
    getCompatibilityInfo(): {
        worker: {
            supported: boolean;
            available: boolean;
        };
        transferable: {
            supported: boolean;
        };
        textEncoder: {
            supported: boolean;
        };
        recommendations: string[];
    };
    healthCheck(): Promise<TextRankResult<{
        healthy: boolean;
        latency?: number;
    }>>;
    terminate(): void;
}

export declare interface TransferableResultData {
    keywords?: ArrayBuffer;
    sentences?: ArrayBuffer;
    keyphrases?: ArrayBuffer;
    summary?: ArrayBuffer;
    segmentation?: ArrayBuffer;
}

export declare interface TransferableTextData {
    textBuffer: ArrayBuffer;
    textLength: number;
    encoding: string;
}

export declare function validateInput(text: string, minLength?: number): TextRankResult<string>;

export declare function withDefault<T>(result: TextRankResult<T>, defaultValue: T): T;

export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, context?: Record<string, unknown>): AsyncTextRankResult<T>;

export declare class WordSegmentation {
    private stopWords;
    private allowSpeechTags;
    private jieba;
    private customTokenizer;
    constructor(config?: SegmentationConfig);
    private initJieba;
    private createFallbackSegmenter;
    private loadStopWords;
    segment(text: string, options?: {
        lower?: boolean;
        useStopWords?: boolean;
        useSpeechTagsFilter?: boolean;
    }): string[];
    segmentSentences(sentences: string[], options?: {
        lower?: boolean;
        useStopWords?: boolean;
        useSpeechTagsFilter?: boolean;
    }): string[][];
}

export declare interface WordWithPos {
    word: string;
    pos: string;
}

export declare class WorkerDataTransfer implements DataTransferUtils {
    private readonly isTransferableSupported;
    private readonly isWorkerSupported;
    private readonly isSharedWorkerSupported;
    private readonly isTextEncoderSupported;
    constructor();
    private detectTransferableSupport;
    private detectWorkerSupport;
    private detectSharedWorkerSupport;
    private detectTextEncoderSupport;
    private logSupportStatus;
    textToArrayBuffer(text: string): TextRankResult<ArrayBuffer>;
    arrayBufferToText(buffer: ArrayBuffer): TextRankResult<string>;
    private manualTextToArrayBuffer;
    private manualArrayBufferToText;
    serializeToArrayBuffer<T>(obj: T): TextRankResult<ArrayBuffer>;
    deserializeFromArrayBuffer<T>(buffer: ArrayBuffer): TextRankResult<T>;
    createTransferableTextData(text: string): TextRankResult<TransferableTextData>;
    extractTextFromTransferableData(data: TransferableTextData): TextRankResult<string>;
    batchSerialize(data: Record<string, unknown>): TextRankResult<{
        serializedData: Record<string, ArrayBuffer>;
        transferables: Transferable[];
    }>;
    batchDeserialize<T extends Record<string, unknown>>(serializedData: Record<string, ArrayBuffer>): TextRankResult<T>;
    shouldUseTransferable(data: unknown, threshold?: number): TextRankResult<boolean>;
    prepareDataForTransfer(data: unknown): {
        transferData: unknown;
        transferables?: Transferable[];
        useTransferable: boolean;
    };
    processReceivedData(data: unknown): unknown;
    getSupportStatus(): {
        sharedWorker: boolean;
        worker: boolean;
        transferable: boolean;
        textEncoder: boolean;
    };
    getRecommendedWorkerType(): WorkerType_2;
    safeBatchSerialize(data: Record<string, unknown>): {
        serializedData: Record<string, ArrayBuffer>;
        transferables: Transferable[];
        success: boolean;
        error?: string;
    };
    safeBatchDeserialize<T extends Record<string, unknown>>(serializedData: Record<string, ArrayBuffer>): {
        data: T | null;
        success: boolean;
        error?: string;
    };
}

export declare interface WorkerMessage {
    id: string;
    type: 'analyze_keywords' | 'analyze_sentences' | 'error' | 'result';
    payload?: unknown;
    transferable?: Transferable[];
}

declare interface WorkerOptions_2 {
    timeout?: number;
    maxConcurrent?: number;
    preferredWorkerType?: 'shared' | 'dedicated' | 'auto';
    fallbackToSync?: boolean;
    syncScheduling?: {
        timeSlice?: number;
        maxContinuousTime?: number;
        idleTimeout?: number;
        yieldInterval?: number;
        priority?: 'background' | 'normal' | 'user-blocking';
    };
}
export { WorkerOptions_2 as WorkerOptions }

export declare interface WorkerResult {
    id: string;
    success: boolean;
    data?: {
        keywords?: KeywordItem[];
        sentences?: SentenceItem[];
        keyphrases?: string[];
        summary?: string;
        segmentation?: SegmentationResult;
    };
    error?: string;
    duration?: number;
}

export declare interface WorkerStatus {
    type: WorkerType_2;
    supported: boolean;
    available: boolean;
    connectionCount?: number;
}

export declare interface WorkerTaskConfig {
    text: string;
    config?: TextRankKeywordConfig | TextRankSentenceConfig;
    options?: {
        keywords?: {
            num?: number;
            wordMinLen?: number;
        };
        sentences?: {
            num?: number;
            sentenceMinLen?: number;
        };
        keyphrases?: {
            keywordsNum?: number;
            minOccurNum?: number;
        };
        summary?: {
            num?: number;
            sentenceMinLen?: number;
            sortByIndex?: boolean;
        };
    };
}

declare enum WorkerType_2 {
    SHARED = "shared",
    DEDICATED = "dedicated",
    SYNC = "sync"
}
export { WorkerType_2 as WorkerType }

export { }
