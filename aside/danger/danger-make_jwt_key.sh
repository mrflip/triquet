#!/bin/bash
set -euo pipefail

if [ "${DOTHETHiNG-}" != "GO" ]; then
  echo 1>&2 "You must set the DOTHETHiNG environment variable to 'GO' to run this script."
  exit 1
fi
if [ -z "${TRIQUET_ENV-}" ]; then
  echo 1>&2 "Run this command with doppler:"
  echo 1>&2 "scripts/doppledo prd_janitor $0 $*"
  exit 1
fi

target="${1-}"
case "$target" in
  prod)    siteUrl="https://<production-app-address>" ;;
  preview) siteUrl="" ;;
  *)       echo 1>&2 "usage: $0 prod|preview"; exit 1 ;;
esac

keyfile="$(umask 077 && mktemp)"
trap 'rm -f "$keyfile"' EXIT

node --input-type=module - "$keyfile" "$siteUrl" <<'NODE'
import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync } from 'node:fs'
const [keyfile, siteUrl] = process.argv.slice(2)
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).trimEnd().replaceAll('\n', ' ')
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey.export({ format: 'jwk' }) }] })
const lines = [`JWT_PRIVATE_KEY="${pem}"`, `JWKS=${jwks}`]
if (siteUrl) { lines.push(`SITE_URL=${siteUrl}`) }
writeFileSync(keyfile, lines.join('\n') + '\n', { mode: 0o600 })
NODE

if [ "$target" = "preview" ]; then
  npx convex env default set --type preview --force --from-file "$keyfile"
  npx convex env default list --type preview --names-only
  exit 0
else
  echo "Rotating prod keys. If you're sure, uncomment the lines below this comment"
  # npx convex env set --force --from-file "$keyfile"
  # npx convex env get SITE_URL
  exit 0
fi