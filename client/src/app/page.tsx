import { redirect } from 'next/navigation';
import { RouteUrls } from '@/utils/route-urls';

export default function HomePage() {
  redirect(RouteUrls.workbooksPageUrl);
}

