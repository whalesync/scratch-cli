'use client';

import { List } from '@mantine/core';
import Link from 'next/link';
import MainContent from '../components/layouts/MainContent';

export default function DevListPage() {
  return (
    <MainContent>
      <MainContent.BasicHeader title="Dev tools" />
      <MainContent.Body>
        <List>
          <List.Item>
            <Link href="/dev/gallery">Component gallery</Link>
          </List.Item>
        </List>
      </MainContent.Body>
      <MainContent.Footer></MainContent.Footer>
    </MainContent>
  );
}
