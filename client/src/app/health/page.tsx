'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Code, Group, Badge } from '@mantine/core';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHealthData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();
  }, []);

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Title order={1} ta="center" mb="xl">
          Health Check
        </Title>
        <Text ta="center">Loading health status...</Text>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="md" py="xl">
        <Title order={1} ta="center" mb="xl">
          Health Check
        </Title>
        <Text color="red" ta="center">
          Error: {error}
        </Text>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Title order={1} ta="center" mb="xl">
        Health Check
      </Title>
      
      {healthData && (
        <div>
          <Group mb="md">
            <Badge 
              color={healthData.status === 'healthy' ? 'green' : 'red'}
              size="lg"
            >
              {healthData.status}
            </Badge>
          </Group>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <Text size="sm" color="dimmed">Timestamp</Text>
              <Code>{healthData.timestamp}</Code>
            </div>
            
            <div>
              <Text size="sm" color="dimmed">Uptime</Text>
              <Code>{Math.round(healthData.uptime)} seconds</Code>
            </div>
            
            <div>
              <Text size="sm" color="dimmed">Environment</Text>
              <Code>{healthData.environment}</Code>
            </div>
            
            <div>
              <Text size="sm" color="dimmed">Version</Text>
              <Code>{healthData.version}</Code>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
} 