import { Paper, Text, ScrollArea, Table } from '@mantine/core';
import type { UnityAsset } from 'unitypackage-js';
import { formatBytes } from '../utils/format';

interface AssetListProps {
  assets: ReadonlyMap<string, UnityAsset>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function AssetList({ assets, selectedPath, onSelect }: AssetListProps) {
  return (
    <Paper
      withBorder
      p="0"
      h={600}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <Paper
        p="xs"
        withBorder
        style={{
          borderBottom: '1px solid #eee',
          borderTop: 0,
          borderLeft: 0,
          borderRight: 0,
        }}
      >
        <Text fw={700} size="sm">
          Assets
        </Text>
      </Paper>
      <ScrollArea style={{ flex: 1 }}>
        <Table striped highlightOnHover withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>File Name</Table.Th>
              <Table.Th>Size</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from(assets.keys()).map((path) => {
              const asset = assets.get(path);
              const fileName = path.split('/').pop() || path;
              const size = asset?.assetData?.byteLength || 0;
              const isSelected = path === selectedPath;

              return (
                <Table.Tr
                  key={path}
                  onClick={() => onSelect(path)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-blue-1)'
                      : undefined,
                  }}
                >
                  <Table.Td
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px',
                    }}
                    title={path}
                  >
                    <Text size="sm" fw={isSelected ? 700 : 400}>
                      {fileName}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {path}
                    </Text>
                  </Table.Td>
                  <Table.Td width={100}>
                    <Text size="xs">{formatBytes(size)}</Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Paper>
  );
}
