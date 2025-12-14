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
} from '@mantine/core';
import type { UnityAsset } from 'unitypackage-js';
import { useState } from 'react';
import { formatBytes } from '../utils/format';

interface AssetDetailProps {
  asset: UnityAsset | null;
  onRename: (newPath: string) => void;
  onUpdateGuid: (newGuid: string) => void;
  onAutoGuid: () => void;
}

export function AssetDetail({
  asset,
  onRename,
  onUpdateGuid,
  onAutoGuid,
}: AssetDetailProps) {
  const [editingPath, setEditingPath] = useState(asset?.assetPath ?? '');
  const [editingGuid, setEditingGuid] = useState(asset?.guid ?? '');

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
      </Stack>
    </Paper>
  );
}
