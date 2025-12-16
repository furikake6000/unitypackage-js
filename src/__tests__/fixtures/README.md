# Test fixtures

UnityPackageの操作テスト用のファイル群です。

- `minimal.unitypackage`: 最小構成のUnityPackageファイルです。単一のテキストアセット`README.md`のみを含んでいます。
- `standard.unitypackage`: 標準的な用途を想定したUnityPackageファイルです。以下を含んでいます。
  - `DummyScript.cs`: 何もしないシンプルなC#スクリプト
  - `Animations`
    - `Hop.anim`: オブジェクトの座標を動かすアニメーション(PositionCurve使用)
    - `TextureMove.anim`: テクスチャのUV座標を動かすアニメーション(FloatCurve使用)
    - `Cube.controller`: アニメーターコントローラー
  - `Materials`
    - `Colorful.mat`: デフォルト設定の基本マテリアル
    - `Colorful.png`: シンプルなテクスチャ画像
  - `Cube.prefab`: 上記スクリプト、アニメーション、マテリアルを参照するCubeのGameObject
  - `README.md`: 説明が書かれたテキストファイル
