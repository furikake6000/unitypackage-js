import { useState } from 'react';
import { Container, Title, Stack, Group, Grid } from '@mantine/core';
import { UnityPackage } from 'unitypackage-js';
import { ActionArea } from './components/ActionArea';
import { PackageInfo } from './components/PackageInfo';
import { AssetList } from './components/AssetList';
import { AssetDetail } from './components/AssetDetail';

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

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [unityPackage, setUnityPackage] = useState<UnityPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [, setVersion] = useState(0);

  const selectedAsset =
    unityPackage && selectedPath ? unityPackage.assets.get(selectedPath) : null;

  const handleImport = async (file: File | null) => {
    if (!file) return;
    setFile(file);
    setLoading(true);
    setUnityPackage(null);
    setSelectedPath(null);
    try {
      const buffer = await file.arrayBuffer();
      const pkg = await UnityPackage.fromArrayBuffer(buffer);
      setUnityPackage(pkg);
    } catch (error) {
      console.error(error);
      alert('Failed to parse unitypackage');
    } finally {
      setLoading(false);
    }
  };

  const handleRepackageDownload = async () => {
    if (!unityPackage) return;
    setLoading(true);
    try {
      // Re-export the current unityPackage
      const buffer = await unityPackage.export();
      downloadBlob(buffer, file ? file.name : 'repackaged.unitypackage');
    } catch (error) {
      console.error(error);
      alert('Failed to export unitypackage');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = (newPath: string) => {
    if (!unityPackage || !selectedPath) return;
    try {
      if (selectedPath === newPath) return;

      const success = unityPackage.renameAsset(selectedPath, newPath);
      if (success) {
        setSelectedPath(newPath);
        setVersion((v) => v + 1);
      } else {
        alert('Rename failed: Asset not found or new path invalid');
      }
    } catch (e) {
      console.error(e);
      alert('Rename failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleUpdateGuid = (newGuid: string) => {
    if (!unityPackage || !selectedPath) return;
    try {
      const success = unityPackage.replaceAssetGuid(selectedPath, newGuid);
      if (success) {
        setVersion((v) => v + 1);
      } else {
        alert('GUID update failed');
      }
    } catch (e) {
      console.error(e);
      alert(
        'GUID update failed: ' + (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const handleAutoGuid = () => {
    if (!unityPackage || !selectedPath) return;
    try {
      const success = unityPackage.replaceAssetGuid(selectedPath);
      if (success) {
        setVersion((v) => v + 1);
      }
    } catch (e) {
      console.error(e);
      alert(
        'GUID update failed: ' + (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const handleRefreshThumbnail = async (size: number = 128) => {
    if (!unityPackage || !selectedPath) return;
    setLoading(true);
    try {
      await unityPackage.refreshThumbnail(selectedPath, size);
      setVersion((v) => v + 1);
    } catch (e) {
      console.error(e);
      alert(
        'Thumbnail refresh failed: ' +
          (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        {/* Header Area */}
        <Group justify="space-between" align="center">
          <Title order={2}>UnityPackage Viewer</Title>
        </Group>

        {/* Action Buttons Area */}
        <ActionArea
          loading={loading}
          hasPackage={!!unityPackage}
          onImport={handleImport}
          onDownload={handleRepackageDownload}
        />

        {/* Basic Info Area */}
        {unityPackage && (
          <PackageInfo
            fileName={file?.name}
            assetCount={unityPackage.assets.size}
          />
        )}

        {unityPackage && (
          <Grid>
            {/* Asset List Area */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <AssetList
                assets={unityPackage.assets}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            </Grid.Col>

            {/* Asset Detail Area */}
            <Grid.Col span={{ base: 12, md: 6 }}>
              <AssetDetail
                key={
                  selectedAsset
                    ? `${selectedAsset.assetPath}-${selectedAsset.guid}`
                    : 'empty'
                }
                asset={selectedAsset || null}
                onRename={handleRename}
                onUpdateGuid={handleUpdateGuid}
                onAutoGuid={handleAutoGuid}
                onRefreshThumbnail={handleRefreshThumbnail}
                loading={loading}
              />
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </Container>
  );
}

export default App;
