This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel + Supabase

Aegis Wealth OS uses Supabase for auth, database, and storage. Before deploying:

```bash
npm run deploy:check
npm run build
npx tsc --noEmit
```

Deployment guides:

- [Vercel + Supabase Deployment](docs/DEPLOYMENT_VERCEL_SUPABASE.md)
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)
- [Environment Variables](docs/ENVIRONMENT_VARIABLES.md)
- [Post-Deployment QA](docs/POST_DEPLOYMENT_QA.md)

> Do not deploy with real client data until legal, compliance, and security review is complete.

## Final readiness

Before demo or private beta, run the consolidated launch gate:

```bash
npm run final:check
```

Launch package (Phase 4Z):

- [Final Beta Launch Checklist](docs/FINAL_BETA_LAUNCH_CHECKLIST.md) — master execution plan
- [Go / No-Go Criteria](docs/GO_NO_GO_CRITERIA.md)
- [Launch Day Runbook](docs/LAUNCH_DAY_RUNBOOK.md)
- [Final Demo Checklist](docs/FINAL_DEMO_CHECKLIST.md)
- [Final Security Checklist](docs/FINAL_SECURITY_CHECKLIST.md)
- [Beta Limitations & Risks](docs/BETA_LIMITATIONS_AND_RISKS.md)
- [Beta Roadmap After Launch](docs/BETA_ROADMAP_AFTER_LAUNCH.md)
