# Monza Wheels CRM

A private, purpose-built workspace for managing an enquiry from first contact through custom wheel specifications, quotation, deposit, production, balance, shipping and delivery. Designed for Nikos and Max with equal access.

**Status:** implemented MVP with a runnable fictional demo, Supabase migration, automated business/database/browser tests, and deployment instructions. A real Supabase project, approved Auth accounts and deployment configuration are still required before real customer use. This repository does not claim that an unconfigured hosted environment is production-ready.

## Try it locally

Use Node.js 22.13+ (24 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000/demo**. No credentials are needed for the development demo. It is explicitly labelled, contains fictional people with `example.com` email addresses, and persists edits only in this browser’s local storage. Settings → General → Reset demo restores its initial records. Never enter real customer information into the demo.

Open **http://localhost:3000/login** for the private workspace. Without Supabase configuration, it shows setup instructions and disables sign-in; CRM routes redirect here. There is no authentication bypass or fallback to fake production statistics.

Demo availability is restricted to `next dev`, unless the server explicitly sets `ENABLE_DEMO=true`. Keep it false on the real CRM deployment.

## What works

- Dashboard calculated from records: new enquiries, due/overdue follow-ups, open quote value, deposits, revenue less refunds, conversion, production, outstanding balances, ready/shipped/delivered orders, attention queue and activity.
- Searchable/filterable lead table, reusable customer matching, editable contacts, vehicle details and enquiry notes.
- Drag-and-drop pipeline with persistent optimistic stage changes and author/time audit. Each lead card has separate three-step follow-up and call dials; increasing the call dial records the contact time. Stage selection in the lead workspace is the keyboard alternative.
- Lead workspace: Overview, Wheel Specs, Quote, Follow-Ups, Order, Files and Activity.
- Structured staggered fitment, construction, dimensions, offsets, tyres, finishes, clearance and supplier/customer notes.
- Quotes with discount/deposit validation and immutable revision history. Orders retain their agreed price even when the original quote is subsequently revised.
- Customer messaging is handled externally. Customer contact details remain visible in the CRM.
- Follow-up creation, completion/reopening, author stamps, snooze and rescheduling.
- Atomic deposit-to-order conversion. The original lead, vehicle, specifications and conversations remain linked.
- Order milestones, supplier references, render/production/QC dates, shipping and delivery tracking, and activity timeline.
- Payment and refund records; reconcile pending/failed records using Edit payment. No payment processing or payment credentials.
- Private image/PDF uploads, short-lived signed downloads and confirmed removal. File upload is disabled in demo mode.
- Customer garage, previous enquiries/orders and lifetime net payments; existing histories open into their lead workspace.
- Global search across names, contact details, Instagram, vehicles, registrations, lead/order IDs, tracking and supplier references; includes archived enquiries.
- Configurable stage names/colours/sort positions, lead sources, follow-up types and suppliers.
- Responsive desktop/tablet/mobile layouts, accessible forms, modal focus management, errors, loading, empty states and archive confirmations.

## Stack and structure

Next.js App Router, React, strict TypeScript, Tailwind CSS plus a custom design system, Supabase SSR Auth/Postgres/Storage, Zod, dnd-kit, Manrope served locally. Exact dependency versions are locked in `package-lock.json`.

```text
src/app/                 routes, API handlers and styles
src/components/          workspace, screens and reusable forms
src/lib/                 domain types, validation, analytics and demo reducer
src/lib/supabase/        server-only session-scoped client
supabase/migrations/     schema, RLS, triggers and transactional RPCs
tests/                   business tests and actual PostgreSQL policy tests
tests/e2e/               browser workflow and responsive tests
scripts/                 development seeding and hosted RLS verification
SECURITY.md              security architecture, review and launch checklist
```

Production CRUD uses a session-scoped Supabase client and RLS. The service-role key is used only by website intake and explicitly run administration/development scripts. There is no service-role CRM CRUD client.

## Supabase setup

1. Create a dedicated Supabase project in a suitable nearby region. Save its database password securely.
2. Copy `.env.example` to `.env.local` and enter the project URL and publishable key. These identify the API; RLS protects the data.
3. Apply every SQL file in `supabase/migrations` in filename order using the SQL editor, or use the CLI workflow below. The migrations run in transactions and create the private `crm-files` bucket and its policies.
4. In Authentication settings, disable public signup and configure password/security/rate-limit settings. Enable additional MFA controls according to your operational needs before relying on them; this MVP does not implement an MFA challenge screen.
5. Create two Auth users in Supabase, one for Nikos and one for Max, with verified business email addresses and strong passwords. Set optional user metadata `display_name` to `Nikos` / `Max`. Their profiles are created automatically.
6. Approve these exact accounts in SQL. Approval is deliberately unavailable to browser clients, preventing self-approval.

```sql
-- Substitute the two exact business email addresses you created.
insert into public.approved_users(user_id)
select id from auth.users
where email in ('nikos@YOUR-BUSINESS-DOMAIN', 'max@YOUR-BUSINESS-DOMAIN')
on conflict(user_id) do nothing;

-- Check the result: exactly the intended accounts.
select p.display_name, u.email
from public.approved_users a
join auth.users u on u.id = a.user_id
join public.profiles p on p.id = a.user_id;

-- Set profile display names if required.
update public.profiles set display_name = 'Nikos'
where id = (select id from auth.users where email = 'nikos@YOUR-BUSINESS-DOMAIN');

-- Revoke immediately when necessary (replace the UUID).
-- delete from public.approved_users where user_id = 'USER-UUID';
```

A profile existing is not proof of approval. Settings lists profiles and explicitly explains that only approved accounts can access data. Both approved users can edit every CRM business record; there are no artificial enterprise roles.

### CLI migrations

Use the Supabase CLI authenticated against your own account:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For a fresh local Supabase stack, install Docker, run `npx supabase init` once, then `npx supabase start` and `npx supabase db reset`. The latter resets the local database; do not point a reset operation at a real customer environment. Hosted setup via SQL editor does not require Docker.

The baseline migration is for a new CRM schema. Apply later versioned migrations once to existing installations rather than re-running the baseline. Auth users already present are backfilled into profiles.

## Environment variables

| Variable                               | Required for                     | Scope                                             |
| -------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Private CRM                      | Public project URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Private CRM                      | Public key, safe only with tested RLS             |
| `SUPABASE_SECRET_KEY`                  | Website intake, seed script      | **Server only; never public or browser-prefixed** |
| `LEAD_INTAKE_SECRET`                   | Website intake                   | Server only, at least 32 characters               |
| `OPENAI_API_KEY`                       | Assisted lead importer           | **Server only; never browser-prefixed**           |
| `OPENAI_MODEL`                         | Optional importer model override | Server; defaults to `gpt-5.4-mini`                |
| `ENABLE_DEMO`                          | Optional deployed demonstration  | Server; default false                             |
| `ALLOW_DEVELOPMENT_SEED`               | Seed script safety guard         | Must explicitly equal `true`                      |

The app validates any supplied Supabase pair and the intake secret at server startup. With neither Supabase value supplied, only the setup/login screen and explicitly enabled demo are available. Auth and write APIs fail closed. Never commit `.env.local`, passwords, service keys or test credentials.

## Storage

The migration creates one **private** `crm-files` bucket. Uploaded objects have paths `LEAD_UUID/RANDOM_UUID/sanitised-filename`. Metadata links to the lead, customer and order where applicable, with uploader identity generated by the database.

Supported types: JPEG, PNG, WebP and PDF, **up to 4 MiB**. The server checks declared MIME type and file signatures. SVG/HTML and arbitrary executables are excluded. Downloads require approved access and return 60-second signed links with attachment disposition.

The 4 MiB cap leaves headroom under Vercel’s [4.5 MB function payload limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). Larger CAD/engineering files would need a direct-to-storage signed-upload flow; that is not silently promised by the current upload UI. Storage itself also enforces the size/type cap.

Bucket policies protect direct Storage API calls, not just this application. A generated signed URL is a temporary bearer link and can remain usable until expiry after approval is revoked. Uploaded content is not malware-scanned; only open files from trusted business sources. Database backups do not replace Storage object backups.

## Seed an empty development database

The browser demo is available without seeding any database. For realistic database testing, use a **separate empty development project**.

```sh
ALLOW_DEVELOPMENT_SEED=true npm run seed
```

The script reads `.env.local` and requires the server-only secret key. It refuses a non-empty customer table. It creates nine fictional customers/vehicles spanning the requested BMW, Nissan, Mazda, Mercedes, Toyota and Audi examples, plus quotes, messages, follow-ups, orders, deposits and a supplier. It does not create or approve Auth accounts.

The seed is a developer utility, not a migration. A failed seed can leave partial fictional data; inspect/recreate that disposable development project before retrying. It never deletes records automatically.

## Website lead intake

`POST /api/leads/intake` is designed to be called by the **Monza website server** or a trusted integration such as Zapier, not directly by an untrusted browser with an embedded secret.

```http
POST /api/leads/intake
Authorization: Bearer YOUR_SERVER_SIDE_INTAKE_SECRET
Content-Type: application/json

{
  "request_id": "a125417a-138a-4c17-8ea4-1165db3c967e",
  "first_name": "Example",
  "last_name": "Customer",
  "email": "example@example.com",
  "phone": "+61 400 000 000",
  "make": "BMW",
  "model": "M4",
  "year": "2024",
  "chassis": "G82",
  "notes": "Interested in a staggered forged setup",
  "website": ""
}
```

- Generate one UUID per enquiry and reuse it on retries; a database transaction makes retries idempotent.
- Input is strictly validated, bounded to 12 KB, trimmed and rendered only as text. The optional `website` honeypot must be empty.
- A constant-time server secret check authenticates the sender. Missing configuration returns 503; missing/invalid auth returns 401; malformed input returns 400; oversized input returns 413.
- A PostgreSQL atomic counter allows 30 authenticated intake requests per minute across instances; excess returns 429 with `Retry-After`.
- Database errors and limiter failures fail closed. Failures do not log request bodies or secrets.
- Matching email/phone reuses the customer and creates a new enquiry and vehicle. It does not overwrite a customer’s existing contact details.
- The website server should additionally rate-limit its own public form and use CAPTCHA if needed. Add hosting-edge limits for floods of invalid credentials before this endpoint reaches the database.

Email/phone canonicalisation handles case, spacing and phone punctuation. It does not infer every international phone prefix equivalence, and ambiguous existing matches need operator cleanup.

## Assisted lead import

Approved staff can use **Import leads** from the dashboard or Leads page to paste up to 25 copied Meta lead-form results. The authenticated server sends the bounded text to the OpenAI Responses API with Structured Outputs and `store: false`, validates the returned fields, and presents every record for editing before save. The model has no database tools or credentials. Confirmed records are created through the existing database function in the **New Lead** stage with source **Facebook**, and existing customers are matched by email or phone.

Set `OPENAI_API_KEY` in Vercel Production and Preview to enable parsing. `OPENAI_MODEL` is optional. Missing configuration fails closed with a clear message; it does not affect ordinary CRM use.

## Messaging, AI and payments

Customer messaging is intentionally handled outside the CRM. The dormant messages table remains available for a future import or integration, but there is no messaging page or composer in the interface.

`src/lib/ai.ts` exposes `generateLeadReply(context, provider?)` and a provider interface. Without a provider it returns an unavailable result. Future providers receive a limited context and at most 12 bounded recent messages. Adding an API key alone does not enable an unimplemented integration.

Payments store amount, business type, provider name, reference, date, status and notes. A `Refund` with status `Paid` subtracts from net receipts. `Pending`, `Failed` and `Refunded` records do not count toward paid totals. Reconcile a prior payment through its edit action and review the audit trail; do not use both a refunded original and a paid refund for the same money. Overpayment/negative-net checks run in the database under an order lock.

Prices are AUD. No tax invoice or GST calculation is implied by the quote display. Confirm tax/accounting requirements with the business before adding invoice output. Orders keep the agreed sale price as a transaction snapshot; editing an enquiry quote does not silently alter an existing order.

## Tests and checks

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

`npm test` runs business validation and **the actual migration in PGlite’s PostgreSQL engine**, using representative Supabase Auth and Storage schemas and database roles. It verifies RLS, anonymous/unapproved denial, approved access, revocation, immutable audit history, quote revisions, follow-up authorship, lead/vehicle transactions, order conversion, balances, shipping constraints, storage object policies, service-only intake and distributed rate limits.

Browser tests exercise the complete demo workflow, reload persistence, real pointer drag/drop, global tracking search, all navigation screens, responsive layout and unauthenticated route/API denial. Screenshots/traces are local artifacts under `output/playwright` and `test-results` and are ignored by Git.

Embedded tests do **not** certify a hosted project’s Auth, PostgREST, Storage API, redirects or environment. After applying the migration, create approved and unapproved test accounts in a dedicated test project and supply these server-side environment variables:

```text
TEST_APPROVED_EMAIL
TEST_APPROVED_PASSWORD
TEST_UNAPPROVED_EMAIL
TEST_UNAPPROVED_PASSWORD
```

Then run:

```sh
npm run test:rls
```

The hosted test verifies direct REST reads/writes, private file downloads, public URL denial and signed URL permissions. It creates and removes one test file. It requires a separate unapproved account and never approves one automatically. Also test Nikos and Max through the real login UI and complete a real database-backed workflow with fictional customer data before launch.

## Deploy to Vercel

1. Complete the hosted Supabase setup and tests above; review `SECURITY.md`.
2. Push to a private repository without credentials. The current work has not been pushed or deployed automatically.
3. Import the Next.js repository into Vercel, use a supported Node version and `npm run build`.
4. Add the environment variables. Public Supabase values must exist at build time. Set `ENABLE_DEMO=false` for the private CRM. Use separate projects/keys for preview and production.
5. Deploy, then configure Supabase Auth’s Site URL and allowed redirect URLs for the exact deployment/domain, plus localhost for development where needed.
6. Optionally add `crm.monzawheels.com.au` in Vercel and follow its displayed DNS instructions. Verify HTTPS.
7. Run hosted RLS checks, sign in as both approved users, verify unapproved denial, upload/download/delete a fictional test file, and complete an enquiry-to-delivery test.
8. Configure database and Storage backups and verify a restore. Establish an owner for monitoring, access review and key rotation.

The app uses [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) and the [Supabase SSR session pattern](https://supabase.com/docs/guides/auth/server-side/creating-a-client), with server-side `getUser()` checks and approval verification. No deployments, DNS changes or account approvals are performed by merely running the application.

## MVP boundaries

No external messaging delivery, AI provider, card processing, automation engine, accounting/tax invoice generation, CSV importer or malware scanning is implemented. These are not presented as working controls. Stages reorder through editable numeric positions. A customer’s conversations/files remain grouped by enquiry and are reachable from their history.

For a two-person MVP the approved workspace loads the dataset, paging database reads to avoid PostgREST’s 1,000-row cap. This keeps analytics honest for the current small workspace, but is not an unlimited-scale architecture: move list/search/analytics to bounded server queries and aggregates before records/audit payloads become large enough to approach hosting response limits. Concurrent users should refresh before editing shared records; stage changes are optimistic and writes are audited, but this MVP does not merge simultaneous field edits automatically.
