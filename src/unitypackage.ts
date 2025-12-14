import { generateNewGuid, uint8ArrayToString } from './utils/files';
import { generateSquareThumbnail } from './utils/images';
import {
  addOriginalNameToGzip,
  compressTarGz,
  extractTarGz,
  TarGzEntry,
} from './utils/tar-gz';

/**
 * Unityアセット情報
 */
export interface UnityAsset {
  guid: string;
  assetPath: string;
  assetData: Uint8Array;
  metaData?: Uint8Array;
  previewData?: Uint8Array;
}

/**
 * UnityPackageクラス
 * UnityPackageのインポート・エクスポート機能を提供する
 */
export class UnityPackage {
  private _assets: Map<string, UnityAsset>;
  private _guidToPath: Map<string, string>;
  private _pathToGuid: Map<string, string>;

  private constructor(
    assets: Map<string, UnityAsset>,
    guidToPath: Map<string, string>,
    pathToGuid: Map<string, string>,
  ) {
    this._assets = assets;
    this._guidToPath = guidToPath;
    this._pathToGuid = pathToGuid;
  }

  /**
   * ArrayBufferからUnityPackageをインポートする
   * @param data tar.gz形式のUnityPackageデータ
   * @returns UnityPackageインスタンス
   */
  static async fromArrayBuffer(data: ArrayBuffer): Promise<UnityPackage> {
    const entries = await extractTarGz(data);
    const assets = new Map<string, UnityAsset>();
    const guidToPath = new Map<string, string>();
    const pathToGuid = new Map<string, string>();

    // エントリをGUIDごとにグループ化
    const guidGroups = new Map<
      string,
      {
        asset?: TarGzEntry;
        meta?: TarGzEntry;
        pathname?: TarGzEntry;
        preview?: TarGzEntry;
      }
    >();

    for (const entry of Array.from(entries.values())) {
      // UnityPackageの構造: {guid}/asset, {guid}/asset.meta, {guid}/pathname, {guid}/preview.png
      const pathParts = entry.name.split('/');
      if (pathParts.length >= 2) {
        const guid = pathParts[0];
        const fileName = pathParts[1];

        if (!guidGroups.has(guid)) {
          guidGroups.set(guid, {});
        }
        const group = guidGroups.get(guid)!;

        switch (fileName) {
          case 'asset':
            group.asset = entry;
            break;
          case 'asset.meta':
            group.meta = entry;
            break;
          case 'pathname':
            group.pathname = entry;
            break;
          case 'preview.png':
            group.preview = entry;
            break;
        }
      }
    }

    // 各GUIDグループからアセット情報を構築
    for (const [guid, group] of Array.from(guidGroups.entries())) {
      if (group.pathname && group.asset) {
        try {
          const assetPath = uint8ArrayToString(group.pathname.data).trim();
          const metaData = group.meta ? group.meta.data : undefined;

          const asset: UnityAsset = {
            guid,
            assetPath,
            assetData: group.asset.data,
            metaData,
            previewData: group.preview ? group.preview.data : undefined,
          };

          assets.set(assetPath, asset);
          guidToPath.set(guid, assetPath);
          pathToGuid.set(assetPath, guid);
        } catch (error) {
          console.warn(`アセット解析エラー (GUID: ${guid}):`, error);
        }
      }
    }

    return new UnityPackage(assets, guidToPath, pathToGuid);
  }

  /**
   * UnityPackageをエクスポートする
   * @returns tar.gz形式のUnityPackageデータ
   */
  async export(): Promise<ArrayBuffer> {
    const entries = new Map<string, TarGzEntry>();

    for (const asset of Array.from(this._assets.values())) {
      const guid = asset.guid;

      // pathname エントリ
      entries.set(`${guid}/pathname`, {
        name: `${guid}/pathname`,
        data: new TextEncoder().encode(asset.assetPath),
        isDirectory: false,
      });

      // asset エントリ
      entries.set(`${guid}/asset`, {
        name: `${guid}/asset`,
        data: asset.assetData,
        isDirectory: false,
      });

      // asset.meta エントリ（存在する場合）
      if (asset.metaData) {
        entries.set(`${guid}/asset.meta`, {
          name: `${guid}/asset.meta`,
          data: asset.metaData,
          isDirectory: false,
        });
      }

      // preview.png エントリ（存在する場合）
      if (asset.previewData) {
        entries.set(`${guid}/preview.png`, {
          name: `${guid}/preview.png`,
          data: asset.previewData,
          isDirectory: false,
        });
      }
    }

    // tar.gz形式のファイルデータを生成
    const data = await compressTarGz(entries);

    // UnityPackageファイルは特定のNAMEメタデータを追加する必要がある
    const dataWithName = addOriginalNameToGzip(data, 'archtemp.tar');

    return dataWithName;
  }

  /**
   * アセット情報のマップを取得する（読み取り専用）
   */
  get assets(): ReadonlyMap<string, UnityAsset> {
    return this._assets;
  }

  /**
   * UnityPackage内のアセットパスを変更する
   * @param oldAssetPath 変更前のアセットパス
   * @param newAssetPath 変更後のアセットパス
   * @returns 変更が成功したかどうか
   */
  renameAsset(oldAssetPath: string, newAssetPath: string): boolean {
    // アセットが存在するかチェック
    const asset = this._assets.get(oldAssetPath);
    if (!asset) {
      return false;
    }

    // 1. パッケージ情報を更新
    this._assets.delete(oldAssetPath);
    asset.assetPath = newAssetPath;
    this._assets.set(newAssetPath, asset);

    // 2. パス⇔GUID マッピングを更新
    this._pathToGuid.delete(oldAssetPath);
    this._pathToGuid.set(newAssetPath, asset.guid);
    this._guidToPath.set(asset.guid, newAssetPath);

    return true;
  }

  /**
   * アセットのGUIDを変更し、すべての参照を更新する
   * @param assetPath 変更対象のアセットパス
   * @param newGuid 新しいGUID（省略時は自動生成）
   * @returns 変更が成功したかどうか
   */
  replaceAssetGuid(assetPath: string, newGuid?: string): boolean {
    // アセットが存在するかチェック
    const asset = this._assets.get(assetPath);
    if (!asset) {
      return false;
    }

    const oldGuid = asset.guid;
    const targetGuid = newGuid || generateNewGuid();

    // 新しいGUIDが既に使用されていないかチェック
    if (this._guidToPath.has(targetGuid)) {
      throw new Error(`GUID '${targetGuid}' は既に使用されています`);
    }

    // 1. 対象アセットのGUIDを更新
    asset.guid = targetGuid;

    // 2. マッピングを更新
    this._guidToPath.delete(oldGuid);
    this._pathToGuid.set(assetPath, targetGuid);
    this._guidToPath.set(targetGuid, assetPath);

    // 3. メタデータ内のGUIDを更新
    if (asset.metaData) {
      const metaContent = uint8ArrayToString(asset.metaData);
      const updatedMetaContent = metaContent.replace(
        new RegExp(`^guid: ${oldGuid}$`, 'm'),
        `guid: ${targetGuid}`,
      );
      asset.metaData = new TextEncoder().encode(updatedMetaContent);
    }

    // 4. すべてのアセットでGUID参照を置換
    this.replaceGuidReferences(oldGuid, targetGuid);

    return true;
  }

  /**
   * 指定されたパスのアセットのサムネイル(preview.png)を更新する非同期アセット
   * 画像アセットにのみ対応、対象のアセットが画像でなければRejectする
   * @param assetPath アセットのパス
   * @param size サムネイルのサイズ
   */
  async refreshThumbnail(assetPath: string, size: number = 128): Promise<void> {
    const asset = this._assets.get(assetPath);
    if (!asset) {
      throw new Error(`アセット '${assetPath}' が見つかりません`);
    }

    if (!this.isImageAsset(assetPath)) {
      throw new Error(`アセット '${assetPath}' は画像ではありません`);
    }

    asset.previewData = await generateSquareThumbnail(asset.assetData, size);
  }

  /**
   * パッケージ内のすべてのアセットで指定されたGUID参照を置換する
   * @param oldGuid 変更前のGUID
   * @param newGuid 変更後のGUID
   */
  private replaceGuidReferences(oldGuid: string, newGuid: string): void {
    // 前後に16進数文字がない場合のみ置換（部分的な一致を避ける）
    const guidPattern = new RegExp(
      `(?<![a-fA-F0-9])${oldGuid}(?![a-fA-F0-9])`,
      'g',
    );

    // すべてのアセットを検査して参照を置換
    for (const asset of Array.from(this._assets.values())) {
      // アセットデータ内の参照を置換
      try {
        const assetContent = uint8ArrayToString(asset.assetData);

        if (guidPattern.test(assetContent)) {
          guidPattern.lastIndex = 0; // グローバル検索のリセット
          const updatedContent = assetContent.replace(guidPattern, newGuid);
          asset.assetData = new TextEncoder().encode(updatedContent);
        }
      } catch {
        // バイナリファイルの場合はスキップ
        continue;
      }

      // メタデータ内の参照を置換
      if (asset.metaData) {
        try {
          const metaContent = uint8ArrayToString(asset.metaData);

          if (guidPattern.test(metaContent)) {
            guidPattern.lastIndex = 0; // グローバル検索のリセット
            const updatedMetaContent = metaContent.replace(
              guidPattern,
              newGuid,
            );
            asset.metaData = new TextEncoder().encode(updatedMetaContent);
          }
        } catch {
          // メタデータの処理に失敗した場合はスキップ
          continue;
        }
      }
    }
  }

  /**
   * 指定されたパスのアセットが画像かどうか判別する
   * パスの拡張子しか見ていないため、確実ではない点に注意
   * @param assetPath アセットのパス
   */
  private isImageAsset(assetPath: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const lowercasePath = assetPath.toLowerCase();
    return imageExtensions.some((ext) => lowercasePath.endsWith(ext));
  }
}
