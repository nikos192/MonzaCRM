import 'server-only';
export type ReplyContext = {
  firstName: string;
  vehicle: string;
  wheelSetup: string;
  quote: number | null;
  stage: string;
  notes: string;
  messages: { direction: string; content: string }[];
};
export interface ReplyProvider {
  generate(context: ReplyContext): Promise<string>;
}
export async function generateLeadReply(context: ReplyContext, provider?: ReplyProvider) {
  if (!provider) return { available: false as const, reason: 'AI replies are not configured.' };
  const scoped = {
    ...context,
    notes: context.notes.slice(0, 2000),
    messages: context.messages.slice(-12).map((m) => ({ ...m, content: m.content.slice(0, 2000) })),
  };
  return { available: true as const, reply: await provider.generate(scoped) };
}
