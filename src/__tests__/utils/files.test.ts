import { describe, it, expect } from 'vitest';
import { uint8ArrayToString, generateNewGuid } from '../../utils/files';

describe('uint8ArrayToString', () => {
  it('通常の UTF-8 文字列を正しく変換できる', () => {
    const input = new TextEncoder().encode('hello world');
    const result = uint8ArrayToString(input);
    expect(result).toBe('hello world');
  });

  it('空の Uint8Array → 空文字列を返す', () => {
    const input = new Uint8Array(0);
    const result = uint8ArrayToString(input);
    expect(result).toBe('');
  });

  it('日本語（マルチバイト文字）を正しく変換できる', () => {
    const text = 'こんにちは世界';
    const input = new TextEncoder().encode(text);
    const result = uint8ArrayToString(input);
    expect(result).toBe(text);
  });

  it('改行文字を含むデータを正しく処理できる', () => {
    const text = 'line1\nline2\r\nline3';
    const input = new TextEncoder().encode(text);
    const result = uint8ArrayToString(input);
    expect(result).toBe(text);
  });
});

describe('generateNewGuid', () => {
  it('32 文字の文字列を返す', () => {
    const guid = generateNewGuid();
    expect(guid).toHaveLength(32);
  });

  it('16 進数文字列（小文字）のみで構成される（/^[0-9a-f]{32}$/）', () => {
    const guid = generateNewGuid();
    expect(guid).toMatch(/^[0-9a-f]{32}$/);
  });

  it('複数回呼び出すと一意な値を返す（10000 回生成して衝突なし）', () => {
    const guids = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      guids.add(generateNewGuid());
    }
    expect(guids.size).toBe(10000);
  });
});
