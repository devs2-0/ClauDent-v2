// Run: node tests/business-providers.test.mjs. SSR never runs database effects.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

process.env.NODE_ENV = 'production';
const root = process.cwd();
const mocks = {
  '@/auth': `
    export const AuthProvider = ({children}) => children;
    export {useAuth} from 'fixture-auth';
    export {useCan} from '@/auth/hooks/useCan';
    export {usePermissions} from '@/auth/hooks/usePermissions';
    export {Can} from '@/auth/components/Can';
  `,
  'fixture-auth': `export const useAuth = () => globalThis.authFixture;`,
  '@/lib/firebase': `export const db = {}; export const auth = {}; export const storage = {};`,
  '@/shared/appearance': `export const AppearanceProvider = ({children}) => children;`,
  '@/shared': `export const SinPermisosPage = () => 'Acceso denegado';`,
};
const bundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import {renderToStaticMarkup} from 'react-dom/server';
      import {MemoryRouter} from 'react-router-dom';
      import {AppProviders} from './src/app/providers/AppProviders';
      import {ProtectedRouteByPermission} from './src/auth/guards/ProtectedRouteByPermission';
      import Inventory from './src/modules/inventario/pages/InventarioPage';
      import Sales from './src/modules/ventas/pages/VentasPage';
      import Cash from './src/modules/ventas/pages/CajaPage';
      export function render(name) {
        const [Page, permission] = {
          Inventory: [Inventory, 'inventory.view'],
          Sales: [Sales, 'sales.view'],
          Cash: [Cash, 'sales.cashShift.open'],
        }[name];
        return renderToStaticMarkup(
          <AppProviders><MemoryRouter>
            <ProtectedRouteByPermission permission={permission}><Page /></ProtectedRouteByPermission>
          </MemoryRouter></AppProviders>
        );
      }
    `,
    resolveDir: root,
    loader: 'tsx',
  },
  jsx: 'automatic', bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', logLevel: 'silent',
  plugins: [{name: 'local-auth', setup(b) {
    b.onResolve({filter: /.*/}, args => {
      if (args.path === './useAuth') return {path: 'fixture-auth', namespace: 'fixture'};
      if (mocks[args.path]) return {path: args.path, namespace: 'fixture'};
      if (args.path.startsWith('@/')) {
        const base = path.join(root, 'src', args.path.slice(2));
        return {path: ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map(ext => base + ext).find(existsSync)};
      }
    });
    b.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({contents: mocks[args.path], loader: 'tsx', resolveDir: root}));
  }}],
});
const module = {exports: {}};
const context = {
  require: createRequire(import.meta.url), module, exports: module.exports,
  console, process, Buffer, setTimeout, clearTimeout, URL, URLSearchParams,
};
context.globalThis = context;
vm.runInNewContext(bundle.outputFiles[0].text, context);

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
function session(permissions, overrides = {}) {
  context.authFixture = {
    currentUser: {uid: 'fixture'}, authLoading: false, profileLoading: false,
    currentUserProfile: {status: 'active', roleIds: ['fixture'], permissions, isAdmin: false},
    ...overrides,
  };
}
for (const [name, grants, label] of [
  ['Inventory', ['inventory.view'], /Inventario/],
  ['Sales', ['sales.view'], /Ventas/],
  ['Cash', ['sales.view', 'sales.cashShift.open'], /Caja/],
]) {
  check(`${name}: minimum permissions mount the page with its real providers`, () => {
    session(grants);
    assert.match(module.exports.render(name), label);
  });
  check(`${name}: admin mounts the page with its real providers`, () => {
    session([], {currentUserProfile: {status: 'active', roleIds: ['admin'], permissions: [], isAdmin: true}});
    assert.match(module.exports.render(name), label);
  });
  for (const [state, overrides] of [
    ['no permissions', {}],
    ['profile loading', {profileLoading: true}],
    ['blocked profile', {currentUserProfile: {status: 'blocked', roleIds: ['fixture'], permissions: grants}}],
  ]) {
    check(`${name}: ${state} never renders the page outside its providers`, () => {
      session([], overrides);
      assert.doesNotThrow(() => module.exports.render(name));
    });
  }
}
console.log(`${checks} provider integration scenarios passed.`);
