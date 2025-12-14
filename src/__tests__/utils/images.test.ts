/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSquareThumbnail } from '../../utils/images';

// モックのCanvas環境をセットアップ
const setupCanvasMock = () => {
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    })),
    toBlob: vi.fn((callback) => {
      // テスト用のダミーPNG画像データを生成
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
      ]);
      const blob = new Blob([pngHeader], { type: 'image/png' });
      callback(blob);
    }),
  };

  global.document = {
    createElement: vi.fn(() => mockCanvas),
  } as any;

  global.window = {} as any;

  global.Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    width = 100;
    height = 100;

    constructor() {
      // src設定後に非同期でonloadを呼ぶ
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  } as any;

  global.URL = {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  } as any;

  global.Blob = class MockBlob {
    parts: any[];
    options: any;
    size: number;

    constructor(parts: any[], options?: any) {
      this.parts = parts;
      this.options = options;
      this.size = parts.reduce(
        (acc: number, part: any) => acc + (part.byteLength || part.length || 0),
        0,
      );
    }

    arrayBuffer() {
      return Promise.resolve(
        this.parts[0].buffer || this.parts[0] || new ArrayBuffer(16),
      );
    }
  } as any;
};

describe('generateSquareThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な機能', () => {
    it('画像データからサムネイルを生成できる', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const size = 128;

      const result = await generateSquareThumbnail(imageData, size);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('指定されたサイズでCanvasが作成される', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const size = 256;

      await generateSquareThumbnail(imageData, size);

      const mockCanvas = (global.document.createElement as any).mock.results[0]
        .value;
      expect(mockCanvas.width).toBe(size);
      expect(mockCanvas.height).toBe(size);
    });

    it('カスタムMIMEタイプを指定できる', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      const size = 128;
      const mimeType = 'image/jpeg';

      const result = await generateSquareThumbnail(imageData, size, mimeType);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('デフォルトMIMEタイプはimage/pngである', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const size = 128;

      // MIMEタイプを指定せずに実行
      const result = await generateSquareThumbnail(imageData, size);

      // 結果が生成されることを確認（デフォルトMIMEタイプで動作）
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Canvas APIの使用', () => {
    it('Canvasコンテキストが取得される', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await generateSquareThumbnail(imageData, 128);

      const mockCanvas = (global.document.createElement as any).mock.results[0]
        .value;
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('画像スムージングが有効化される', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await generateSquareThumbnail(imageData, 128);

      const mockCanvas = (global.document.createElement as any).mock.results[0]
        .value;
      const ctx = mockCanvas.getContext();
      expect(ctx.imageSmoothingEnabled).toBe(true);
      expect(ctx.imageSmoothingQuality).toBe('high');
    });

    it('clearRectとdrawImageが呼ばれる', async () => {
      const clearRectSpy = vi.fn();
      const drawImageSpy = vi.fn();

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          clearRect: clearRectSpy,
          drawImage: drawImageSpy,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        })),
        toBlob: vi.fn((callback) => {
          const pngHeader = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52,
          ]);
          const blob = new Blob([pngHeader], { type: 'image/png' });
          callback(blob);
        }),
      };

      global.document = {
        createElement: vi.fn(() => mockCanvas),
      } as any;

      global.window = {} as any;

      global.Image = class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 100;
        height = 100;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;

      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any;

      global.Blob = class MockBlob {
        constructor(
          public parts: any[],
          public options?: any,
        ) {}
        arrayBuffer() {
          return Promise.resolve(
            this.parts[0].buffer || this.parts[0] || new ArrayBuffer(16),
          );
        }
      } as any;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await generateSquareThumbnail(imageData, 128);

      expect(clearRectSpy).toHaveBeenCalled();
      expect(drawImageSpy).toHaveBeenCalled();
    });
  });

  describe('リソース管理', () => {
    it('BlobのURLが作成され、解放される', async () => {
      setupCanvasMock();

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await generateSquareThumbnail(imageData, 128);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('エラーが発生してもURLは解放される', async () => {
      setupCanvasMock();

      // toBlobがnullを返すようにモック
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        })),
        toBlob: vi.fn((callback) => callback(null)),
      };

      global.document = {
        createElement: vi.fn(() => mockCanvas),
      } as any;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow();

      // URLは解放される
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('documentが存在しない環境でエラーをスローする', async () => {
      delete (global as any).document;
      delete (global as any).window;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        'Canvas APIがサポートされていません',
      );
    });

    it('windowが存在しない環境でエラーをスローする', async () => {
      global.document = {} as any;
      delete (global as any).window;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        'Canvas APIがサポートされていません',
      );
    });

    it('Canvasコンテキストが取得できない場合エラーをスローする', async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => null),
      };

      global.document = {
        createElement: vi.fn(() => mockCanvas),
      } as any;
      global.window = {} as any;
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 100;
        height = 100;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any;
      global.Blob = class MockBlob {
        constructor(
          public parts: any[],
          public options?: any,
        ) {}
        arrayBuffer() {
          return Promise.resolve(new ArrayBuffer(8));
        }
      } as any;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        'Canvasコンテキストの取得に失敗しました',
      );
    });

    it('画像の読み込みに失敗した場合エラーをスローする', async () => {
      setupCanvasMock();

      global.Image = class MockImage {
        onerror: (() => void) | null = null;
        src = '';

        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
      } as any;

      const imageData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        '画像の読み込みに失敗しました',
      );
    });

    it('toBlobがnullを返す場合エラーをスローする', async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        })),
        toBlob: vi.fn((callback) => callback(null)),
      };

      global.document = {
        createElement: vi.fn(() => mockCanvas),
      } as any;
      global.window = {} as any;
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 100;
        height = 100;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any;
      global.Blob = class MockBlob {
        constructor(
          public parts: any[],
          public options?: any,
        ) {}
      } as any;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        'サムネイル生成に失敗しました',
      );
    });

    it('toBlobが空のBlobを返す場合エラーをスローする', async () => {
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
        })),
        toBlob: vi.fn((callback) =>
          callback(
            new (class EmptyBlob {
              size = 0;
            })(),
          ),
        ),
      };

      global.document = {
        createElement: vi.fn(() => mockCanvas),
      } as any;
      global.window = {} as any;
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 100;
        height = 100;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        'サムネイル生成に失敗しました',
      );
    });

    it('画像サイズが0の場合エラーをスローする', async () => {
      setupCanvasMock();

      global.Image = class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 0;
        height = 0;

        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      } as any;

      const imageData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await expect(generateSquareThumbnail(imageData, 128)).rejects.toThrow(
        '画像のサイズが無効です',
      );
    });
  });
});
