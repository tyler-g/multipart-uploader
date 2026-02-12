import { UploadPartResponse } from '../shared/index.js';

// throttle any Promise-returning fn, to a certain number of concurrent executions
export async function promiseFnThrottle(
  fn: Function,
  executing: Set<unknown>,
  concurrencyLimit: number
) {
  while (executing.size >= concurrencyLimit) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.race(executing);
  }
  const promise = fn();
  executing.add(promise);
  promise.then(() => executing.delete(promise));
  return promise;
}

export function getLS(key: string): string | null {
  return localStorage.getItem(key);
}

export function getAndParseLS(key: string) {
  const dataString = getLS(key);

  if (!dataString) return null; // key doesn't exist

  try {
    return JSON.parse(dataString);
  } catch (err) {
    // invalid JSON
    return null;
  }
}

export function setLS(key: string, data: unknown): void {
  return localStorage.setItem(key, JSON.stringify(data));
}

export function removeLS(key: string): void {
  localStorage.removeItem(key);
}

export function cleanUpETags(arr: any) {
  return arr.filter((obj: UploadPartResponse) => obj.ETag);
}
