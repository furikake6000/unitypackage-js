import { describe, it, expect } from 'vitest';
import { hello } from './index';

describe('pkg', () => {
  it('should demonstrate this is a package', () => {
    expect(hello()).toBe('Hello from unitypackage-js');
  });
});
