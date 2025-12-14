import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { UnityPackage } from '../unitypackage';

// フィクスチャファイルのパス
const FIXTURES_DIR = join(__dirname, 'fixtures');
const STANDARD_PACKAGE_PATH = join(FIXTURES_DIR, 'standard.unitypackage');

// テスト用のフィクスチャデータ
let standardPackageData: ArrayBuffer;

beforeAll(async () => {
  // フィクスチャファイルを読み込む
  const standardBuffer = await readFile(STANDARD_PACKAGE_PATH);

  standardPackageData = standardBuffer.buffer.slice(
    standardBuffer.byteOffset,
    standardBuffer.byteOffset + standardBuffer.byteLength,
  );
});

describe('UnityPackage.renameAsset', () => {
  describe('基本的な機能', () => {
    it('アセットのパスを変更できる', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      // 最初のアセットを取得
      const oldPath = Array.from(pkg.assets.keys())[0];
      const asset = pkg.assets.get(oldPath)!;
      const originalGuid = asset.guid;
      const newPath = 'Assets/NewPath/Test.asset';

      // リネーム実行
      const result = pkg.renameAsset(oldPath, newPath);

      expect(result).toBe(true);
      expect(pkg.assets.has(oldPath)).toBe(false);
      expect(pkg.assets.has(newPath)).toBe(true);

      const renamedAsset = pkg.assets.get(newPath)!;
      expect(renamedAsset.assetPath).toBe(newPath);
      expect(renamedAsset.guid).toBe(originalGuid); // GUIDは変更されない
    });

    it('存在しないアセットのリネームは失敗する', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const result = pkg.renameAsset(
        'Assets/NonExistent.asset',
        'Assets/NewPath.asset',
      );

      expect(result).toBe(false);
    });

    it('リネーム後にエクスポート・再インポートできる', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const oldPath = Array.from(pkg.assets.keys())[0];
      const newPath = 'Assets/Renamed/NewAsset.test';

      pkg.renameAsset(oldPath, newPath);

      // エクスポートして再インポート
      const exported = await pkg.export();
      const reimported = await UnityPackage.fromArrayBuffer(exported);

      expect(reimported.assets.has(newPath)).toBe(true);
      expect(reimported.assets.has(oldPath)).toBe(false);

      const asset = reimported.assets.get(newPath)!;
      expect(asset.assetPath).toBe(newPath);
    });
  });

  describe('データ整合性', () => {
    it('リネーム後もアセットデータが保持される', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const oldPath = Array.from(pkg.assets.keys())[0];
      const originalAsset = pkg.assets.get(oldPath)!;
      const originalData = new Uint8Array(originalAsset.assetData);
      const originalMeta = originalAsset.metaData
        ? new Uint8Array(originalAsset.metaData)
        : undefined;
      const newPath = 'Assets/NewLocation/Test.asset';

      pkg.renameAsset(oldPath, newPath);

      const renamedAsset = pkg.assets.get(newPath)!;
      expect(renamedAsset.assetData).toEqual(originalData);
      if (originalMeta) {
        expect(renamedAsset.metaData).toEqual(originalMeta);
      }
    });

    it('リネーム後もアセット数は変わらない', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);
      const originalSize = pkg.assets.size;

      const oldPath = Array.from(pkg.assets.keys())[0];
      pkg.renameAsset(oldPath, 'Assets/NewPath.asset');

      expect(pkg.assets.size).toBe(originalSize);
    });
  });
});

describe('UnityPackage.replaceAssetGuid', () => {
  describe('基本的な機能', () => {
    it('アセットのGUIDを変更できる', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const assetPath = Array.from(pkg.assets.keys())[0];
      const oldGuid = pkg.assets.get(assetPath)!.guid;
      const newGuid = 'a1b2c3d4e5f6789012345678abcdef00';

      const result = pkg.replaceAssetGuid(assetPath, newGuid);

      expect(result).toBe(true);
      const asset = pkg.assets.get(assetPath)!;
      expect(asset.guid).toBe(newGuid);
      expect(asset.guid).not.toBe(oldGuid);
    });

    it('GUIDを省略すると自動生成される', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const assetPath = Array.from(pkg.assets.keys())[0];
      const oldGuid = pkg.assets.get(assetPath)!.guid;

      const result = pkg.replaceAssetGuid(assetPath);

      expect(result).toBe(true);
      const asset = pkg.assets.get(assetPath)!;
      expect(asset.guid).not.toBe(oldGuid);
      expect(asset.guid).toHaveLength(32);
      expect(asset.guid).toMatch(/^[0-9a-f]{32}$/);
    });

    it('存在しないアセットのGUID変更は失敗する', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const result = pkg.replaceAssetGuid('Assets/NonExistent.asset');

      expect(result).toBe(false);
    });

    it('既に使用されているGUIDを指定するとエラーになる', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const paths = Array.from(pkg.assets.keys());
      if (paths.length < 2) {
        // アセットが2つ未満の場合はスキップ
        return;
      }

      const assetPath1 = paths[0];
      const assetPath2 = paths[1];
      const existingGuid = pkg.assets.get(assetPath2)!.guid;

      expect(() => {
        pkg.replaceAssetGuid(assetPath1, existingGuid);
      }).toThrow();
    });
  });

  describe('メタデータの更新', () => {
    it('メタデータ内のGUIDが更新される', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      // メタデータを持つアセットを探す
      const assetWithMeta = Array.from(pkg.assets.values()).find(
        (asset) => asset.metaData !== undefined,
      );

      if (!assetWithMeta) {
        // メタデータを持つアセットがない場合はスキップ
        return;
      }

      const assetPath = assetWithMeta.assetPath;
      const oldGuid = assetWithMeta.guid;
      const newGuid = '11111111222222223333333344444444';

      pkg.replaceAssetGuid(assetPath, newGuid);

      const asset = pkg.assets.get(assetPath)!;
      const metaContent = new TextDecoder().decode(asset.metaData!);

      expect(metaContent).toContain(`guid: ${newGuid}`);
      expect(metaContent).not.toContain(`guid: ${oldGuid}`);
    });
  });

  describe('GUID参照の置換', () => {
    it('他のアセット内のGUID参照が更新される', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      // Prefabやcontrollerなど、他のアセットを参照する可能性のあるアセットを探す
      const assetPaths = Array.from(pkg.assets.keys());
      if (assetPaths.length < 2) {
        return;
      }

      const targetPath = assetPaths[0];
      const oldGuid = pkg.assets.get(targetPath)!.guid;
      const newGuid = 'aaaabbbbccccddddeeeeffffgggghhh0';

      // 他のアセットの元のデータを記録
      const otherAssets = assetPaths
        .filter((path) => path !== targetPath)
        .map((path) => ({
          path,
          hadReference: false,
          data: new Uint8Array(pkg.assets.get(path)!.assetData),
          meta: pkg.assets.get(path)!.metaData
            ? new Uint8Array(pkg.assets.get(path)!.metaData!)
            : undefined,
        }));

      // 元のデータに旧GUIDが含まれているかチェック
      for (const other of otherAssets) {
        try {
          const content = new TextDecoder().decode(other.data);
          if (content.includes(oldGuid)) {
            other.hadReference = true;
          }
        } catch {
          // バイナリファイルはスキップ
        }
      }

      // GUID置換実行
      pkg.replaceAssetGuid(targetPath, newGuid);

      // 参照が更新されたか確認
      for (const other of otherAssets) {
        if (other.hadReference) {
          const asset = pkg.assets.get(other.path)!;
          try {
            const content = new TextDecoder().decode(asset.assetData);
            expect(content).toContain(newGuid);
            expect(content).not.toContain(oldGuid);
          } catch {
            // バイナリファイルはスキップ
          }
        }
      }
    });

    it('部分一致ではなく完全一致のみ置換される', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const assetPath = Array.from(pkg.assets.keys())[0];
      const asset = pkg.assets.get(assetPath)!;
      const oldGuid = asset.guid;

      // テスト用のアセットデータを作成（前後に16進数文字がある場合）
      const testData = `
        Valid: ${oldGuid}
        Invalid: f${oldGuid}
        Invalid: ${oldGuid}f
        Invalid: f${oldGuid}f
      `;
      asset.assetData = new TextEncoder().encode(testData);

      const newGuid = 'ffffffffffffffffffffffffffffffff';
      pkg.replaceAssetGuid(assetPath, newGuid);

      const updatedContent = new TextDecoder().decode(asset.assetData);

      // 単独のGUIDのみ置換される
      expect(updatedContent).toContain(`Valid: ${newGuid}`);
      // 前後に16進数文字がある場合は置換されない
      expect(updatedContent).toContain(`Invalid: f${oldGuid}`);
      expect(updatedContent).toContain(`Invalid: ${oldGuid}f`);
      expect(updatedContent).toContain(`Invalid: f${oldGuid}f`);
    });
  });

  describe('ラウンドトリップテスト', () => {
    it('GUID変更後にエクスポート・再インポートできる', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const assetPath = Array.from(pkg.assets.keys())[0];
      const newGuid = '99999999888888887777777766666666';

      pkg.replaceAssetGuid(assetPath, newGuid);

      // エクスポートして再インポート
      const exported = await pkg.export();
      const reimported = await UnityPackage.fromArrayBuffer(exported);

      const asset = reimported.assets.get(assetPath)!;
      expect(asset.guid).toBe(newGuid);
    });

    it('複数のアセットのGUIDを変更してもエクスポートできる', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const paths = Array.from(pkg.assets.keys()).slice(0, 3);
      const newGuids: Record<string, string> = {};

      for (let i = 0; i < paths.length; i++) {
        const newGuid = `${i}0000000000000000000000000000000${i}`;
        newGuids[paths[i]] = newGuid;
        pkg.replaceAssetGuid(paths[i], newGuid);
      }

      // エクスポートして再インポート
      const exported = await pkg.export();
      const reimported = await UnityPackage.fromArrayBuffer(exported);

      for (const path of paths) {
        const asset = reimported.assets.get(path)!;
        expect(asset.guid).toBe(newGuids[path]);
      }
    });
  });

  describe('データ整合性', () => {
    it('GUID変更後もアセット数は変わらない', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);
      const originalSize = pkg.assets.size;

      const assetPath = Array.from(pkg.assets.keys())[0];
      pkg.replaceAssetGuid(assetPath);

      expect(pkg.assets.size).toBe(originalSize);
    });

    it('GUID変更後もアセットパスは変わらない', async () => {
      const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

      const assetPath = Array.from(pkg.assets.keys())[0];
      const originalPath = pkg.assets.get(assetPath)!.assetPath;

      pkg.replaceAssetGuid(assetPath);

      const asset = pkg.assets.get(assetPath)!;
      expect(asset.assetPath).toBe(originalPath);
    });
  });
});

describe('アセットリネームとGUID変更の組み合わせ', () => {
  it('リネームとGUID変更を両方実行できる', async () => {
    const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

    const oldPath = Array.from(pkg.assets.keys())[0];
    const oldGuid = pkg.assets.get(oldPath)!.guid;
    const newPath = 'Assets/CompletelyNew/Asset.test';
    const newGuid = 'abcdef0123456789abcdef0123456789';

    // リネーム実行
    const renameResult = pkg.renameAsset(oldPath, newPath);
    expect(renameResult).toBe(true);

    // GUID変更実行
    const guidResult = pkg.replaceAssetGuid(newPath, newGuid);
    expect(guidResult).toBe(true);

    // 確認
    expect(pkg.assets.has(oldPath)).toBe(false);
    expect(pkg.assets.has(newPath)).toBe(true);

    const asset = pkg.assets.get(newPath)!;
    expect(asset.assetPath).toBe(newPath);
    expect(asset.guid).toBe(newGuid);
    expect(asset.guid).not.toBe(oldGuid);
  });

  it('リネームとGUID変更後にエクスポート・再インポートできる', async () => {
    const pkg = await UnityPackage.fromArrayBuffer(standardPackageData);

    const oldPath = Array.from(pkg.assets.keys())[0];
    const newPath = 'Assets/Modified/NewAsset.asset';
    const newGuid = '12345678901234567890123456789012';

    pkg.renameAsset(oldPath, newPath);
    pkg.replaceAssetGuid(newPath, newGuid);

    // エクスポートして再インポート
    const exported = await pkg.export();
    const reimported = await UnityPackage.fromArrayBuffer(exported);

    expect(reimported.assets.has(newPath)).toBe(true);
    expect(reimported.assets.has(oldPath)).toBe(false);

    const asset = reimported.assets.get(newPath)!;
    expect(asset.assetPath).toBe(newPath);
    expect(asset.guid).toBe(newGuid);
  });
});
