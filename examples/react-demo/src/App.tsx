import { useState, useMemo } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  FileButton,
  Paper,
  Code,
  Table,
  Grid,
  ScrollArea,
  Badge,
} from '@mantine/core';
import {
  importUnityPackage,
  exportUnityPackage,
  type UnityPackageInfo,
} from 'unitypackage-js';

// Helper to download ArrayBuffer
const downloadBlob = (data: ArrayBuffer, filename: string) => {
  const blob = new Blob([data], { type: 'application/gzip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper for file size
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [packageInfo, setPackageInfo] = useState<UnityPackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleImport = async (file: File | null) => {
    if (!file) return;
    setFile(file);
    setLoading(true);
    setPackageInfo(null);
    setSelectedPath(null);
    try {
      const buffer = await file.arrayBuffer();
      const info = await importUnityPackage(buffer);
      setPackageInfo(info);
    } catch (error) {
      console.error(error);
      alert('Failed to parse unitypackage');
    } finally {
      setLoading(false);
    }
  };

  const handleRepackageDownload = async () => {
    if (!packageInfo) return;
    setLoading(true);
    try {
      // Re-export the current packageInfo
      const buffer = await exportUnityPackage(packageInfo);
      downloadBlob(buffer, file ? file.name : 'repackaged.unitypackage');
    } catch (error) {
      console.error(error);
      alert('Failed to export unitypackage');
    } finally {
      setLoading(false);
    }
  };

  const selectedAsset = useMemo(() => {
    if (!packageInfo || !selectedPath) return null;
    return packageInfo.assets.get(selectedPath);
  }, [packageInfo, selectedPath]);

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        {/* Header Area */}
        <Group justify="space-between" align="center">
          <Title order={2}>UnityPackage Viewer</Title>
        </Group>

        {/* Action Buttons Area */}
        <Paper withBorder p="md">
          <Group justify="center">
            <FileButton onChange={handleImport} accept=".unitypackage">
              {(props) => (
                <Button {...props} loading={loading} size="lg">
                  Load .unitypackage
                </Button>
              )}
            </FileButton>
            <Button
              onClick={handleRepackageDownload}
              disabled={!packageInfo}
              loading={loading}
              variant="outline"
              size="lg"
            >
              Repackage & Download
            </Button>
          </Group>
        </Paper>

        {/* Basic Info Area */}
        {packageInfo && (
          <Paper withBorder p="md" bg="gray.0">
            <Group>
              <Text fw={700}>Loaded Package:</Text>
              <Text>{file?.name}</Text>
              <Badge color="blue">{packageInfo.assets.size} Assets</Badge>
            </Group>
          </Paper>
        )}

        {packageInfo && (
          <Grid>
            {/* Asset List Area */}
            <Grid.Col span={{ base: 12, md: 6 }}>
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
                      {Array.from(packageInfo.guidToPath.values()).map(
                        (path) => {
                          const asset = packageInfo.assets.get(path);
                          const fileName = path.split('/').pop() || path;
                          const size = asset?.assetData?.byteLength || 0;
                          const isSelected = path === selectedPath;

                          return (
                            <Table.Tr
                              key={path}
                              onClick={() => setSelectedPath(path)}
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
                        },
                      )}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
            </Grid.Col>

            {/* Asset Detail Area */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper withBorder p="md" h={600} style={{ overflowY: 'auto' }}>
                {selectedAsset ? (
                  <Stack gap="md">
                    <Title order={4}>Asset Details</Title>

                    <Stack gap="xs">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Path
                      </Text>
                      <Code block>{selectedAsset.assetPath}</Code>
                    </Stack>

                    <Group grow>
                      <Stack gap="xs">
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          File Name
                        </Text>
                        <Text>{selectedAsset.assetPath.split('/').pop()}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Size
                        </Text>
                        <Text>
                          {formatBytes(
                            selectedAsset.assetData?.byteLength || 0,
                          )}
                        </Text>
                      </Stack>
                    </Group>

                    <Stack gap="xs">
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        GUID
                      </Text>
                      <Code>{selectedAsset.guid}</Code>
                    </Stack>

                    {selectedAsset.metaData && (
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
                            {new TextDecoder().decode(selectedAsset.metaData)}
                          </Code>
                        </ScrollArea>
                      </Stack>
                    )}

                    {selectedAsset.previewData && (
                      <Stack gap="xs">
                        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                          Preview Image
                        </Text>
                        {/* Create object URL for preview if exists */}
                        <img
                          src={URL.createObjectURL(
                            new Blob([
                              selectedAsset.previewData as unknown as BlobPart,
                            ]),
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
                ) : (
                  <Text c="dimmed" ta="center" pt="xl">
                    Select an asset to view details
                  </Text>
                )}
              </Paper>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </Container>
  );
}

export default App;
