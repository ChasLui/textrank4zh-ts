/**
 * 最小 Result 实现
 * 只覆盖本库用到的 API：ok / value / error / isOk / isError / map / getOrDefault，
 * 以及静态构造 Result.ok / Result.error。
 */

export interface ResultOps<T, E> {
  /** 类型守卫：收窄为 Ok，value 变为 T */
  isOk(): this is Ok<T, E> & this;
  /** 类型守卫：收窄为 Err，error 变为 E */
  isError(): this is Err<T, E> & this;
  /** 成功时映射值，失败时原样透传 */
  map<U>(fn: (value: T) => U): Result<U, E>;
  /** 失败时返回默认值 */
  getOrDefault<D>(defaultValue: D): T | D;
}

export interface Ok<T, E> extends ResultOps<T, E> {
  readonly ok: true;
  readonly value: T;
  readonly error: undefined;
}

export interface Err<T, E> extends ResultOps<T, E> {
  readonly ok: false;
  readonly value: undefined;
  readonly error: E;
}

/** 成功或失败的判别联合，用 `ok` 判别，或用 isOk() / isError() 收窄 */
export type Result<T, E> = Ok<T, E> | Err<T, E>;

class ResultImpl<T, E> {
  constructor(
    readonly ok: boolean,
    readonly value: T | undefined,
    readonly error: E | undefined
  ) {}

  isOk(): boolean {
    return this.ok;
  }

  isError(): boolean {
    return !this.ok;
  }

  map<U>(fn: (value: T) => U): unknown {
    return this.ok ? new ResultImpl<U, E>(true, fn(this.value as T), undefined) : this;
  }

  getOrDefault<D>(defaultValue: D): T | D {
    return this.ok ? (this.value as T) : defaultValue;
  }
}

export const Result = {
  ok<T, E = never>(value: T): Result<T, E> {
    return new ResultImpl<T, E>(true, value, undefined) as unknown as Result<T, E>;
  },
  error<E, T = never>(error: E): Result<T, E> {
    return new ResultImpl<T, E>(false, undefined, error) as unknown as Result<T, E>;
  },
};
