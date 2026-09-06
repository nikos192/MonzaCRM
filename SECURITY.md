# Security architecture and launch review

**Review status:** local implementation reviewed; automated embedded PostgreSQL and browser tests included. A hosted Supabase project and deployment have not been configured or certified. Do not treat a passing local build as production approval.

## Trust boundaries

- Private CRM pages call `loadData()` → `requireApproved()` → Supabase `auth.getUser()` and an `approved_users` lookup. Route handlers repeat these checks. Unconfigured systems fail closed.
- Supabase SSR cookies refresh through Next.js Proxy. Identity is verified on the server; no browser-only permission checks or trust in a client-supplied user ID.
- All public-schema CRM/internal tables enable Row Level Security. Anonymous table privileges are revoked. The authenticated role receives explicit minimum table grants.
- Approved users are peers and intentionally share all business records. A different valid record UUID is accessible to either approved user by design. An unapproved/anonymous caller receives no customer rows and cannot write them.
- `approved_users` can only be read for the caller’s own row, and cannot be edited by ordinary accounts. Profiles are not permissions. Account approval/revocation requires the trusted Supabase administration boundary.
- `is_approved()` is a small security-definer lookup with an empty fixed search path, fully qualified names and no dynamic SQL. Audit/profile functions also fix their search paths and are not exposed as callable application RPCs.

## Database security and integrity

`profiles`, `approved_users`, `activity_logs`, quote revisions and stage histories are read-only for approved browser clients. Audit and revision tables are populated by database triggers; callers cannot forge, edit or remove history. Actor stamps use `auth.uid()`, overriding supplied message/payment/file/follow-up authors.

Lead creation and order conversion are database transactions. Customer matching is serialised for this low-volume workspace. Lead vehicle/customer consistency is enforced by a composite foreign key. One order and one current quote per lead are enforced with unique constraints; historical quote revisions are separate immutable records. Orders retain a fixed agreed price and cannot be reassigned to a different lead. Payments lock their order before checking net receipts against its price. Shipping requires a fully recorded balance plus tracking/provider/date; delivery requires a delivery date.

Important records use archive timestamps; normal clients have no hard-delete privilege on them. Files have an explicit confirmed removal path. Both approved users may archive records. Archiving does not destroy the customer/order history.

## API and session protections

- Same-origin checks guard cookie-authenticated mutation routes (CRM, login/logout and file operations). Cross-origin POST/DELETE requests fail before mutations.
- Strict Zod schemas allowlist tables, fields, UUIDs, amounts, statuses and bounded strings. Client-supplied actor/approval/service fields are rejected. Database constraints remain authoritative for direct REST callers.
- JSON reads are streamed and capped before parsing. Malformed bodies return 400, oversized bodies 413. Auth and API errors do not serialize credentials or database request contents.
- No `dangerouslySetInnerHTML` or customer HTML rendering. React escapes stored message/notes/contact text. File names are sanitised on upload.
- CSP restricts origins, framing, objects and base URIs. `script-src 'unsafe-inline'` remains for Next.js hydration; this is not a nonce-based CSP. Development additionally allows `unsafe-eval`. `X-Frame-Options`, `nosniff`, referrer and permissions policies are set.
- Private API reads explicitly disable caching. Authenticated requests receive private/no-store headers. Do not add CDN public caching to CRM routes.
- Supabase Auth supplies password-login rate controls. Review/configure these for the real project and use hosting-edge rules for abusive traffic. The app does not claim a distributed pre-auth login limiter of its own.

## Secrets and intake

The publishable key is public by design and requires tested RLS. The secret key exists only in the intake server route and developer/administration scripts; all normal CRM/file requests use the caller’s Supabase session. `.env*` files are ignored except the empty example. The server-only boundary protects privileged helpers. Runtime startup validates supplied Supabase values and secret length.

The website endpoint authenticates a server-side bearer secret using constant-time digest comparison. It validates a honeypot and payload, and uses an atomic PostgreSQL counter (30 authenticated requests/minute globally). It fails closed if limiting fails. The service-only intake RPC makes request UUIDs idempotent. Website-side per-client limits/CAPTCHA and edge protection for invalid-secret floods remain external deployment responsibilities. Intake failure logging omits customer payloads and secrets.

The assisted importer requires an approved CRM session and same-origin request. Its OpenAI key remains server-only. Pasted text is bounded to 30 KB, limited to 10 parsing requests per approved user per minute, sent with `store: false`, and constrained to a strict structured schema. Model output is treated as untrusted, validated again by the server, and shown for human review before database writes. The model receives no database credentials or tools.

## Storage

`crm-files` is private. Storage object policies require current approved membership for read/create/delete. Metadata carries lead/customer/order linkage and database-generated uploader identity. The server checks object size, allowed MIME types and signatures (JPEG/PNG/WebP/PDF); the bucket also constrains type/size. Maximum 4 MiB accommodates Vercel function request limits.

Download routes look up metadata through RLS, then issue 60-second signed attachment downloads. These URLs are bearer capabilities during their brief lifetime; revocation cannot invalidate an already issued link immediately. No public file links are stored or shown. Approved staff intentionally share file access.

There is no malware scanning/content-disarm service. Format checks do not prove a file harmless. Staff must treat uploaded documents as untrusted content. Storage object deletion and metadata deletion span two services and cannot be one transaction; a rare partial failure may leave a stale metadata row, and a failed upload cleanup can leave an orphan object. Reconcile these during maintenance. Attachment history is retained in audit logs after removal.

## Payments, demo and privacy

Only business payment records belong here. Never enter card numbers, CVVs, bank passwords or secrets in any notes/reference field. The UI records payments already received; it cannot charge customers. Refund conventions are documented in the README. This MVP is not accounting/invoicing software.

The development demo only uses fictional `example.com` customers and browser-local persistence, with no access to authenticated API data. Production cannot open it unless `ENABLE_DEMO=true` is deliberately set. Demo persistence is not encrypted or a customer data store. Do not enter real data into it.

Audit metadata deliberately retains previous and new business values to make changes traceable. It can include historical customer messages, notes and contact information; it remains protected by RLS. Establish retention/export/deletion practices appropriate to the business. No AI provider receives anything by default.

## Automated verification

`npm test` executes the actual baseline migration in PGlite PostgreSQL, with representative `auth.users`, `auth.uid()`, `storage.objects`, buckets and anon/authenticated/service roles. It verifies:

- Every table has RLS; anonymous grants are removed.
- Unapproved accounts cannot read customer data, insert records, self-approve or forge audit events.
- Approved CRUD, immediately effective revocation and restored approval.
- Transaction rollback, customer matching, stage history, quote revisions and immutable audit records.
- Follow-up identity stamping and deposit-to-order conversion, including duplicate conversion rejection.
- Overpayment rejection, fixed order price, balance-gated shipping and required tracking/date fields.
- Private bucket state and storage object policy enforcement for approved/unapproved callers.
- Service-only rate limiting and idempotent website intake.

`npm run test:e2e` checks unauthenticated pages/APIs, a full demo sales workflow, reload persistence, drag/drop, global search, navigation and mobile overflow.

`npm run test:rls` is a separate **hosted Supabase** verification script using real approved/unapproved test credentials. It checks direct REST and Storage API access and public/signed URLs. Local PostgreSQL policy testing is not a substitute for executing this against the deployed schema or validating Supabase Auth cookie behaviour.

## Known limits and residual risks

- No live Supabase credentials were available for this build. Hosted Auth, Storage signed URLs, PostgREST and deployment-origin behaviour still need end-to-end testing.
- No backups, PITR, domain, production deployment, monitoring, alerting or disaster recovery have been provisioned by the code. Test restorability, including Storage files.
- Simultaneous field edits are last-writer-wins; audit history captures changes but there is no conflict-resolution UI. Refresh before editing shared records.
- Full workspace snapshots are appropriate for the initial two-person workload, not large-scale use. Introduce server-side pagination/search/aggregates before datasets or audit histories grow substantially. Client memory contains approved data until navigation/reload; revocation prevents new API access, not retroactive erasure of already downloaded records.
- No MFA challenge UI, automatic provisioning/invitation flow, password-reset UI, document malware scan, automated retention purge or external message/payment provider is implemented. Handle account recovery through trusted Supabase administration for this MVP.
- Contact matching uses case-insensitive email and digit-normalised phone, but is not a complete international phone canonicalisation or automated duplicate merge system.
- All approved people intentionally have equal access. If the team grows, review roles and data-sharing requirements before approving more users.

## Production gate

- [ ] Apply the migration to the intended Supabase project and inspect grants/RLS for all tables.
- [ ] Disable public Auth signup; create and approve only the intended Nikos and Max accounts.
- [ ] Configure strong credentials and Auth rate protections. Decide on an MFA implementation before claiming MFA protection.
- [ ] Run hosted RLS checks using an approved and an unapproved account; confirm anonymous REST and public Storage URLs fail.
- [ ] Test real browser login/logout for both people, an unapproved account and a revoked account.
- [ ] Test a complete database-backed fictional enquiry-to-delivery workflow, refreshes, repeated drags and two-user usage.
- [ ] Verify private uploads, signed downloads/expiry, forbidden formats, file removal and orphan cleanup.
- [ ] Set only server-scoped service/intake secrets; check client assets and Git history for leaked credentials.
- [ ] Configure deployment environment, HTTPS domain, Supabase Site/redirect URLs and `ENABLE_DEMO=false`.
- [ ] Test intake validation, retries, rate limiting, honeypot, website server credentials and failure handling.
- [ ] Configure separate production/preview projects and appropriate hosting-edge abuse controls.
- [ ] Configure database and Storage backups, test a restore and document recovery ownership.
- [ ] Review payment/refund conventions, quote tax wording, privacy retention, monitoring and access review ownership.
- [ ] Only then begin entering real customer information.
