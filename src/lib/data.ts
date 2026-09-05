import 'server-only';
import { emptyData, type Data } from './types';
import { requireApproved } from './supabase/server';
export async function loadData() {
  const { db, user } = await requireApproved();
  const data = emptyData();
  await Promise.all(
    (Object.keys(data) as (keyof Data)[]).map(async (table) => {
      // Page through PostgREST's response cap; never silently truncate analytics.
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: page, error } = await db
          .from(table)
          .select('*')
          .order('id')
          .range(offset, offset + 999);
        if (error)
          throw new Error(`Unable to load ${table}. Check migrations and access policies.`);
        rows.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      Object.assign(data, { [table]: rows });
    }),
  );
  return { data, userId: user.id };
}
