import { Paper, Group, Text, Badge } from '@mantine/core';

interface PackageInfoProps {
  fileName?: string;
  assetCount: number;
}

export function PackageInfo({ fileName, assetCount }: PackageInfoProps) {
  return (
    <Paper withBorder p="md" bg="gray.0">
      <Group>
        <Text fw={700}>Loaded Package:</Text>
        <Text>{fileName}</Text>
        <Badge color="blue">{assetCount} Assets</Badge>
      </Group>
    </Paper>
  );
}
