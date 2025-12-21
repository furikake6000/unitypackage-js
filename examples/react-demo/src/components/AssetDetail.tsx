import {
  Paper,
  Stack,
  Title,
  Text,
  Code,
  Group,
  ScrollArea,
  TextInput,
  Button,
  NumberInput,
} from '@mantine/core';
import type { UnityAsset, UnityPackage } from 'unitypackage-js';
import { useState } from 'react';
import { formatBytes } from '../utils/format';
import { AnimationEditor } from './AnimationEditor';
import { PrefabEditor } from './PrefabEditor';

interface AssetDetailProps {
  unityPackage: UnityPackage;
  asset: UnityAsset | null;
  onRename: (newPath: string) => void;
  onUpdateGuid: (newGuid: string) => void;
  onAutoGuid: () => void;
  onRefreshThumbnail: (size: number) => void;
  onUpdateAssetData: (assetPath: string, updatedData: Uint8Array) => void;
  loading: boolean;
}

export function AssetDetail({
  unityPackage,
  asset,
  onRename,
  onUpdateGuid,
  onAutoGuid,
  onRefreshThumbnail,
  onUpdateAssetData,
  loading,
}: AssetDetailProps) {
  const [editingPath, setEditingPath] = useState(asset?.assetPath ?? '');
  const [editingGuid, setEditingGuid] = useState(asset?.guid ?? '');
  const [thumbnailSize, setThumbnailSize] = useState<number | string>(128);

  // Check if asset is an image
  const isImage = asset
    ? /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(asset.assetPath)
    : false;

  if (!asset) {
    return (
      <Paper withBorder p="md" h={600}>
        <Text c="dimmed" ta="center" pt="xl">
          Select an asset to view details
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" h={600} style={{ overflowY: 'auto' }}>
      <Stack gap="md">
        <Title order={4}>Asset Details</Title>

        <Stack gap="xs">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Path
          </Text>
          <Group align="flex-end">
            <TextInput
              value={editingPath}
              onChange={(e) => setEditingPath(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button
              onClick={() => onRename(editingPath)}
              disabled={asset.assetPath === editingPath}
            >
              Rename
            </Button>
          </Group>
        </Stack>

        <Group grow>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              File Name
            </Text>
            <Text>{asset.assetPath.split('/').pop()}</Text>
          </Stack>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Size
            </Text>
            <Text>{formatBytes(asset.assetData?.byteLength || 0)}</Text>
          </Stack>
        </Group>

        <Stack gap="xs">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            GUID
          </Text>
          <Group align="flex-end">
            <TextInput
              value={editingGuid}
              onChange={(e) => setEditingGuid(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button
              onClick={() => onUpdateGuid(editingGuid)}
              disabled={asset.guid === editingGuid}
            >
              Update
            </Button>
            <Button variant="light" onClick={onAutoGuid}>
              Auto
            </Button>
          </Group>
        </Stack>

        {asset.metaData && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Meta Data (Raw)
            </Text>
            <ScrollArea h={200} type="always" offsetScrollbars>
              <Code
                block
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {new TextDecoder().decode(asset.metaData)}
              </Code>
            </ScrollArea>
          </Stack>
        )}

        {isImage && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Thumbnail
            </Text>
            <Group align="flex-end">
              <NumberInput
                value={thumbnailSize}
                onChange={setThumbnailSize}
                min={32}
                max={512}
                step={32}
                style={{ flex: 1 }}
                label="Size (px)"
                placeholder="128"
              />
              <Button
                onClick={() =>
                  onRefreshThumbnail(
                    typeof thumbnailSize === 'number' ? thumbnailSize : 128,
                  )
                }
                variant="outline"
                loading={loading}
              >
                Refresh Thumbnail
              </Button>
            </Group>
          </Stack>
        )}

        {asset.previewData && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Preview Image
            </Text>
            <img
              src={URL.createObjectURL(
                new Blob([asset.previewData as unknown as BlobPart]),
              )}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                objectFit: 'contain',
                border: '1px solid #eee',
              }}
            />
          </Stack>
        )}

        {asset.assetPath.toLowerCase().endsWith('.anim') && (
          <AnimationEditor
            unityPackage={unityPackage}
            asset={asset}
            onSave={(data) => onUpdateAssetData(asset.assetPath, data)}
          />
        )}

        {asset.assetPath.toLowerCase().endsWith('.prefab') && (
          <PrefabEditor
            unityPackage={unityPackage}
            asset={asset}
            onSave={(data) => onUpdateAssetData(asset.assetPath, data)}
          />
        )}
      </Stack>
    </Paper>
  );
}
