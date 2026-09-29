#!/usr/bin/env node
// Fails loudly, well before the pin-set's own <pin-set expiration="..."> date, so
// certificate-pin rotation can never be silently forgotten. Android stops enforcing
// pinning on a domain once its pin-set's expiration date passes (fails OPEN, not
// closed) -- there is no runtime error, no crash, nothing in a crash report. The
// only way this gets caught before launch-day is a check that runs on every CI
// build and fails on its own, ahead of that date.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WARN_DAYS_BEFORE = 90;
const CONFIG_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'android/app/src/main/res/xml/network_security_config.xml',
);

const xml = readFileSync(CONFIG_PATH, 'utf8');
const matches = [...xml.matchAll(/<pin-set\s+expiration="(\d{4}-\d{2}-\d{2})"/g)];

if (matches.length === 0) {
  console.error(`No <pin-set expiration="..."> found in ${CONFIG_PATH}`);
  process.exit(1);
}

const now = new Date();
let failed = false;

for (const [, dateStr] of matches) {
  const expiry = new Date(`${dateStr}T00:00:00Z`);
  const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);

  if (daysLeft < 0) {
    console.error(
      `Certificate pin-set expired ${-daysLeft} day(s) ago (${dateStr}). ` +
        'Android has silently stopped enforcing pinning on these domains -- ' +
        'regenerate pins from a real network (not this CI runner\'s own egress, ' +
        'if it proxies TLS) and update network_security_config.xml.',
    );
    failed = true;
  } else if (daysLeft <= WARN_DAYS_BEFORE) {
    console.error(
      `Certificate pin-set expires in ${daysLeft} day(s) (${dateStr}). ` +
        `Renew it before then -- see docs/CERTIFICATE_PINNING_SETUP.md.`,
    );
    failed = true;
  } else {
    console.log(`Certificate pin-set OK: expires ${dateStr} (${daysLeft} days left).`);
  }
}

process.exit(failed ? 1 : 0);
