# Unity Package Utils

UnityPackage（.unitypackage）ファイルの読み込み・変更・生成を行うライブラリです。クライアントサイドで完全に動作し、実際のUnityPackageファイルとの互換性を保証します。

## 概要

Unity PackageはUnityエディタで使用されるアセットパッケージ形式で、内部的にはtar.gz形式で圧縮されています。このライブラリは以下の機能を提供します：

- **tar.gz形式の完全サポート**: nanotar ライブラリによる軽量で高速な処理
- **UnityPackage構造解析**: GUID/pathname/asset/metaなどの解析
- **アセット操作API**: 画像・アニメーション・Prefabパラメータ等の置換・書き換え
- **ファイルの関連を保持したままリネーム**: 紐づけを保持したままGUID・ファイルパスを変更
- **クライアントサイド処理**: サーバー負荷なし、UGCアップロードなし

## インストール

// TBD

## 基本的な使い方

### 1. UnityPackageの読み込み

// TBD

### 2. アセット情報の取得

// TBD

### 3. アセットの変更

#### 画像ファイルの置き換え

// TBD

#### アニメーションの書き換え

// TBD

#### 構造化データの書き換え

// TBD

### 4. UnityPackageの再構築と出力

// TBD

## API リファレンス

// TBD
