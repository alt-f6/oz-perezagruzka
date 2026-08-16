# Otsek Znaniy

A multi-tenant Next.js platform for a Russian online tutoring school, combining
a marketing landing page, a CRM for staff (leads, billing, scheduling,
salary), and an LMS for students and parents, all in a single Next.js app
split by subdomain (`crm.*`, `lms.*`, root).

## Tech stack

- **Framework:** Next.js 16.2.12 (App Router), React 19.2.8, TypeScript
- **Database:** PostgreSQL via Prisma ^7.9.1
- **Styling:** Tailwind CSS ^4.3.3
- **Validation:** Zod
- **Testing:** Vitest for unit tests, a custom invariants script
  (`npm run test`) for end-to-end business-rule checks against a real database
- **CI:** GitHub Actions (typecheck, lint, unit tests on every push/PR)

## Architecture

Three sub-apps share one Next.js deployment and are routed by subdomain via
`proxy.ts`:

- `app/landing`: public marketing site and lead-capture funnel
- `app/crm`: internal staff tool (admin/manager/teacher roles), covering
  leads, groups, billing, salary, and team management
- `app/lms`: student/parent portal

Each sub-app owns its own layout and `globals.css`, declaring its design
tokens independently via Tailwind's `@theme`. Tokens are not merged into one
global scope, since the same token names carry different values across apps.
Domain logic for each sub-app lives under `src/<app>`.

## Getting started

1. Copy `.env.example` to `.env` and fill in a Postgres connection string
   (`DATABASE_URL`, `DIRECT_URL`) plus any provider keys you need locally.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Apply the database schema:
   ```bash
   npx prisma migrate deploy
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

## Testing

```bash
npm run typecheck   # TypeScript
npm run lint         # ESLint
npm run test:unit    # Vitest unit tests
npm run test         # business-invariant checks against a real database
```

## License

MIT, see [LICENSE](./LICENSE).
