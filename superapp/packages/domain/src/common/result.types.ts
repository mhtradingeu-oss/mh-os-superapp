export type Result<T> = SuccessResult<T> | ErrorResult;

export interface SuccessResult<T> {
  ok: true;
  data: T;
}

export interface ErrorResult {
  ok: false;
  error: string;
  details?: Record<string, unknown>;
}

export const ok = <T>(data: T): SuccessResult<T> => ({ ok: true, data });
export const err = (error: string, details?: Record<string, unknown>): ErrorResult => ({
  ok: false,
  error,
  details,
});
