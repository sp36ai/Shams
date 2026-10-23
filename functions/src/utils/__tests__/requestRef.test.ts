import { describe, it, expect } from 'vitest';

import { requestRef } from '../requestRef';

describe('requestRef', () => {
  it('is the first 8 characters of the requestId', () => {
    expect(requestRef('3k9x2m1a7p0q4r8s5t6u1v2w')).toBe('3k9x2m1a');
  });

  it('is absent when the request carried no id', () => {
    expect(requestRef(undefined)).toBeUndefined();
  });
});
