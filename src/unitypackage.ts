import { uint8ArrayToString } from './utils/files';
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
}
