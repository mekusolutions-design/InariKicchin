# Deployment reconciliation changelog

Updated 9 November 2026 to reconcile the original production-readiness candidate with the subsequent Netlify and Render deployment troubleshooting.

## Netlify frontend

- The repository root is an npm workspaces root (`workspaces: ["apps/*"]`).
- The web app is `apps/web`; the root script `build:web` runs `npm run build -w @inari/web`.
- `apps/web/netlify.toml` now explicitly installs root workspace dependencies with `npm install --include=dev` before running `npm run build:web`.
- The Next.js publish directory remains `apps/web/.next`; Node is pinned to 22 and the Netlify Next.js plugin is enabled.
- This resolves the missing root `build` script and addresses the subsequent `next: not found` failure by making workspace dependency installation explicit. A live Netlify build is still required to verify the fix.

## Render API

- Render uses the repository root, `npm install`, and `npm run start:prod -w @inari/api`, with Node 22.
- `apps/api/package.json` now declares `tsx` (`^4.23.15` in the latest verified local workspace) in regular `dependencies`, because `start:prod` imports it at runtime.
- This addresses the observed `ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'` error.
- Render now reaches the explicit production startup guard. That failure is expected and must remain until Prisma persistence, migrations, transactional workflows, and secure production user provisioning are implemented and verified.

## Security and release posture retained

- Do not run `npm audit fix --force` without reviewing the proposed dependency changes; it may introduce breaking changes.
- Do not remove the production startup guard or deploy the in-memory demo store as a live API.
- The release remains a hardened development/UAT candidate, not a production-approved restaurant system.


## Additional reconciliation — 9 November 2026 (latest)

- Set `apps/api` production dependency to the exact locally verified `tsx` range `^4.23.15`.
- Netlify build command now explicitly targets `@inari/web` during install (`--workspace=@inari/web --include-workspace-root`) and runs that workspace's build. This is a new corrective attempt; it has not yet been validated by a successful Netlify deployment.
- The Netlify error `next: not found` remains open. The full install log is needed if it persists. A root npm lockfile is not present in this archive.
- Render successfully installs the API and now reaches the expected production persistence guard.
- API seed no longer embeds a known admin email/password or sample inventory. Bootstrap credentials are required through secure environment variables.
- Login UI no longer pre-populates demo credentials.
- API tests: 43 passed, 0 failed, including the new production-guard test.

- Render dependency install reported two npm audit findings (one moderate, one high); advisories remain untriaged because the log did not identify packages. Avoid `npm audit fix --force` until reviewed.
