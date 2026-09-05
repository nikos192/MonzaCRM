import { notFound } from 'next/navigation';
import { demoEnabled } from '@/lib/env';
import { makeDemo, demoId } from '@/lib/demo';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Demo({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!demoEnabled()) notFound();
  const { view } = await searchParams;
  return <Workspace data={makeDemo()} userId={demoId(1)} demo section={view ?? 'dashboard'} />;
}
