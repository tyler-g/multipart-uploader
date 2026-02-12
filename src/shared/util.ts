export function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export const convertMetadata = (obj: any): any | null => {
  if (!obj) return null;
  return Object.entries(obj).reduce((acc, [key, value]) => {
    // eslint-disable-next-line
    // @ts-ignore
    acc[key] = typeof value !== 'string' ? String(value) : value;
    return acc;
  }, {});
};
