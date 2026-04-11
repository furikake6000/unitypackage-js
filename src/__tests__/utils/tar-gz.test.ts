import { describe, it, expect } from 'vitest';
import {
  extractTarGz,
  compressTarGz,
  addOriginalNameToGzip,
} from '../../utils/tar-gz';
import type { TarGzEntry } from '../../utils/tar-gz';

// テスト用のシンプルな tar.gz を作成するヘルパー
async function createSimpleTarGz(
  files: Record<string, string>,
): Promise<ArrayBuffer> {
  const entries = new Map<string, TarGzEntry>();
  for (const [name, content] of Object.entries(files)) {
    entries.set(name, {
      name,
      data: new TextEncoder().encode(content),
      isDirectory: false,
    });
  }
  return compressTarGz(entries);
}

// テスト用の最小限の gzip バッファを作成するヘルパー
function createMinimalGzipBuffer(
  payloadBytes: number[] = [0x03, 0x00],
): ArrayBuffer {
  // gzip ヘッダー: ID1, ID2, CM, FLG, MTIME(4バイト), XFL, OS
  const header = [0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff];
  const data = [...header, ...payloadBytes];
  return new Uint8Array(data).buffer;
}

describe('extractTarGz', () => {
  describe('正常ケース', () => {
    it('正常な tar.gz を展開してファイル一覧が取得できる', async () => {
      const compressed = await createSimpleTarGz({ 'test.txt': 'hello' });
      const result = await extractTarGz(compressed);

      expect(result.size).toBe(1);
      expect(result.has('test.txt')).toBe(true);
      const entry = result.get('test.txt')!;
      expect(entry.name).toBe('test.txt');
      expect(entry.isDirectory).toBe(false);
    });

    it('複数ファイルを含む tar.gz を展開できる', async () => {
      const compressed = await createSimpleTarGz({
        'file1.txt': 'content1',
        'file2.txt': 'content2',
        'file3.txt': 'content3',
      });
      const result = await extractTarGz(compressed);

      expect(result.size).toBe(3);
      expect(result.has('file1.txt')).toBe(true);
      expect(result.has('file2.txt')).toBe(true);
      expect(result.has('file3.txt')).toBe(true);
    });

    it('サブディレクトリ構造を含む tar.gz → パスが正しく保持される', async () => {
      const entries = new Map<string, TarGzEntry>();
      entries.set('dir/subdir/file.txt', {
        name: 'dir/subdir/file.txt',
        data: new TextEncoder().encode('nested content'),
        isDirectory: false,
      });
      const compressed = await compressTarGz(entries);
      const result = await extractTarGz(compressed);

      expect(result.has('dir/subdir/file.txt')).toBe(true);
    });

    it('ディレクトリエントリとファイルエントリが区別される（isDirectory）', async () => {
      const entries = new Map<string, TarGzEntry>();
      entries.set('mydir/', {
        name: 'mydir/',
        data: new Uint8Array(0),
        isDirectory: true,
      });
      entries.set('mydir/file.txt', {
        name: 'mydir/file.txt',
        data: new TextEncoder().encode('file content'),
        isDirectory: false,
      });
      const compressed = await compressTarGz(entries);
      const result = await extractTarGz(compressed);

      const dirEntry = result.get('mydir/');
      const fileEntry = result.get('mydir/file.txt');

      expect(dirEntry?.isDirectory).toBe(true);
      expect(fileEntry?.isDirectory).toBe(false);
    });
  });

  describe('エラーケース', () => {
    it('空の ArrayBuffer → エラーがスローされる', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      await expect(extractTarGz(emptyBuffer)).rejects.toThrow();
    });

    it('不正な gzip データ → エラーがスローされる', async () => {
      const invalidData = new Uint8Array(20);
      invalidData.fill(0xff);
      await expect(extractTarGz(invalidData.buffer)).rejects.toThrow();
    });
  });
});

describe('compressTarGz', () => {
  it('ファイルエントリを tar.gz に圧縮できる', async () => {
    const entries = new Map<string, TarGzEntry>();
    entries.set('test.txt', {
      name: 'test.txt',
      data: new TextEncoder().encode('hello world'),
      isDirectory: false,
    });

    const result = await compressTarGz(entries);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
    // gzip マジックナンバーの確認
    const view = new Uint8Array(result);
    expect(view[0]).toBe(0x1f);
    expect(view[1]).toBe(0x8b);
  });

  it('空の Map → 正常な tar.gz（0ファイル）が出力される', async () => {
    const entries = new Map<string, TarGzEntry>();

    const result = await compressTarGz(entries);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
    const view = new Uint8Array(result);
    expect(view[0]).toBe(0x1f);
    expect(view[1]).toBe(0x8b);
  });

  it('ディレクトリエントリを含む圧縮ができる', async () => {
    const entries = new Map<string, TarGzEntry>();
    entries.set('mydir/', {
      name: 'mydir/',
      data: new Uint8Array(0),
      isDirectory: true,
    });

    const result = await compressTarGz(entries);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);
  });

  it('圧縮→展開のラウンドトリップでデータが保持される', async () => {
    const originalData = new TextEncoder().encode('round trip test content');
    const entries = new Map<string, TarGzEntry>();
    entries.set('roundtrip.txt', {
      name: 'roundtrip.txt',
      data: originalData,
      isDirectory: false,
    });

    const compressed = await compressTarGz(entries);
    const extracted = await extractTarGz(compressed);

    expect(extracted.has('roundtrip.txt')).toBe(true);
    const entry = extracted.get('roundtrip.txt')!;
    expect(entry.data).toEqual(originalData);
  });
});

describe('addOriginalNameToGzip', () => {
  it('FNAME フラグ（byte[3] の bit 3）が立っているか', () => {
    const gzipData = createMinimalGzipBuffer();
    const result = addOriginalNameToGzip(gzipData, 'test.txt');

    const view = new Uint8Array(result);
    expect(view[3] & 0x08).toBe(0x08);
  });

  it('NAME フィールドが正しく挿入される（null 終端）', () => {
    const name = 'myfile.txt';
    const gzipData = createMinimalGzipBuffer();
    const result = addOriginalNameToGzip(gzipData, name);

    const view = new Uint8Array(result);
    const nameBytes = new TextEncoder().encode(name);

    // name は header（10 バイト）の直後から始まる
    for (let i = 0; i < nameBytes.length; i++) {
      expect(view[10 + i]).toBe(nameBytes[i]);
    }
    // null 終端
    expect(view[10 + nameBytes.length]).toBe(0x00);
  });

  it('NAME 挿入後の gzip データの残り部分が保持される', () => {
    const payload = [0xab, 0xcd, 0xef, 0x12];
    const gzipData = createMinimalGzipBuffer(payload);
    const name = 'file.gz';
    const result = addOriginalNameToGzip(gzipData, name);

    const originalView = new Uint8Array(gzipData);
    const resultView = new Uint8Array(result);

    const nameInsertSize = name.length + 1; // name + null 終端

    // header より後のオリジナルデータが result の中で name の後に現れること
    for (let i = 10; i < originalView.length; i++) {
      expect(resultView[i + nameInsertSize]).toBe(originalView[i]);
    }
  });

  it('長い NAME を指定しても正しく処理される', () => {
    const longName = 'a'.repeat(200) + '.tar.gz';
    const gzipData = createMinimalGzipBuffer();
    const result = addOriginalNameToGzip(gzipData, longName);

    const view = new Uint8Array(result);
    // FNAME フラグが立っていること
    expect(view[3] & 0x08).toBe(0x08);
    // 結果のサイズ: 元データ + name の長さ + null 終端（1）
    expect(result.byteLength).toBe(gzipData.byteLength + longName.length + 1);
    // null 終端
    const nameBytes = new TextEncoder().encode(longName);
    expect(view[10 + nameBytes.length]).toBe(0x00);
  });
});
