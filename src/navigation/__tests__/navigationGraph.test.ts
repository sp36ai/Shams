/**
 * Every navigation target must be a registered route.
 *
 * React Navigation resolves route names at RUNTIME. A stale target does not
 * fail the build — it throws "The action 'NAVIGATE' with payload {...} was not
 * handled by any navigator" the moment the button is pressed, which the user
 * experiences as "this button gives an error". TypeScript catches it only
 * where the navigation handle is typed; a screen typed loosely, or a route
 * renamed in one place and not another, sails straight through.
 *
 * This has bitten this codebase before: when the "Ask" tab was removed,
 * `navigate('Ask')` kept compiling and became a dead button (see the note on
 * AppNavigation in ../types.ts). The two renames in this branch —
 * History → Readings and OracleChat → Reading — are the same hazard.
 *
 * So: scan the source for literal navigate/push targets, scan the navigators
 * for the routes they actually register, and require the first set to be a
 * subset of the second.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');
const NAV_DIR = join(SRC_ROOT, 'navigation');

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

/** `navigation.navigate('X'` / `.push('X'` / `.replace('X'` */
const NAV_CALL_RE = /\.(?:navigate|push|replace)\(\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g;
/** `<Something.Screen name="X"` in a navigator file. */
const SCREEN_NAME_RE = /<[A-Za-z]+\.Screen\s+name="([A-Za-z][A-Za-z0-9_]*)"/g;

function registeredRoutes(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(NAV_DIR)) {
    if (!file.endsWith('.tsx')) {
      continue;
    }
    const text = readFileSync(join(NAV_DIR, file), 'utf8');
    for (const match of text.matchAll(SCREEN_NAME_RE)) {
      if (match[1] !== undefined) {
        names.add(match[1]);
      }
    }
  }
  return names;
}

function navigationTargets(): Array<{ file: string; target: string }> {
  const targets: Array<{ file: string; target: string }> = [];
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(NAV_CALL_RE)) {
      if (match[1] !== undefined) {
        targets.push({ file: file.slice(SRC_ROOT.length + 1), target: match[1] });
      }
    }
  }
  return targets;
}

describe('navigation graph', () => {
  const routes = registeredRoutes();
  const targets = navigationTargets();

  it('finds the navigators and their routes (the guard is wired up)', () => {
    expect(routes.size).toBeGreaterThanOrEqual(8);
    expect(targets.length).toBeGreaterThan(5);
  });

  it('registers every screen the app navigates to', () => {
    const unknown = targets.filter(t => !routes.has(t.target));
    expect(
      unknown.map(u => `${u.file}: navigate('${u.target}') — no such route is registered`),
    ).toEqual([]);
  });

  it('registers the routes the param lists promise', () => {
    // The param lists are the contract screens type themselves against; a name
    // in the contract with no screen behind it is a navigate() that compiles
    // and then throws.
    const types = readFileSync(join(NAV_DIR, 'types.ts'), 'utf8');
    const declared = [...types.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9_]*):\s/gm)]
      .map(m => m[1])
      .filter((name): name is string => name !== undefined);

    const promised = declared.filter(name => routes.has(name));
    // Every route in the navigators should appear in a param list, and every
    // param-list entry that names a screen should exist. Compare the direction
    // that matters: no registered route missing from the contract.
    expect([...routes].filter(r => !promised.includes(r))).toEqual([]);
  });
});

/**
 * The pushed screens must live behind the auth gate.
 *
 * Registering Reading/Settings/Premium as siblings of the gate screens meant
 * that signing out from Settings swapped Main for Auth underneath while
 * Settings itself stayed mounted on top: the seeker signed out and went on
 * looking at their own settings page. Grouping them with Main is what makes
 * losing auth unmount them.
 */
describe('auth gating', () => {
  const source = readFileSync(join(NAV_DIR, 'RootNavigator.tsx'), 'utf8');

  /** The four screens that gate entry; everything else must be behind them. */
  const GATE_SCREENS = ['Splash', 'Auth', 'LocationPermission', 'Onboarding'];

  it('keeps the tabs and every pushed screen inside the authenticated group', () => {
    const group = /<RootStack\.Group>([\s\S]*?)<\/RootStack\.Group>/.exec(source)?.[1] ?? '';
    const pushed = [...source.matchAll(SCREEN_NAME_RE)]
      .map(m => m[1])
      .filter((name): name is string => name !== undefined && !GATE_SCREENS.includes(name));

    // Derived rather than hardcoded, so renaming a route cannot quietly
    // narrow what this guard covers.
    expect(pushed).toContain('Main');
    expect(pushed.length).toBeGreaterThan(1);
    for (const route of pushed) {
      expect(group).toContain(`name="${route}"`);
    }
  });

  it('leaves no screen registered outside both the gate chain and the group', () => {
    // Anything registered outside the ternary and outside the group would be
    // reachable while signed out — the exact bug this guards.
    const outsideGroup = source
      .replace(/<RootStack\.Group>[\s\S]*?<\/RootStack\.Group>/, '')
      .matchAll(SCREEN_NAME_RE);
    for (const match of outsideGroup) {
      expect(GATE_SCREENS).toContain(match[1]);
    }
  });
});

/**
 * Every route is individually error-bounded.
 *
 * With only the root boundary above NavigationContainer, one screen throwing
 * during render unmounted the whole navigator — tab bar, back button and all —
 * so a single broken screen was indistinguishable from a broken app.
 */
describe('screen error boundaries', () => {
  it('wraps every registered route', () => {
    for (const file of ['RootNavigator.tsx', 'MainTabs.tsx']) {
      const source = readFileSync(join(NAV_DIR, file), 'utf8');
      const components = [...source.matchAll(/<[A-Za-z]+\.Screen[\s\S]*?component=\{(\w+)\}/g)]
        .map(m => m[1])
        .filter((name): name is string => name !== undefined);

      expect(components.length).toBeGreaterThan(0);
      for (const component of components) {
        // Bound at module scope, never inline: an inline wrapper would be a
        // new component type each render and remount every screen.
        expect(source).toMatch(new RegExp(`const ${component} = withScreenErrorBoundary\\(`));
      }
    }
  });
});
