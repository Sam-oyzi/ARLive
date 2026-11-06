# PageWakes on Cloudflare Workers

The complete application runs at https://pagewakes.com. Cloudflare handles HTTPS and the custom
domain. Vinext builds the existing Next.js App Router pages, React Server Components, actions and
route handlers for the Worker runtime. This adapter is beta; validate the reader, AR and editor
when upgrading it.

The owner chose to keep Workers Free for now. This is a test deployment: live tests recorded
`exceededCpu` errors on login and multipart uploads, and Cloudflare rejected a higher CPU budget
with error 100328 because the account is on Free. Do not describe this deployment as ready for
a reliable public launch. Free allows 10 ms CPU per request; SSR and password hashing can exceed
that budget. The source intentionally omits paid-only CPU settings and no paid plan was enabled.

## Resources

- Worker: `pagewakes`
- D1: `pagewakes-db`
- Private R2 bucket: `pagewakes-media`
- Configuration: `cloudflare.config.ts`
- Database maintenance configuration: `cloudflare/wrangler.jsonc`
- Local development: `npm run dev`, SQLite and `storage/uploads`
- Worker development: `npm run dev:worker` with local Cloudflare bindings

The Worker uses native D1 and R2 bindings. It does not expose a SQL proxy or require S3 access
keys. `/files` checks book and school access before serving private objects, including range
requests for video and MindAR files. Models are optimized in the browser before upload.

## Deploy updates

Use Node 24.22 or later within the supported engines range in package.json.

1. Run `npm ci`, then `npx wrangler login` and sign in to the account owning the domain.
2. Run `npm run build:worker`. This generates the Worker-specific Prisma client and Cloudflare types.
3. Run `npm run typecheck` and `npm run typecheck:worker`, then `npm test`.
4. Run `node scripts/cloudflare-run.mjs cf deploy --prebuilt`.

`npm run deploy:worker` combines the build and deployment steps. The launcher reuses the existing
Wrangler OAuth login, or `CLOUDFLARE_API_TOKEN` in CI. It never prints authentication tokens.
Existing Worker secrets are retained during deployment.

For a new environment, generate a 32-byte or longer `SESSION_SECRET`, place it in a private JSON
file outside Git and supply `--secrets-file path/to/secrets.json` to the first deployment. Set
`SITE_URL` in the Worker config to the public HTTPS address so printed QR codes open the live app.

## Import existing records and media once

Do not import the original snapshot over an active production database. This procedure targets
an empty schema and dedicated bucket. Keep exported files in the ignored `output/` directory,
because they contain account records, password hashes and family requests.

1. Run `node scripts/export-cloudflare.mjs prisma/dev.db output/new-import`.
2. Apply `cloudflare/migrations/0001_initial.sql` to the new empty D1 database with Wrangler.
3. Import `output/new-import/data.sql` using `wrangler d1 execute --remote --file`.
4. Run `node scripts/import-r2-worker.mjs output/new-import/media.json --apply`. It verifies source
   hashes, refuses differing existing objects, resumes matching imports, and downloads every
   uploaded object to verify its SHA-256 hash.
5. Compare all table counts with `report.json`, and run `PRAGMA foreign_key_check` remotely.
6. Use `node scripts/create-cloudflare-admin.mjs you@example.com` for the initial owner account.
   It saves a generated password to an ignored private file and refuses to overwrite an account.

The November 6 launch imported all 15 tables and 97 media files, retaining book, page and account
IDs. Four accounts with public demo passwords were disabled only in the cloud copy and the demo
school join code was rotated. An owner admin was added separately. The local source remains intact.

## Validation

Check the home page, library, reader, language-specific print sheet and QR code, AR scanner,
360-degree pages, admin login and upload. Open the live HTTPS site on a phone for the final camera
and ground-placement check. Local browser automation was disabled during initial deployment;
server-side requests and real form submission were used to verify the deployed routes.
The 104 MiB upload stress test did not pass on Free because of the CPU limit. Individual uploads,
authenticated media reads and range requests passed before the stress test.

[Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
[Cloudflare D1 import guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
[Cloudflare R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
[Cloudflare Worker limits](https://developers.cloudflare.com/workers/platform/limits/)
