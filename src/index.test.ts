import { describe, it, expect } from 'vitest';
import { hello } from './index';

// TODO: 別のテストが追加されたら削除する
describe('pkg', () => {
  it('should demonstrate this is a package', () => {
    expect(hello()).toBe('Hello from unitypackage-js');
  });
});
