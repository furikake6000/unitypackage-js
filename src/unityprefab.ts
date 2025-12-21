/**
 * Prefab内のコンポーネント情報
 */
export interface PrefabComponent {
  fileId: string; // コンポーネントのfileID
  unityType: string; // Unity型タグ（"114" = MonoBehaviour）
  scriptGuid?: string; // スクリプトのGUID（MonoBehaviourの場合）
  properties: Record<string, string>; // コンポーネントのプロパティ（全て文字列）
  rawYaml: string; // 生のYAML部分
}

/**
 * Unity Prefabファイル情報
 */
export class UnityPrefab {
  // Uniy Prefabはインポート処理はせず、YAML内容をそのまま保持しておく
  // 独自形式にインポートすることで元の形式が壊れてしまうことを防止している
  private _originalYaml: string = '';

  constructor(yamlContent: string) {
    this._originalYaml = yamlContent;
  }

  /**
   * Prefab内の全コンポーネントを取得
   * @return コンポーネントの配列
   */
  get components(): PrefabComponent[] {
    return UnityPrefab.parsePrefabComponents(this._originalYaml);
  }

  /**
   * スクリプトのGUIDを用いてコンポーネントを検索
   * @param targetScriptGuid 対象スクリプトのGUID
   * @returns マッチしたコンポーネントの配列
   */
  findComponentsByScriptGuid(targetScriptGuid: string): PrefabComponent[] {
    return this.components.filter(
      (component) => component.scriptGuid === targetScriptGuid,
    );
  }

  /**
   * 指定されたスクリプトのコンポーネントの書き換え
   * @param targetScriptGuid 対象スクリプトのGUID
   * @param newProperties 新しいプロパティ値
   * @returns 書き換え成功可否
   */
  updateComponentProperties(
    targetScriptGuid: string,
    newProperties: Record<string, string>,
  ): void {
    for (const component of this.components) {
      if (component.scriptGuid !== targetScriptGuid) continue;

      const updatedYaml = UnityPrefab.updateYamlProperties(
        component.rawYaml,
        newProperties,
      );
      this._originalYaml = this._originalYaml.replace(
        component.rawYaml,
        updatedYaml,
      );
    }
  }

  /**
   * Prefab YAMLからコンポーネントを解析
   * @param yamlContent PrefabのYAML内容
   * @returns コンポーネント配列
   */
  private static parsePrefabComponents(yamlContent: string): PrefabComponent[] {
    const components: PrefabComponent[] = [];

    // YAML文書を --- で分割
    const documents = yamlContent
      .split(/^---\s/m)
      .filter((doc) => doc.trim().length > 0);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      // Unity型とfileIDを抽出
      const headerMatch = doc.match(/^!u!(\d+) &(\d+)\r?\n([\s\S]*)/);
      if (!headerMatch) continue;

      const unityType = headerMatch[1];
      const fileId = headerMatch[2];
      const content = headerMatch[3];

      // MonoBehaviourコンポーネント（!u!114）を対象とする
      if (unityType === '114' && content.includes('MonoBehaviour:')) {
        const component = UnityPrefab.parseMonoBehaviourComponent(
          fileId,
          unityType,
          content,
          doc, // rawYaml
        );
        components.push(component);
      }
    }

    return components;
  }

  /**
   * 個々のMonoBehaviourコンポーネントの解析
   */
  private static parseMonoBehaviourComponent(
    fileId: string,
    unityType: string,
    content: string,
    rawYaml: string,
  ): PrefabComponent {
    // スクリプトGUIDの抽出
    const scriptGuidMatch = content.match(
      /m_Script: \{fileID: \d+, guid: ([a-f0-9A-F]+), type: 3\}/,
    );
    const scriptGuid = scriptGuidMatch?.[1];

    // プロパティの抽出
    const properties: Record<string, string> = {};

    const lines = content.split(/\r?\n/);
    let insideMonoBehaviour = false;

    for (const line of lines) {
      if (line.includes('MonoBehaviour:')) {
        insideMonoBehaviour = true;
        continue;
      }

      if (!insideMonoBehaviour) continue;

      // 基本プロパティの抽取（2スペースインデント）
      const propertyMatch = line.match(/^ {2}(\w+): (.+)$/);
      if (propertyMatch) {
        const key = propertyMatch[1];
        const value = propertyMatch[2].trim();
        properties[key] = value;
      }
    }

    return {
      fileId,
      unityType,
      scriptGuid,
      properties,
      rawYaml,
    };
  }

  /**
   * YAML内容のプロパティ更新
   */
  private static updateYamlProperties(
    yamlContent: string,
    newProperties: Record<string, string>,
  ): string {
    let updatedYaml = yamlContent;

    for (const key in newProperties) {
      const propertyPattern = new RegExp(`^(\\s+${key}:)\\s*(.*)$`, 'gm');
      const match = propertyPattern.exec(updatedYaml);
      if (!match) continue;

      // 既存プロパティの値を置換
      const oldPropertyLine = match[0];
      const newPropertyLine = `${match[1]} ${newProperties[key]}`;
      updatedYaml = updatedYaml.replace(oldPropertyLine, newPropertyLine);
    }

    return updatedYaml;
  }
}
