import { 
  DataTransferUtils, 
  TransferableTextData, 
  WorkerType,
  TextRankResult,
  ErrorType
} from '../types';
import { safeSync, ok, errOf } from './result-helpers';

/**
 * 数据传输工具类 - 优化 Web Worker 数据传输性能
 * 使用 Transferable 对象避免数据拷贝开销，自动降级兼容不支持的环境
 */
export class WorkerDataTransfer implements DataTransferUtils {
  private readonly isTransferableSupported: boolean;
  private readonly isWorkerSupported: boolean;
  private readonly isSharedWorkerSupported: boolean;
  private readonly isTextEncoderSupported: boolean;

  constructor() {
    // 检测各种功能支持
    this.isTransferableSupported = this.detectTransferableSupport();
    this.isWorkerSupported = this.detectWorkerSupport();
    this.isSharedWorkerSupported = this.detectSharedWorkerSupport();
    this.isTextEncoderSupported = this.detectTextEncoderSupport();

    this.logSupportStatus();
  }

  /**
   * 检测 Transferable 对象支持
   */
  private detectTransferableSupport(): boolean {
    const result = safeSync(() => {
      // 检查是否存在 ArrayBuffer 和 postMessage 的 transferList 参数支持
      if (typeof ArrayBuffer === 'undefined') return false;

      // 尝试创建一个 ArrayBuffer 并检查是否可转移
      const buffer = new ArrayBuffer(1);

      // 在浏览器环境中检查 postMessage 是否支持 transferList
      if (typeof window !== 'undefined' && typeof window.postMessage === 'function') {
        return true; // 现代浏览器都支持
      }

      // 在 Worker 环境中检查
      if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
        return true;
      }

      return false;
    }, ErrorType.UNSUPPORTED_ERROR, { feature: 'transferable' });
    
    return result.ok ? result.value! : false;
  }

  /**
   * 检测 Web Worker 支持
   */
  private detectWorkerSupport(): boolean {
    const result = safeSync(
      () => typeof Worker !== 'undefined',
      ErrorType.UNSUPPORTED_ERROR,
      { feature: 'worker' }
    );
    return result.ok ? result.value! : false;
  }

  /**
   * 检测 SharedWorker 支持
   */
  private detectSharedWorkerSupport(): boolean {
    const result = safeSync(
      () => typeof SharedWorker !== 'undefined',
      ErrorType.UNSUPPORTED_ERROR,
      { feature: 'sharedWorker' }
    );
    return result.ok ? result.value! : false;
  }

  /**
   * 检测 TextEncoder/TextDecoder 支持
   */
  private detectTextEncoderSupport(): boolean {
    const result = safeSync(
      () => typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined',
      ErrorType.UNSUPPORTED_ERROR,
      { feature: 'textEncoder' }
    );
    return result.ok ? result.value! : false;
  }

  /**
   * 记录支持状态
   */
  private logSupportStatus(): void {
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('TextRank4ZH-TS 兼容性检测:', {
        sharedWorker: this.isSharedWorkerSupported ? '✅ 支持' : '❌ 不支持',
        worker: this.isWorkerSupported ? '✅ 支持' : '❌ 不支持',
        transferable: this.isTransferableSupported ? '✅ 支持' : '❌ 不支持',
        textEncoder: this.isTextEncoderSupported ? '✅ 支持' : '❌ 不支持',
      });
    }
  }
  /**
   * 将文本转换为 ArrayBuffer 格式（兼容降级版本）
   */
  textToArrayBuffer(text: string): TextRankResult<ArrayBuffer> {
    if (this.isTextEncoderSupported) {
      return safeSync(() => {
        const encoder = new TextEncoder();
        return encoder.encode(text).buffer;
      }, ErrorType.SERIALIZATION_ERROR, { text: text.substring(0, 100) });
    } else {
      // 降级：使用手动 UTF-8 编码
      return this.manualTextToArrayBuffer(text);
    }
  }

  /**
   * 将 ArrayBuffer 转换为文本（兼容降级版本）
   */
  arrayBufferToText(buffer: ArrayBuffer): TextRankResult<string> {
    if (this.isTextEncoderSupported) {
      return safeSync(() => {
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
      }, ErrorType.SERIALIZATION_ERROR, { bufferSize: buffer.byteLength });
    } else {
      // 降级：使用手动 UTF-8 解码
      return this.manualArrayBufferToText(buffer);
    }
  }

  /**
   * 手动文本到 ArrayBuffer 转换（兼容性降级）
   */
  private manualTextToArrayBuffer(text: string): TextRankResult<ArrayBuffer> {
    return safeSync(() => {
      const utf8 = [];
      for (let i = 0; i < text.length; i++) {
        let charcode = text.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        } else if (
          (charcode & 0xfc00) == 0xd800 &&
          i + 1 < text.length &&
          (text.charCodeAt(i + 1) & 0xfc00) == 0xdc00
        ) {
          // Surrogate pair
          charcode = 0x10000 + (((charcode & 0x03ff) << 10) + (text.charCodeAt(++i) & 0x03ff));
          utf8.push(
            0xf0 | (charcode >> 18),
            0x80 | ((charcode >> 12) & 0x3f),
            0x80 | ((charcode >> 6) & 0x3f),
            0x80 | (charcode & 0x3f)
          );
        } else {
          utf8.push(
            0xe0 | (charcode >> 12),
            0x80 | ((charcode >> 6) & 0x3f),
            0x80 | (charcode & 0x3f)
          );
        }
      }
      return new Uint8Array(utf8).buffer;
    }, ErrorType.SERIALIZATION_ERROR, { text: text.substring(0, 100), method: 'manual' });
  }

  /**
   * 手动 ArrayBuffer 到文本转换（兼容性降级）
   */
  private manualArrayBufferToText(buffer: ArrayBuffer): TextRankResult<string> {
    return safeSync(() => {
      const bytes = new Uint8Array(buffer);
      const length = bytes.length;
      let result = '';
      let i = 0;

      while (i < length) {
        const byte1 = bytes[i++];
        if (byte1 < 0x80) {
          result += String.fromCharCode(byte1);
        } else if (byte1 >> 5 === 0x06) {
          const byte2 = bytes[i++];
          result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
        } else if (byte1 >> 4 === 0x0e) {
          const byte2 = bytes[i++];
          const byte3 = bytes[i++];
          result += String.fromCharCode(
            ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
          );
        } else if (byte1 >> 3 === 0x1e) {
          const byte2 = bytes[i++];
          const byte3 = bytes[i++];
          const byte4 = bytes[i++];
          const codepoint =
            ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
          result += String.fromCharCode(
            0xd800 + ((codepoint - 0x10000) >> 10),
            0xdc00 + ((codepoint - 0x10000) & 0x3ff)
          );
        }
      }
      return result;
    }, ErrorType.SERIALIZATION_ERROR, { bufferSize: buffer.byteLength, method: 'manual' });
  }

  /**
   * 将对象序列化为 ArrayBuffer
   */
  serializeToArrayBuffer<T>(obj: T): TextRankResult<ArrayBuffer> {
    return safeSync(() => {
      const jsonString = JSON.stringify(obj);
      const bufferResult = this.textToArrayBuffer(jsonString);
      if (!bufferResult.ok) {
        throw new Error(bufferResult.error!.message);
      }
      return bufferResult.value;
    }, ErrorType.SERIALIZATION_ERROR, { objectType: typeof obj });
  }

  /**
   * 将 ArrayBuffer 反序列化为对象
   */
  deserializeFromArrayBuffer<T>(buffer: ArrayBuffer): TextRankResult<T> {
    const textResult = this.arrayBufferToText(buffer);
    if (!textResult.ok) {
      return {
        ok: false,
        error: textResult.error
      } as TextRankResult<T>;
    }
    
    return safeSync(() => JSON.parse(textResult.value), ErrorType.SERIALIZATION_ERROR, { bufferSize: buffer.byteLength });
  }

  /**
   * 创建可传输的文本数据
   */
  createTransferableTextData(text: string): TextRankResult<TransferableTextData> {
    return this.textToArrayBuffer(text)
      .map(textBuffer => ({
        textBuffer,
        textLength: text.length,
        encoding: 'utf-8' as const,
      }));
  }

  /**
   * 从可传输数据中提取文本
   */
  extractTextFromTransferableData(data: TransferableTextData): TextRankResult<string> {
    return this.arrayBufferToText(data.textBuffer);
  }

  /**
   * 批量序列化数据为 Transferable 格式
   */
  batchSerialize(data: Record<string, any>): TextRankResult<{
    serializedData: Record<string, ArrayBuffer>;
    transferables: Transferable[];
  }> {
    return safeSync(() => {
      const serializedData: Record<string, ArrayBuffer> = {};
      const transferables: Transferable[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null) {
          const bufferResult = this.serializeToArrayBuffer(value);
          if (bufferResult.ok === false) {
            throw new Error(`序列化键 '${key}' 失败: ${bufferResult.error.message}`);
          }
          const buffer = bufferResult.value;
          serializedData[key] = buffer;
          transferables.push(buffer);
        }
      }

      return { serializedData, transferables };
    }, ErrorType.SERIALIZATION_ERROR, { dataKeys: Object.keys(data) });
  }

  /**
   * 批量反序列化数据
   */
  batchDeserialize<T extends Record<string, any>>(serializedData: Record<string, ArrayBuffer>): TextRankResult<T> {
    return safeSync(() => {
      const result: Record<string, any> = {};

      for (const [key, buffer] of Object.entries(serializedData)) {
        const deserializeResult = this.deserializeFromArrayBuffer(buffer);
        if (deserializeResult.ok === false) {
          throw new Error(`反序列化键 '${key}' 失败: ${deserializeResult.error.message}`);
        }
        result[key] = deserializeResult.value;
      }

      return result as T;
    }, ErrorType.SERIALIZATION_ERROR, { dataKeys: Object.keys(serializedData) });
  }

  /**
   * 检查数据大小是否适合使用 Transferable
   * 只有当数据足够大且环境支持时，使用 Transferable 才有性能优势
   */
  shouldUseTransferable(data: any, threshold: number = 1024): TextRankResult<boolean> {
    // 首先检查环境支持
    if (!this.isTransferableSupported) {
      return ok(false);
    }

    const result = safeSync(() => {
      const serialized = JSON.stringify(data);
      return serialized.length > threshold;
    }, ErrorType.VALIDATION_ERROR, { threshold });
    
    if (!result.ok) {
      // 序列化失败，不使用 Transferable
      return ok(false);
    }
    
    return result;
  }

  /**
   * 智能选择传输方式（带兼容性检测）
   */
  prepareDataForTransfer(data: any): {
    transferData: any;
    transferables?: Transferable[];
    useTransferable: boolean;
  } {
    const shouldUseResult = this.shouldUseTransferable(data);
    if (shouldUseResult.ok === false) {
      return {
        transferData: data,
        useTransferable: false,
      };
    }

    const useTransferable = shouldUseResult.value;
    if (useTransferable) {
      const serializeResult = this.batchSerialize(data);
      if (serializeResult.ok === false) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('TextRank4ZH-TS: Transferable 准备失败，降级到传统传输:', serializeResult.error.message);
        }
        return {
          transferData: data,
          useTransferable: false,
        };
      }

      const { serializedData, transferables } = serializeResult.value;
      return {
        transferData: { __transferable: true, data: serializedData },
        transferables,
        useTransferable: true,
      };
    }

    return {
      transferData: data,
      useTransferable: false,
    };
  }

  /**
   * 处理接收到的数据（带错误处理）
   */
  processReceivedData(data: any): any {
    if (data && data.__transferable === true) {
      if (!this.isTransferableSupported) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('TextRank4ZH-TS: 收到 Transferable 数据但环境不支持，尝试降级处理');
        }
      }

      const deserializeResult = this.batchDeserialize(data.data);
      if (deserializeResult.ok === false) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('TextRank4ZH-TS: 数据处理失败，返回原始数据:', deserializeResult.error.message);
        }
        return data.data || data;
      }
      return deserializeResult.value;
    }
    return data;
  }

  /**
   * 获取环境支持状态
   */
  getSupportStatus(): {
    sharedWorker: boolean;
    worker: boolean;
    transferable: boolean;
    textEncoder: boolean;
  } {
    return {
      sharedWorker: this.isSharedWorkerSupported,
      worker: this.isWorkerSupported,
      transferable: this.isTransferableSupported,
      textEncoder: this.isTextEncoderSupported,
    };
  }

  /**
   * 获取推荐的 Worker 类型
   */
  getRecommendedWorkerType(): WorkerType {
    if (this.isSharedWorkerSupported) {
      return WorkerType.SHARED;
    } else if (this.isWorkerSupported) {
      return WorkerType.DEDICATED;
    } else {
      return WorkerType.SYNC;
    }
  }

  /**
   * 安全的批量序列化（带错误处理）
   */
  safeBatchSerialize(data: Record<string, any>): {
    serializedData: Record<string, ArrayBuffer>;
    transferables: Transferable[];
    success: boolean;
    error?: string;
  } {
    const result = this.batchSerialize(data);
    if (!result.ok) {
      return {
        serializedData: {},
        transferables: [],
        success: false,
        error: result.error.message,
      };
    }
    
    return {
      ...result.value,
      success: true,
    };
  }

  /**
   * 安全的批量反序列化（带错误处理）
   */
  safeBatchDeserialize<T extends Record<string, any>>(
    serializedData: Record<string, ArrayBuffer>
  ): {
    data: T | null;
    success: boolean;
    error?: string;
  } {
    const result = this.batchDeserialize<T>(serializedData);
    if (!result.ok) {
      return {
        data: null,
        success: false,
        error: result.error.message,
      };
    }
    
    return {
      data: result.value,
      success: true,
    };
  }
}

/**
 * 单例模式的数据传输工具
 */
export const dataTransfer = new WorkerDataTransfer();
