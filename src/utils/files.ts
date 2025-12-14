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

/**
 * 新しいGUIDを生成する
 * @returns 新しい32文字のGUID
 */
export function generateNewGuid(): string {
  // Unity GUIDは32文字の16進数文字列（小文字）
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
