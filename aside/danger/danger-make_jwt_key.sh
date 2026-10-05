#!/bin/bash

if [ "${DOTHETHiNG-}" != "GO" ]; then
  echo 1>&2 "You must set the DOTHETHiNG environment variable to 'GO' to run this script."
  exit 1
fi
if [ -z "${TRIQUET_ENV-}" ]; then
  echo 1>&2 "Run this command with doppler:"
  echo 1>&2 "scripts/doppledo prd_janitor $0 $@"
  exit 1
fi
keyfile="$(umask 077 && mktemp)"
node --input-type=module - "$keyfile" "https://<production-app-address>" <<'NODE'
import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync } from 'node:fs'
const [keyfile, siteUrl] = process.argv.slice(2)
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).trimEnd().replaceAll('\n', ' ')
const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey.export({ format: 'jwk' }) }] })
writeFileSync(keyfile, `JWT_PRIVATE_KEY="${pem}"\nJWKS=${jwks}\nSITE_URL=${siteUrl}\n`, { mode: 0o600 })
NODE

echo "Running this will make every login break. Are you sure you want to do this? If so open this file and uncomment the lines below this comment"
# npx convex env set --force --from-file "$keyfile"; rm -f "$keyfile"
# npx convex env get SITE_URL