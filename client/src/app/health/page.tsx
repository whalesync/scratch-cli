'use client';

import { Container } from '@mantine/core';
import { TextMdRegular } from '../components/base/text';

export default function HealthPage() {
  return (
    <Container size="sm" p="xl">
      <TextMdRegular>Alive!</TextMdRegular>
    </Container>
  );
}
