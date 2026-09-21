import { build } from 'esbuild';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'claudent-operational-'));
const output = join(directory, 'operational.test.cjs');
try {
  await build({
    entryPoints: ['tests/operational.test.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'cjs', logLevel: 'warning',
    tsconfig: 'tsconfig.app.json',
    plugins: [{
      name: 'isolated-firestore',
      setup(builder) {
        builder.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: resolve('tests/firestoreStub.ts') }));
        builder.onResolve({ filter: /^@\/lib\/firebase$/ }, () => ({ path: 'firebase-config', namespace: 'test' }));
        builder.onResolve({ filter: /^@\/auth$/ }, () => ({ path: 'auth', namespace: 'test' }));
        builder.onResolve({ filter: /^@\/modules\/audit\/services\/auditService$/ }, () => ({ path: 'audit', namespace: 'test' }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ contents: path === 'audit' ? 'export const addAuditLog = async () => {};' : path === 'auth' ? 'export const useCan = () => ({ can: () => false });' : 'export const db = {};' }));
      },
    }],
  });
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { force: true });
  await rmdir(directory);
}
