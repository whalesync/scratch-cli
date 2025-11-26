import { RouteUrls } from '@/utils/route-urls';
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect(RouteUrls.workbooksPageUrl);
}
