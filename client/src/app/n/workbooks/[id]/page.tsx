'use client';

import { redirect, useParams } from 'next/navigation';

/**
 * Redirect /n/workbooks/<id> to /n/workbooks/<id>/files
 */
export default function WorkbookRedirectPage() {
  const params = useParams<{ id: string }>();
  redirect(`/n/workbooks/${params.id}/files`);
}
