import { Group, FileButton, Button, Paper } from '@mantine/core';

interface ActionAreaProps {
  loading: boolean;
  hasPackage: boolean;
  onImport: (file: File | null) => void;
  onDownload: () => void;
}

export function ActionArea({
  loading,
  hasPackage,
  onImport,
  onDownload,
}: ActionAreaProps) {
  return (
    <Paper withBorder p="md">
      <Group justify="center">
        <FileButton onChange={onImport} accept=".unitypackage">
          {(props) => (
            <Button {...props} loading={loading} size="lg">
              Load .unitypackage
            </Button>
          )}
        </FileButton>
        <Button
          onClick={onDownload}
          disabled={!hasPackage}
          loading={loading}
          variant="outline"
          size="lg"
        >
          Repackage & Download
        </Button>
      </Group>
    </Paper>
  );
}
