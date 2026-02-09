'use client';

import { redirect, useParams } from 'next/navigation';

/**
 * Redirect /workbook/<id> to /workbook/<id>/files
 */
export default function WorkbookRedirectPage() {
  const params = useParams<{ id: string }>();
  redirect(`/workbook/${params.id}/files`);
}
