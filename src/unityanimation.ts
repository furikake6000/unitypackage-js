import * as yaml from 'js-yaml';

/**
 * Unity アニメーションファイルのキーフレーム情報
 */
export interface Keyframe {
  time: number;
  value: number;
  inSlope: number;
  outSlope: number;
  tangentMode: number;
  weightedMode: number;
  inWeight: number;
  outWeight: number;
}

/**
 * Unity アニメーションのFloat曲線情報
 */
export interface FloatCurve {
  attribute: string;
  path: string;
  keyframes: Keyframe[];
  classID: number;
}

/**
 * Unityアニメーションファイル情報
 */
export class UnityAnimation {
  // animation clipは非YAMLのヘッダーとYAMLのメイン部分に分かれている
  // このクラスで編集したいのは主にfloatCurvesのみで、他はあまり触りたくない
  // そのため、元のデータを保持し必要な部分のみを更新して再構築する
  private _originalYaml: string = '';
  private _animationName: string = '';
  private _floatCurves: FloatCurve[] = [];
  private _originalParsedData: Record<string, unknown> = {};

  // Note:
  //   このクラスはfloatCurvesにのみ対応しており、以下のcurveには未対応
  //   以下のcurveが含まれているanimationに対しての利用は非推奨
  // private _positionCurves: []
  // private _rotationCurves: []
  // private _scaleCurves: []
  // private _compressedRotationCurves: []
  // private _eulerCurves: []
  // private _pPtrCurves: []

  /**
   * YAML文字列からアニメーションデータを読み込み
   */
  constructor(yamlContent: string) {
    this._originalYaml = yamlContent;
    this.parseNameAndCurves();
  }

  /**
   * アニメーション名を取得
   */
  getName(): string {
    return this._animationName;
  }

  /**
   * アニメーション名を設定
   */
  setName(name: string): void {
    this._animationName = name;
  }

  /**
   * すべてのFloat曲線を取得
   */
  getFloatCurves(): FloatCurve[] {
    return this._floatCurves;
  }

  /**
   * 指定されたattributeとpathのFloat曲線を取得
   */
  getCurve(attribute: string, path: string): FloatCurve | undefined {
    return this._floatCurves.find(
      (c) => c.attribute === attribute && c.path === path,
    );
  }

  /**
   * Float曲線を追加または更新
   */
  addCurve(curve: FloatCurve): void {
    const existing = this.getCurve(curve.attribute, curve.path);
    if (existing) {
      existing.keyframes = curve.keyframes;
    } else {
      this._floatCurves.push(curve);
    }
  }

  /**
   * Float曲線を削除
   */
  removeCurve(attribute: string, path: string): void {
    this._floatCurves = this._floatCurves.filter(
      (c) => !(c.attribute === attribute && c.path === path),
    );
  }

  /**
   * 指定されたFloat曲線にキーフレームを追加
   */
  addKeyframe(attribute: string, path: string, keyframe: Keyframe): void {
    const curve = this.getCurve(attribute, path);
    if (curve) {
      curve.keyframes.push(keyframe);
      curve.keyframes.sort((a, b) => a.time - b.time);
    }
  }

  /**
   * 指定されたFloat曲線からキーフレームを削除（時間による検索）
   */
  removeKeyframe(attribute: string, path: string, time: number): void {
    const curve = this.getCurve(attribute, path);
    if (curve) {
      curve.keyframes = curve.keyframes.filter(
        (k) => Math.abs(k.time - time) > 0.001,
      );
    }
  }

  /**
   * 修正されたYAMLを出力
   */
  exportToYaml(): string {
    return this.rebuildYaml();
  }

  /**
   * m_FloatCurvesの変更をm_EditorCurvesに同期
   */
  private syncEditorCurves(): void {
    if (!this._originalParsedData.m_EditorCurves) {
      this._originalParsedData.m_EditorCurves = [];
    }

    // m_FloatCurvesをm_EditorCurves形式に変換
    this._originalParsedData.m_EditorCurves = this._floatCurves.map(
      (curve) => ({
        serializedVersion: 2,
        curve: {
          serializedVersion: 2,
          m_Curve: curve.keyframes.map((kf) => ({
            serializedVersion: 3,
            time: kf.time,
            value: kf.value,
            inSlope: kf.inSlope === Infinity ? 'Infinity' : kf.inSlope,
            outSlope: kf.outSlope === Infinity ? 'Infinity' : kf.outSlope,
            tangentMode: kf.tangentMode,
            weightedMode: kf.weightedMode,
            inWeight: kf.inWeight,
            outWeight: kf.outWeight,
          })),
          m_PreInfinity: 2,
          m_PostInfinity: 2,
          m_RotationOrder: 4,
        },
        attribute: curve.attribute,
        path: curve.path,
        classID: curve.classID,
        script: { fileID: 0 },
        flags: 16,
      }),
    );
  }

  /**
   * m_ClipBindingConstantのgenericBindingsを更新
   */
  private updateClipBindingConstant(): void {
    if (!this._originalParsedData.m_ClipBindingConstant) {
      this._originalParsedData.m_ClipBindingConstant = {
        genericBindings: [],
        pptrCurveMapping: [],
      };
    }

    const bindingConstant = this._originalParsedData.m_ClipBindingConstant as {
      genericBindings: unknown[];
      pptrCurveMapping: unknown[];
    };

    // 既存のFloat Curvesに対応するgenericBindingsを更新
    bindingConstant.genericBindings = this._floatCurves.map((curve) => ({
      serializedVersion: 2,
      path: curve.path,
      attribute: curve.attribute,
      script: { fileID: 0 },
      typeID: curve.classID,
      customType: 22,
      isPPtrCurve: 0,
      isIntCurve: 0,
      isSerializeReferenceCurve: 0,
    }));
  }

  /**
   * アニメーションクリップの設定を更新
   */
  private updateAnimationClipSettings(): void {
    if (!this._originalParsedData.m_AnimationClipSettings) {
      this._originalParsedData.m_AnimationClipSettings = {};
    }

    // 全キーフレームの時間範囲を計算
    let minTime = Infinity;
    let maxTime = -Infinity;

    this._floatCurves.forEach((curve) => {
      curve.keyframes.forEach((kf) => {
        minTime = Math.min(minTime, kf.time);
        maxTime = Math.max(maxTime, kf.time);
      });
    });

    if (minTime !== Infinity && maxTime !== -Infinity) {
      const settings = this._originalParsedData
        .m_AnimationClipSettings as Record<string, unknown>;
      settings.m_StartTime = minTime;
      settings.m_StopTime = maxTime;
    }
  }

  /**
   * YAML内のm_NameとFloatCurvesを解析
   */
  private parseNameAndCurves(): void {
    try {
      // AnimationClip部分のみを抽出
      const animationClipMatch = this._originalYaml.match(
        /AnimationClip:([\s\S]*?)(?=\n\S|$)/,
      );

      if (animationClipMatch) {
        const animationClipYaml = animationClipMatch[1];
        const parsed = yaml.load(animationClipYaml) as Record<string, unknown>;

        // 元のデータを保存（m_EditorCurvesやm_ClipBindingConstantなどを保持）
        this._originalParsedData = { ...parsed };

        // m_Nameを抽出
        this._animationName = (parsed.m_Name as string) || '';

        // m_FloatCurvesを抽出
        this._floatCurves = this.parseFloatCurvesFromParsed(
          (parsed.m_FloatCurves as unknown[]) || [],
        );
      } else {
        throw new Error('AnimationClip not found in YAML');
      }
    } catch (error) {
      console.error('UnityAnimation YAML parse error:', error);
      throw error;
    }
  }

  /**
   * 解析済みm_FloatCurvesからFloatCurve配列を生成
   */
  private parseFloatCurvesFromParsed(floatCurvesData: unknown[]): FloatCurve[] {
    interface ParsedKeyframe {
      time?: number;
      value?: number;
      inSlope?: number | string;
      outSlope?: number | string;
      tangentMode?: number;
      weightedMode?: number;
      inWeight?: number;
      outWeight?: number;
    }

    interface ParsedCurveData {
      attribute?: string;
      path?: string;
      classID?: number;
      curve?: {
        m_Curve?: ParsedKeyframe[];
      };
    }

    if (!Array.isArray(floatCurvesData)) return [];

    return floatCurvesData.map((curveData: unknown) => {
      const parsed = curveData as ParsedCurveData;
      return {
        attribute: parsed.attribute || '',
        path: parsed.path || '',
        classID: typeof parsed.classID === 'number' ? parsed.classID : 0,
        keyframes: (parsed.curve?.m_Curve || []).map((kf: ParsedKeyframe) => ({
          time: typeof kf.time === 'number' ? kf.time : 0,
          value: typeof kf.value === 'number' ? kf.value : 0,
          inSlope: this.parseNumericValue(kf.inSlope),
          outSlope: this.parseNumericValue(kf.outSlope),
          tangentMode: typeof kf.tangentMode === 'number' ? kf.tangentMode : 0,
          weightedMode:
            typeof kf.weightedMode === 'number' ? kf.weightedMode : 0,
          inWeight: typeof kf.inWeight === 'number' ? kf.inWeight : 0.33333334,
          outWeight:
            typeof kf.outWeight === 'number' ? kf.outWeight : 0.33333334,
        })),
      };
    });
  }

  /**
   * 数値またはInfinityを適切に解析
   */
  private parseNumericValue(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value === 'Infinity' || value === Infinity) return Infinity;
    if (value === '-Infinity' || value === -Infinity) return -Infinity;
    return 0;
  }

  /**
   * 元のYAMLを基に、変更された部分のみを更新して再構築
   */
  private rebuildYaml(): string {
    try {
      // AnimationClip部分を抽出
      const animationClipMatch = this._originalYaml.match(
        /AnimationClip:([\s\S]*?)(?=\n\S|$)/,
      );

      if (animationClipMatch) {
        // 関連するデータ構造を同期（this._originalParsedDataを更新）
        this.syncEditorCurves();
        this.updateClipBindingConstant();
        this.updateAnimationClipSettings();

        // 元のデータをベースに更新
        const updatedData = { ...this._originalParsedData };

        // データを更新（同期後のデータに基づいて）
        updatedData.m_Name = this._animationName;
        updatedData.m_FloatCurves = this.buildFloatCurvesData();

        // 新しいAnimationClipYAMLを生成
        const newAnimationClipYaml = yaml.dump(updatedData, {
          indent: 2,
          flowLevel: -1,
          noRefs: true,
        });

        // インデントを調整（元のインデントに合わせる）
        const indentedNewYaml = newAnimationClipYaml
          .split('\n')
          .map((line) => (line ? '  ' + line : line))
          .join('\n');

        // 元のYAMLの該当部分を置換
        return this._originalYaml.replace(
          /AnimationClip:[\s\S]*?(?=\n\S|$)/,
          `AnimationClip:\n${indentedNewYaml}`,
        );
      }

      throw new Error('AnimationClip not found for rebuild');
    } catch (error) {
      console.error('UnityAnimation YAML rebuild error:', error);
      throw error;
    }
  }

  /**
   * FloatCurves配列からUnity形式のデータ構造を生成
   */
  private buildFloatCurvesData(): unknown[] {
    return this._floatCurves.map((curve) => ({
      serializedVersion: 2,
      curve: {
        serializedVersion: 2,
        m_Curve: curve.keyframes.map((kf) => ({
          serializedVersion: 3,
          time: kf.time,
          value: kf.value,
          inSlope: kf.inSlope === Infinity ? 'Infinity' : kf.inSlope,
          outSlope: kf.outSlope === Infinity ? 'Infinity' : kf.outSlope,
          tangentMode: kf.tangentMode,
          weightedMode: kf.weightedMode,
          inWeight: kf.inWeight,
          outWeight: kf.outWeight,
        })),
        m_PreInfinity: 2,
        m_PostInfinity: 2,
        m_RotationOrder: 4,
      },
      attribute: curve.attribute,
      path: curve.path,
      classID: curve.classID,
      script: { fileID: 0 },
      flags: 16,
    }));
  }
}
