import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  importUnityPackage,
  exportUnityPackage,
  UnityAsset,
  UnityPackageInfo,
} from '../unitypackage';

// フィクスチャファイルのパス
const FIXTURES_DIR = join(__dirname, 'fixtures');
const MINIMAL_PACKAGE_PATH = join(FIXTURES_DIR, 'minimal.unitypackage');
const STANDARD_PACKAGE_PATH = join(FIXTURES_DIR, 'standard.unitypackage');

// テスト用のフィクスチャデータ
let minimalPackageData: ArrayBuffer;
let standardPackageData: ArrayBuffer;

beforeAll(async () => {
  // フィクスチャファイルを読み込む
  const minimalBuffer = await readFile(MINIMAL_PACKAGE_PATH);
  const standardBuffer = await readFile(STANDARD_PACKAGE_PATH);

  minimalPackageData = minimalBuffer.buffer.slice(
    minimalBuffer.byteOffset,
    minimalBuffer.byteOffset + minimalBuffer.byteLength,
  );
  standardPackageData = standardBuffer.buffer.slice(
    standardBuffer.byteOffset,
    standardBuffer.byteOffset + standardBuffer.byteLength,
  );
});

describe('importUnityPackage', () => {
  describe('基本的な機能', () => {
    it('最小構成のUnityPackageを正しくインポートできる', async () => {
      const result = await importUnityPackage(minimalPackageData);

      expect(result.assets.size).toBeGreaterThan(0);
      expect(result.guidToPath.size).toBe(result.assets.size);
      expect(result.pathToGuid.size).toBe(result.assets.size);

      // 少なくとも1つのアセットが存在する
      const firstAsset = Array.from(result.assets.values())[0];
      expect(firstAsset).toBeDefined();
      expect(firstAsset.guid).toBeTruthy();
      expect(firstAsset.assetPath).toBeTruthy();
      expect(firstAsset.assetData).toBeInstanceOf(Uint8Array);
    });

    it('標準構成のUnityPackageを正しくインポートできる', async () => {
      const result = await importUnityPackage(standardPackageData);

      // 複数のアセットが含まれている
      expect(result.assets.size).toBeGreaterThan(1);

      // すべてのアセットが必須フィールドを持っている
      for (const asset of result.assets.values()) {
        expect(asset.guid).toBeTruthy();
        expect(asset.assetPath).toBeTruthy();
        expect(asset.assetData).toBeInstanceOf(Uint8Array);
        expect(asset.assetData.length).toBeGreaterThan(0);
      }
    });

    it('アセットパスからアセットを取得できる', async () => {
      const result = await importUnityPackage(standardPackageData);

      // いずれかのアセットパスでアクセス
      const assetPath = Array.from(result.assets.keys())[0];
      const asset = result.assets.get(assetPath);

      expect(asset).toBeDefined();
      expect(asset!.assetPath).toBe(assetPath);
    });

    it('GUIDからパスへのマッピングが正しい', async () => {
      const result = await importUnityPackage(standardPackageData);

      for (const [assetPath, asset] of result.assets.entries()) {
        const mappedPath = result.guidToPath.get(asset.guid);
        expect(mappedPath).toBe(assetPath);
      }
    });

    it('パスからGUIDへのマッピングが正しい', async () => {
      const result = await importUnityPackage(standardPackageData);

      for (const [assetPath, asset] of result.assets.entries()) {
        const mappedGuid = result.pathToGuid.get(assetPath);
        expect(mappedGuid).toBe(asset.guid);
      }
    });
  });

  describe('アセットの種類', () => {
    it('メタデータ付きアセットを正しく処理できる', async () => {
      const result = await importUnityPackage(standardPackageData);

      // メタデータを持つアセットが存在するはず
      const assetsWithMeta = Array.from(result.assets.values()).filter(
        (asset) => asset.metaData !== undefined,
      );

      expect(assetsWithMeta.length).toBeGreaterThan(0);

      for (const asset of assetsWithMeta) {
        expect(asset.metaData).toBeInstanceOf(Uint8Array);
        expect(asset.metaData!.length).toBeGreaterThan(0);
      }
    });

    it('プレビュー画像付きアセットを正しく処理できる', async () => {
      const result = await importUnityPackage(standardPackageData);

      // プレビュー画像を持つアセットを探す
      const assetsWithPreview = Array.from(result.assets.values()).filter(
        (asset) => asset.previewData !== undefined,
      );

      // プレビュー画像がある場合のみチェック
      if (assetsWithPreview.length > 0) {
        for (const asset of assetsWithPreview) {
          expect(asset.previewData).toBeInstanceOf(Uint8Array);
          expect(asset.previewData!.length).toBeGreaterThan(0);
        }
      }
    });

    it('テキストファイルとバイナリファイルの両方を処理できる', async () => {
      const result = await importUnityPackage(standardPackageData);

      // 異なるサイズのアセットが存在することを確認
      const assetSizes = Array.from(result.assets.values()).map(
        (asset) => asset.assetData.length,
      );
      const uniqueSizes = new Set(assetSizes);

      expect(uniqueSizes.size).toBeGreaterThan(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なtar.gzデータに対してエラーをスローする', async () => {
      const invalidData = new ArrayBuffer(100);
      const view = new Uint8Array(invalidData);
      view.fill(0xff); // 無効なデータで埋める

      await expect(importUnityPackage(invalidData)).rejects.toThrow();
    });

    it('空のデータに対してエラーをスローする', async () => {
      const emptyData = new ArrayBuffer(0);

      await expect(importUnityPackage(emptyData)).rejects.toThrow();
    });
  });
});

describe('exportUnityPackage', () => {
  describe('基本的な機能', () => {
    it('UnityPackageInfo からパッケージをエクスポートできる', async () => {
      // まずインポート
      const imported = await importUnityPackage(minimalPackageData);

      // エクスポート
      const exported = await exportUnityPackage(imported);

      expect(exported).toBeInstanceOf(ArrayBuffer);
      expect(exported.byteLength).toBeGreaterThan(0);
    });

    it('複数アセットを含むパッケージをエクスポートできる', async () => {
      const imported = await importUnityPackage(standardPackageData);
      const exported = await exportUnityPackage(imported);

      expect(exported).toBeInstanceOf(ArrayBuffer);
      expect(exported.byteLength).toBeGreaterThan(0);
    });

    it('エクスポートされたパッケージにgzip NAMEメタデータが含まれる', async () => {
      const imported = await importUnityPackage(minimalPackageData);
      const exported = await exportUnityPackage(imported);

      // gzipヘッダーを確認
      const view = new Uint8Array(exported);

      // gzipマジックナンバー確認
      expect(view[0]).toBe(0x1f);
      expect(view[1]).toBe(0x8b);

      // FNAMEフラグが立っているか確認
      expect(view[3] & 0x08).toBe(0x08);

      // FNAMEフィールドの値を確認 (gzipヘッダーの10バイト目から開始)
      const fnameStart = 10;
      let fnameEnd = fnameStart;
      while (view[fnameEnd] !== 0) {
        fnameEnd++;
      }
      const fname = new TextDecoder().decode(view.slice(fnameStart, fnameEnd));
      expect(fname).toBe('archtemp.tar');
    });
  });

  describe('データの整合性', () => {
    it('すべてのアセットがエクスポートされる', async () => {
      const imported = await importUnityPackage(standardPackageData);
      const exported = await exportUnityPackage(imported);

      // 再度インポートして比較
      const reimported = await importUnityPackage(exported);

      expect(reimported.assets.size).toBe(imported.assets.size);
    });

    it('GUIDマッピングが保持される', async () => {
      const imported = await importUnityPackage(standardPackageData);
      const exported = await exportUnityPackage(imported);
      const reimported = await importUnityPackage(exported);

      // すべてのGUIDが一致
      for (const [guid, path] of imported.guidToPath.entries()) {
        expect(reimported.guidToPath.get(guid)).toBe(path);
      }
    });

    it('パスマッピングが保持される', async () => {
      const imported = await importUnityPackage(standardPackageData);
      const exported = await exportUnityPackage(imported);
      const reimported = await importUnityPackage(exported);

      // すべてのパスが一致
      for (const [path, guid] of imported.pathToGuid.entries()) {
        expect(reimported.pathToGuid.get(path)).toBe(guid);
      }
    });
  });
});

describe('ラウンドトリップテスト', () => {
  it('最小構成: import → export → import でデータが保持される', async () => {
    const original = await importUnityPackage(minimalPackageData);
    const exported = await exportUnityPackage(original);
    const reimported = await importUnityPackage(exported);

    // アセット数が同じ
    expect(reimported.assets.size).toBe(original.assets.size);

    // すべてのアセットが一致
    for (const [path, originalAsset] of original.assets.entries()) {
      const reimportedAsset = reimported.assets.get(path);

      expect(reimportedAsset).toBeDefined();
      expect(reimportedAsset!.guid).toBe(originalAsset.guid);
      expect(reimportedAsset!.assetPath).toBe(originalAsset.assetPath);
      expect(reimportedAsset!.assetData).toEqual(originalAsset.assetData);

      if (originalAsset.metaData) {
        expect(reimportedAsset!.metaData).toEqual(originalAsset.metaData);
      }

      if (originalAsset.previewData) {
        expect(reimportedAsset!.previewData).toEqual(originalAsset.previewData);
      }
    }
  });

  it('標準構成: import → export → import でデータが保持される', async () => {
    const original = await importUnityPackage(standardPackageData);
    const exported = await exportUnityPackage(original);
    const reimported = await importUnityPackage(exported);

    // アセット数が同じ
    expect(reimported.assets.size).toBe(original.assets.size);

    // すべてのアセットが一致
    for (const [path, originalAsset] of original.assets.entries()) {
      const reimportedAsset = reimported.assets.get(path);

      expect(reimportedAsset).toBeDefined();
      expect(reimportedAsset!.guid).toBe(originalAsset.guid);
      expect(reimportedAsset!.assetPath).toBe(originalAsset.assetPath);
      expect(reimportedAsset!.assetData).toEqual(originalAsset.assetData);

      if (originalAsset.metaData) {
        expect(reimportedAsset!.metaData).toEqual(originalAsset.metaData);
      }

      if (originalAsset.previewData) {
        expect(reimportedAsset!.previewData).toEqual(originalAsset.previewData);
      }
    }
  });

  it('バイナリデータが正確に保持される', async () => {
    const original = await importUnityPackage(standardPackageData);
    const exported = await exportUnityPackage(original);
    const reimported = await importUnityPackage(exported);

    // すべてのアセットのバイト単位での一致を確認
    for (const [path, originalAsset] of original.assets.entries()) {
      const reimportedAsset = reimported.assets.get(path);

      expect(reimportedAsset).toBeDefined();

      // assetDataのバイト単位での比較
      expect(reimportedAsset!.assetData.length).toBe(
        originalAsset.assetData.length,
      );
      for (let i = 0; i < originalAsset.assetData.length; i++) {
        expect(reimportedAsset!.assetData[i]).toBe(originalAsset.assetData[i]);
      }
    }
  });

  it('複数回のラウンドトリップでデータが保持される', async () => {
    let current = await importUnityPackage(minimalPackageData);

    // 3回のラウンドトリップ
    for (let i = 0; i < 3; i++) {
      const exported = await exportUnityPackage(current);
      current = await importUnityPackage(exported);
    }

    // 元のデータと比較
    const original = await importUnityPackage(minimalPackageData);
    expect(current.assets.size).toBe(original.assets.size);

    for (const [path, originalAsset] of original.assets.entries()) {
      const currentAsset = current.assets.get(path);
      expect(currentAsset).toBeDefined();
      expect(currentAsset!.assetData).toEqual(originalAsset.assetData);
    }
  });
});

describe('データ整合性', () => {
  it('GUIDが一意である', async () => {
    const result = await importUnityPackage(standardPackageData);

    const guids = Array.from(result.assets.values()).map((asset) => asset.guid);
    const uniqueGuids = new Set(guids);

    expect(uniqueGuids.size).toBe(guids.length);
  });

  it('アセットパスが一意である', async () => {
    const result = await importUnityPackage(standardPackageData);

    const paths = Array.from(result.assets.keys());
    const uniquePaths = new Set(paths);

    expect(uniquePaths.size).toBe(paths.length);
  });

  it('マッピングの一貫性が保たれている', async () => {
    const result = await importUnityPackage(standardPackageData);

    for (const [assetPath, asset] of result.assets.entries()) {
      // assets, guidToPath, pathToGuid の整合性
      expect(result.guidToPath.get(asset.guid)).toBe(assetPath);
      expect(result.pathToGuid.get(assetPath)).toBe(asset.guid);
      expect(asset.assetPath).toBe(assetPath);
    }
  });

  it('すべてのGUIDがマッピングに存在する', async () => {
    const result = await importUnityPackage(standardPackageData);

    for (const asset of result.assets.values()) {
      expect(result.guidToPath.has(asset.guid)).toBe(true);
    }
  });

  it('すべてのパスがマッピングに存在する', async () => {
    const result = await importUnityPackage(standardPackageData);

    for (const path of result.assets.keys()) {
      expect(result.pathToGuid.has(path)).toBe(true);
    }
  });
});

describe('実際のUnityPackageとの互換性', () => {
  it('標準構成のパッケージに期待されるアセットが含まれている', async () => {
    const result = await importUnityPackage(standardPackageData);

    // READMEによれば以下のファイルが含まれているはず
    const expectedFiles = [
      'DummyScript.cs',
      'Hop.anim',
      'Cube.controller',
      'Colorful.mat',
      'Colorful.png',
      'Cube.prefab',
      'README.md',
    ];

    for (const fileName of expectedFiles) {
      // ファイル名が含まれるパスがあるか確認
      const found = Array.from(result.assets.keys()).some((path) =>
        path.includes(fileName),
      );
      expect(found).toBe(true);
    }
  });

  it('C#スクリプトファイルが正しく読み込まれる', async () => {
    const result = await importUnityPackage(standardPackageData);

    // .csファイルを探す
    const csAssets = Array.from(result.assets.values()).filter((asset) =>
      asset.assetPath.endsWith('.cs'),
    );

    expect(csAssets.length).toBeGreaterThan(0);

    for (const asset of csAssets) {
      // テキストとしてデコード可能か確認
      const text = new TextDecoder('utf-8').decode(asset.assetData);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('アニメーションファイルが正しく読み込まれる', async () => {
    const result = await importUnityPackage(standardPackageData);

    // .animファイルを探す
    const animAssets = Array.from(result.assets.values()).filter((asset) =>
      asset.assetPath.endsWith('.anim'),
    );

    expect(animAssets.length).toBeGreaterThan(0);

    for (const asset of animAssets) {
      expect(asset.assetData.length).toBeGreaterThan(0);
    }
  });

  it('画像ファイルが正しく読み込まれる', async () => {
    const result = await importUnityPackage(standardPackageData);

    // .pngファイルを探す
    const pngAssets = Array.from(result.assets.values()).filter((asset) =>
      asset.assetPath.endsWith('.png'),
    );

    expect(pngAssets.length).toBeGreaterThan(0);

    for (const asset of pngAssets) {
      // PNGヘッダーの確認
      const header = asset.assetData.slice(0, 8);
      expect(header[0]).toBe(0x89);
      expect(header[1]).toBe(0x50); // 'P'
      expect(header[2]).toBe(0x4e); // 'N'
      expect(header[3]).toBe(0x47); // 'G'
    }
  });
});
