/**
 * Guards against drift between the client mirror (src/astrology/) and the
 * server engine (functions/src/engine/). The server is authoritative; the
 * client copy only feeds Sky Clock's local display and shared types. The two
 * trees must be identical apart from how modules are imported (path aliases
 * vs. relative paths), so a rule change made on one side cannot silently
 * diverge from the other.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const CLIENT = path.join(ROOT, 'src/astrology');
const SERVER = path.join(ROOT, 'functions/src/engine');
const MIRRORED_DIRS = ['primitives', 'kp', 'rkp', 'types'];

function listSources(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSources(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Reduce every module specifier to its last segment so alias vs. relative imports compare equal. */
function normalize(source: string): string {
  return source.replace(/(from\s+|import\s+)(['"])([^'"]+)\2/g, (_m, kw, q, spec: string) => {
    // The server's shims/i18nTypes stands in for the client's @i18n/types.
    const last = spec.split('/').pop() === 'i18nTypes' ? 'types' : spec.split('/').pop();
    return `${kw}${q}${last}${q}`;
  });
}

describe('client/server engine parity', () => {
  for (const dir of MIRRORED_DIRS) {
    it(`${dir}/ matches the server engine apart from import paths`, () => {
      const clientFiles = listSources(path.join(CLIENT, dir)).map(f => path.relative(CLIENT, f));
      const serverFiles = listSources(path.join(SERVER, dir)).map(f => path.relative(SERVER, f));
      expect(clientFiles.sort()).toEqual(serverFiles.sort());
      for (const rel of clientFiles) {
        const client = normalize(fs.readFileSync(path.join(CLIENT, rel), 'utf8'));
        const server = normalize(fs.readFileSync(path.join(SERVER, rel), 'utf8'));
        expect({ file: rel, body: client }).toEqual({ file: rel, body: server });
      }
    });
  }
});
