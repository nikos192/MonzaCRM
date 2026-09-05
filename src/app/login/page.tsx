import { Login } from '@/components/login';
import { demoEnabled, isConfigured } from '@/lib/env';
export const dynamic = 'force-dynamic';
export default function Page() {
  return <Login demo={demoEnabled()} configured={isConfigured()} />;
}
