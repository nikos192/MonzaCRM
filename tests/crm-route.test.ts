import { beforeEach, describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/supabase/server', () => ({ requireApproved: vi.fn() }));
vi.mock('../src/lib/data', () => ({ loadData: vi.fn() }));
import { requireApproved } from '../src/lib/supabase/server';
import { POST } from '../src/app/api/crm/route';
import { makeDemo } from '../src/lib/demo';

const lead = makeDemo().leads[0];
const request = () =>
  new Request('http://localhost/api/crm', {
    method: 'POST',
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'save', table: 'leads', id: lead.id, values: { call_step: 2 } }),
  });
beforeEach(() => vi.resetAllMocks());
function database(pages: unknown[][], activityError = false) {
  const range = vi.fn().mockImplementation(async () => ({
    data: pages.shift() ?? [],
    error: activityError ? { message: 'Unavailable' } : null,
  }));
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['update', 'select', 'eq', 'order']) chain[method] = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: lead, error: null }));
  chain.range = range;
  const from = vi.fn((table: string) => {
    void table;
    return chain;
  });
  vi.mocked(requireApproved).mockResolvedValue({ db: { from }, user: { id: 'staff' } } as never);
  return { from, range, chain };
}
describe('lead save response', () => {
  it('returns the saved row and complete paginated history without reading unrelated tables', async () => {
    const page = Array.from({ length: 1000 }, (_, id) => ({ id: String(id) }));
    const { from, range, chain } = database([page, [{ id: 'last' }]]);
    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.leadPatch.lead).toEqual(lead);
    expect(body.leadPatch.activity_logs).toHaveLength(1001);
    expect(range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'leads',
      'activity_logs',
      'activity_logs',
    ]);
    expect(chain.eq).toHaveBeenCalledWith('entity_id', lead.id);
  });
  it('reports a committed save as successful if history retrieval fails, allowing a refresh fallback', async () => {
    database([], true);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: lead });
  });
  it('still requires an approved account before touching the database', async () => {
    vi.mocked(requireApproved).mockRejectedValue(new Error('UNAPPROVED'));
    expect((await POST(request())).status).toBe(403);
  });
});
