import { redirect, notFound } from 'next/navigation';
import { loadData } from '@/lib/data';
import { isConfigured } from '@/lib/env';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  const page = section?.[0] ?? 'dashboard';
  if (
    (section?.length ?? 0) > 1 ||
    !['dashboard', 'leads', 'pipeline', 'follow-ups', 'orders', 'customers', 'settings'].includes(
      page,
    )
  )
    notFound();
  if (!isConfigured()) redirect('/login');
  let result;
  try {
    result = await loadData();
  } catch (e) {
    if (e instanceof Error && ['UNAUTHENTICATED', 'UNAPPROVED'].includes(e.message))
      redirect('/login');
    throw e;
  }
  return <Workspace data={result.data} userId={result.userId} section={page} />;
}
