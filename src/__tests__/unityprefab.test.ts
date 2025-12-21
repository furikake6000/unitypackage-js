import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { UnityPackage } from '../unitypackage';
import { UnityPrefab } from '../unityprefab';

// フィクスチャファイルのパス
const FIXTURES_DIR = join(__dirname, 'fixtures');
const STANDARD_PACKAGE_PATH = join(FIXTURES_DIR, 'standard.unitypackage');

let prefabYaml: string;
let dummyScriptGuid: string;

beforeAll(async () => {
  // standard.unitypackageを読み込み、Cube.prefabとDummyScript.csのGUIDを取得
  const standardBuffer = await readFile(STANDARD_PACKAGE_PATH);
  const standardData = standardBuffer.buffer.slice(
    standardBuffer.byteOffset,
    standardBuffer.byteOffset + standardBuffer.byteLength,
  );

  const pkg = await UnityPackage.fromArrayBuffer(standardData);

  const prefabAssetPath = Array.from(pkg.assets.keys()).find((path) =>
    path.endsWith('Cube.prefab'),
  );
  if (!prefabAssetPath) {
    throw new Error('Cube.prefab not found in standard.unitypackage');
  }

  const prefabAsset = pkg.assets.get(prefabAssetPath);
  if (!prefabAsset) {
    throw new Error('Prefab asset data not found');
  }
  prefabYaml = new TextDecoder().decode(prefabAsset.assetData);

  const scriptAssetPath = Array.from(pkg.assets.keys()).find((path) =>
    path.endsWith('DummyScript.cs'),
  );
  if (!scriptAssetPath) {
    throw new Error('DummyScript.cs not found in standard.unitypackage');
  }

  const scriptAsset = pkg.assets.get(scriptAssetPath);
  if (!scriptAsset?.metaData) {
    throw new Error('DummyScript meta data not found');
  }

  const metaContent = new TextDecoder().decode(scriptAsset.metaData);
  const guidMatch = metaContent.match(/^guid: ([0-9a-fA-F]{32})$/m);
  if (!guidMatch) {
    throw new Error('GUID not found in DummyScript meta data');
  }
  dummyScriptGuid = guidMatch[1];
});

describe('UnityPrefab', () => {
  it('PrefabからMonoBehaviourコンポーネントを解析できる', () => {
    const prefab = new UnityPrefab(prefabYaml);

    const components = prefab.components;
    expect(components.length).toBeGreaterThan(0);

    const scriptComponent = components.find(
      (component) => component.scriptGuid === dummyScriptGuid,
    );
    expect(scriptComponent).toBeDefined();
    expect(scriptComponent!.unityType).toBe('114');
    expect(scriptComponent!.properties.m_Enabled).toBe('1');
    expect(scriptComponent!.properties.m_ObjectHideFlags).toBe('0');
  });

  it('スクリプトGUIDでコンポーネントを検索できる', () => {
    const prefab = new UnityPrefab(prefabYaml);

    const components = prefab.findComponentsByScriptGuid(dummyScriptGuid);
    expect(components.length).toBeGreaterThan(0);
    for (const component of components) {
      expect(component.scriptGuid).toBe(dummyScriptGuid);
    }
  });

  it('コンポーネントのプロパティを書き換えられる', () => {
    const prefab = new UnityPrefab(prefabYaml);

    prefab.updateComponentProperties(dummyScriptGuid, {
      m_ObjectHideFlags: '1',
      m_Enabled: '0',
    });

    const updated = prefab.findComponentsByScriptGuid(dummyScriptGuid);
    expect(updated.length).toBeGreaterThan(0);
    expect(updated[0].properties.m_ObjectHideFlags).toBe('1');
    expect(updated[0].properties.m_Enabled).toBe('0');

    const updatedYaml = updated[0].rawYaml;
    expect(updatedYaml).toContain('m_ObjectHideFlags: 1');
    expect(updatedYaml).toContain('m_Enabled: 0');
  });

  it('エクスポートされたYAMLに変更が反映される', () => {
    const prefab = new UnityPrefab(prefabYaml);

    prefab.updateComponentProperties(dummyScriptGuid, {
      m_ObjectHideFlags: '2',
    });

    const exported = prefab.exportToYaml();
    expect(exported).toContain('m_ObjectHideFlags: 2');
    expect(exported.length).toBeGreaterThan(prefabYaml.length - 10);
  });
});
