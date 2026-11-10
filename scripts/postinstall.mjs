/**
 * Root postinstall — generate Prisma client when the API workspace is present
 * and the prisma CLI is available. Never fail the overall install (Netlify web
 * builds only install @inari/web and do not need Prisma).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const skip =
  process.env.SKIP_PRISMA_GENERATE === "1" ||
  process.env.INARI_SKIP_PRISMA === "1";

if (skip) {
  console.log("[postinstall] SKIP_PRISMA_GENERATE set — skipping prisma generate");
  process.exit(0);
}

// Netlify web-only context: packagePath is apps/web; prisma not installed
if (process.env.NETLIFY === "true" && !process.env.DATABASE_URL) {
  console.log("[postinstall] Netlify without DATABASE_URL — skipping prisma generate");
  process.exit(0);
}

const schema = "apps/api/prisma/schema.prisma";
if (!existsSync(schema)) {
  console.log("[postinstall] No API schema — skip");
  process.exit(0);
}

let prismaBin = null;
try {
  const require = createRequire(import.meta.url);
  prismaBin = require.resolve("prisma/build/index.js");
} catch {
  // try workspace path
  const candidates = [
    "node_modules/prisma/build/index.js",
    "apps/api/node_modules/prisma/build/index.js",
    "node_modules/.bin/prisma",
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      prismaBin = c;
      break;
    }
  }
}

if (!prismaBin) {
  console.log("[postinstall] prisma CLI not installed in this install set — skip generate");
  process.exit(0);
}

const r = spawnSync(
  process.execPath,
  [prismaBin, "generate", "--schema", schema],
  { stdio: "inherit", env: process.env },
);
// Do not fail install if generate fails (e.g. incomplete engine download)
if (r.status !== 0) {
  console.warn("[postinstall] prisma generate exited", r.status, "— continuing");
}
process.exit(0);
