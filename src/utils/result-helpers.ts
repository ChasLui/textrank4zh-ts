/**
 * Result 辅助工具函数
 * 提供统一的错误处理和 Result 操作方法
 */

import { Result } from 'typescript-result';
import { TextRankError, ErrorType, TextRankResult, AsyncTextRankResult } from '../types';

/**
 * 创建 TextRankError
 */
export function createError(
  type: ErrorType,
  message: string,
  cause?: Error,
  context?: Record<string, any>
): TextRankError {
  return {
    type,
    message,
    cause,
    context
  };
}

/**
 * 创建成功的 Result
 */
export function ok<T>(value: T): TextRankResult<T> {
  return Result.ok(value) as TextRankResult<T>;
}

/**
 * 创建失败的 Result
 */
export function err<T>(error: TextRankError): TextRankResult<T> {
  return Result.error(error);
}

/**
 * 创建失败的 Result （简化版）
 */
export function errOf<T>(
  type: ErrorType,
  message: string,
  cause?: Error,
  context?: Record<string, any>
): TextRankResult<T> {
  return Result.error(createError(type, message, cause, context));
}

/**
 * 安全执行同步函数，返回 Result
 */
export function safeSync<T>(
  fn: () => T,
  errorType: ErrorType = ErrorType.COMPUTATION_ERROR,
  context?: Record<string, any>
): TextRankResult<T> {
  try {
    const result = fn();
    return Result.ok(result) as TextRankResult<T>;
  } catch (error) {
    return Result.error(createError(
      errorType,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
      context
    )) as TextRankResult<T>;
  }
}

/**
 * 安全执行异步函数，返回 AsyncResult
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorType: ErrorType = ErrorType.COMPUTATION_ERROR,
  context?: Record<string, any>
): AsyncTextRankResult<T> {
  try {
    const result = await fn();
    return Result.ok(result) as TextRankResult<T>;
  } catch (error) {
    return Result.error(createError(
      errorType,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
      context
    )) as TextRankResult<T>;
  }
}

/**
 * 将普通的 Promise 转换为 AsyncResult
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  errorType: ErrorType = ErrorType.COMPUTATION_ERROR,
  context?: Record<string, any>
): AsyncTextRankResult<T> {
  try {
    const result = await promise;
    return Result.ok(result) as TextRankResult<T>;
  } catch (error) {
    return Result.error(createError(
      errorType,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
      context
    )) as TextRankResult<T>;
  }
}

/**
 * 检查输入参数的有效性
 */
export function validateInput(
  text: string,
  minLength = 1
): TextRankResult<string> {
  if (!text || typeof text !== 'string') {
    return errOf(
      ErrorType.VALIDATION_ERROR,
      '文本内容不能为空且必须为字符串类型',
      undefined,
      { text, type: typeof text }
    );
  }

  if (text.trim().length < minLength) {
    return errOf(
      ErrorType.VALIDATION_ERROR,
      `文本长度不能少于 ${minLength} 个字符`,
      undefined,
      { text: text.trim(), length: text.trim().length, minLength }
    );
  }

  return Result.ok(text.trim());
}

/**
 * 组合多个 Result，全部成功才返回成功
 */
export function combineResults<T>(
  results: TextRankResult<T>[]
): TextRankResult<T[]> {
  const values: T[] = [];
  
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value!);
  }
  
  return Result.ok(values);
}

/**
 * 映射 Result 的值
 */
export function mapResult<T, U>(
  result: TextRankResult<T>,
  mapper: (value: T) => U
): TextRankResult<U> {
  return result.map(mapper) as TextRankResult<U>;
}

/**
 * 链式处理 Result
 */
export function chainResult<T, U>(
  result: TextRankResult<T>,
  chainer: (value: T) => TextRankResult<U>
): TextRankResult<U> {
  if (result.ok) {
    return chainer(result.value!);
  } else {
    return result as TextRankResult<U>;
  }
}

/**
 * 提供默认值处理失败的 Result
 */
export function withDefault<T>(
  result: TextRankResult<T>,
  defaultValue: T
): T {
  return result.getOrDefault(defaultValue);
}

/**
 * 记录错误日志
 */
export function logError(error: TextRankError, prefix = 'TextRank'): void {
  console.error(`[${prefix}] ${error.type}:`, error.message);
  if (error.cause) {
    console.error('原因:', error.cause);
  }
  if (error.context) {
    console.error('上下文:', error.context);
  }
}

/**
 * 处理 Result，成功时执行 onOk，失败时执行 onErr
 */
export function handleResult<T, U>(
  result: TextRankResult<T>,
  onOk: (value: T) => U,
  onErr: (error: TextRankError) => U
): U {
  if (result.ok) {
    return onOk(result.value!);
  } else {
    return onErr(result.error!);
  }
}

/**
 * 超时处理包装器
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  context?: Record<string, any>
): AsyncTextRankResult<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(createError(
        ErrorType.TIMEOUT_ERROR,
        `操作超时（${timeoutMs}ms）`,
        undefined,
        { timeout: timeoutMs, ...context }
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return Result.ok(result) as TextRankResult<T>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('操作超时')) {
      return Result.error(error as unknown as TextRankError) as TextRankResult<T>;
    }
    return Result.error(createError(
      ErrorType.COMPUTATION_ERROR,
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
      context
    )) as TextRankResult<T>;
  }
}