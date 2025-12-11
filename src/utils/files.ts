// ファイル操作、ファイルパス変換などファイルシステムに関するユーティリティ
// これらの関数群はパッケージ外には公開しない

/**
 * UTF-8バイト配列を文字列に変換する
 * @param bytes Uint8Array
 * @returns 文字列
 */
export function uint8ArrayToString(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}
