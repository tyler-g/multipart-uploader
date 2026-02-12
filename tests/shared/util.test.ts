import { describe, it, expect } from 'vitest';
import { deepMerge } from '../../src/shared/util';

describe('shared | util | deepMerge', () => {
  it('returns a deep merge of two objects', () => {
    const mockObj1 = {
      foo: {
        one: 1,
      },
    };
    const mockObj2 = {
      foo: {
        two: 2,
        three: 3,
      },
      bar: 'zoo',
    };
    const expectedMergedObj = {
      foo: {
        one: 1,
        two: 2,
        three: 3,
      },
      bar: 'zoo',
    };
    expect(deepMerge(mockObj1, mockObj2)).toStrictEqual(expectedMergedObj);
  });
});
