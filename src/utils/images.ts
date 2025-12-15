/**
 * 画像データを読み込み、指定されたサイズ(正方形)のサムネイルを生成して返す
 * アスペクト比を維持しつつ、中央に配置（余白は透明）する
 * @param imageData 元画像のデータ
 * @param size 生成するサムネイルのサイズ（幅・高さ）
 * @param mimeType 画像のMIMEタイプ
 */
export async function generateSquareThumbnail(
  imageData: Uint8Array,
  size: number,
  mimeType: string = 'image/png',
): Promise<Uint8Array> {
  // ブラウザ環境チェック
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Canvas APIがサポートされていません');
  }

  let rawUrl: string | null = null;

  try {
    const blob = new Blob([imageData as unknown as BlobPart], {
      type: mimeType,
    });
    rawUrl = URL.createObjectURL(blob);

    // 画像読み込み
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.src = rawUrl!;
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvasコンテキストの取得に失敗しました');
    }

    // --- 描画ロジック ---
    const { width, height } = image;
    if (width === 0 || height === 0) throw new Error('画像のサイズが無効です');

    const aspectRatio = width / height;
    let drawWidth = size,
      drawHeight = size,
      offsetX = 0,
      offsetY = 0;

    if (aspectRatio > 1) {
      drawHeight = size / aspectRatio;
      offsetY = (size - drawHeight) / 2;
    } else if (aspectRatio < 1) {
      drawWidth = size * aspectRatio;
      offsetX = (size - drawWidth) / 2;
    }

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    // ---------------------------------------------

    // 変換処理
    const resultBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png', 1.0),
    );

    if (!resultBlob || resultBlob.size === 0) {
      throw new Error('サムネイル生成に失敗しました');
    }

    // Blob -> Uint8Array
    const arrayBuffer = await resultBlob.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('ファイル読み込み結果が空です');
    }

    return new Uint8Array(arrayBuffer);
  } finally {
    if (rawUrl) URL.revokeObjectURL(rawUrl);
  }
}
