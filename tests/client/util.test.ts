import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLS,
  getAndParseLS,
  setLS,
  removeLS,
  cleanUpETags,
} from '../../src/client/util';

describe('client | util | local storage helpers', () => {
  beforeEach(() => {
    // Clear localStorage before each test to prevent state leakage
    localStorage.clear();
  });
  it('set and get a LocalStorage item', () => {
    const mockLocalStorageKey = 'video|random-file.mov';
    setLS(mockLocalStorageKey, {});
    expect(getLS(mockLocalStorageKey)).toBe('{}');
  });
  it('set and get + parse a LocalStorage item', () => {
    const mockLocalStorageKey = 'video|random-file.mov';
    const mockLocalStorageRecord = {
      foo: 'bar',
    };
    setLS(mockLocalStorageKey, mockLocalStorageRecord);
    expect(getAndParseLS(mockLocalStorageKey)).toStrictEqual(
      mockLocalStorageRecord
    );
  });
  it('set and remove a LocalStorage item', () => {
    const mockLocalStorageKey = 'video|random-file.mov';
    setLS(mockLocalStorageKey, {});
    removeLS(mockLocalStorageKey);
    expect(getLS(mockLocalStorageKey)).toBe(null);
  });
});

describe('client | util | cleanup helpers', () => {
  it('remove null ETags when using cleanUpETags fn', () => {
    const mockUploadPartResponseArr = [
      {
        PartNumber: 2,
        ETag: '123412341234123412341234',
      },
      {
        PartNumber: 1,
        ETag: '123412341234123412341234',
      },
      {
        PartNumber: 3,
        ETag: null,
      },
    ];
    const mockExpectedUploadPartResponseArr = [
      {
        PartNumber: 2,
        ETag: '123412341234123412341234',
      },
      {
        PartNumber: 1,
        ETag: '123412341234123412341234',
      },
    ];
    expect(cleanUpETags(mockUploadPartResponseArr)).toStrictEqual(
      mockExpectedUploadPartResponseArr
    );
  });
});
