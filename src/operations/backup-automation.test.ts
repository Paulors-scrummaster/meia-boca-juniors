/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('backup automation contracts', () => {
  it('keeps the PowerShell exporter allowlisted, fail-closed, and cleanup-safe', () => {
    const script = read('scripts/backup/export-supabase.ps1');

    expect(script).toContain("$AllowedStorageBucket = 'athlete-avatars'");
    expect(script).toContain("$AllowedR2Bucket = 'mbj-backups'");
    expect(script).toMatch(/\[guid\]\$RequestId/);
    expect(script).toContain('Invoke-PlaintextCleanup');
    expect(script).toMatch(/finally\s*\{/);
    expect(script).toContain('manifestSha256');
    expect(script).toContain("status = 'VERIFIED'");
    expect(script).toContain("[ValidatePattern('^(?:[0-9a-f]{40}|[0-9a-f]{64})$')]");
    expect(script).toContain(
      '^athletes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar\\.webp$',
    );
    expect(script).not.toMatch(/supabase\s+secrets\s+list/i);
    expect(script).not.toMatch(/Invoke-Expression|\biex\b/i);
  });

  it('defines a protected reusable Windows workflow with typed verified outputs', () => {
    const workflow = read('.github/workflows/backup.yml');
    const externalUses = [...workflow.matchAll(/^\s*uses:\s*(?!\.\/)(\S+)/gm)].map(
      ([, action]) => action,
    );

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('workflow_call:');
    expect(workflow).toContain('runs-on: windows-2025');
    expect(workflow).toContain('environment: backup');
    expect(workflow).toContain('retention-days: 1');
    expect(workflow).toContain('backup_id:');
    expect(workflow).toContain('manifest_sha256:');
    expect(workflow).toContain('verification_status:');
    expect(workflow).toMatch(/request_id:[\s\S]*type:\s*string/);
    expect(workflow).toContain("github.ref_name == 'main'");
    expect(workflow).toContain('if: always()');
    expect(externalUses.length).toBeGreaterThan(0);
    expect(externalUses.every((action) => /@[0-9a-f]{40}$/.test(action ?? ''))).toBe(true);
  });

  it('makes the database release depend directly on the verified reusable backup', () => {
    const workflow = read('.github/workflows/database-release.yml');

    expect(workflow).toContain('uses: ./.github/workflows/backup.yml');
    expect(workflow).toContain('secrets: inherit');
    expect(workflow).toContain("VERIFICATION_STATUS != 'VERIFIED'");
    expect(workflow).toMatch(/MANIFEST_SHA256[\s\S]*\^\[0-9a-f\]\{64\}\$/);
    expect(workflow).toMatch(/supabase db push[^\r\n]*--dry-run/);
    expect(workflow).toMatch(/supabase db push[^\r\n]*--linked/);
  });

  it('exports an importable n8n definition without embedded credentials', () => {
    const workflow = JSON.parse(read('ops/n8n/backup-workflow.json')) as {
      nodes: Array<{ name: string }>;
      connections: Record<string, unknown>;
      credentials?: unknown;
    };
    const serialized = JSON.stringify(workflow);
    const names = workflow.nodes.map(({ name }) => name);

    expect(names).toContain('Generate request ID');
    expect(names).toContain('Correlate exact run');
    expect(names).toContain('Validate backup result');
    expect(names).toContain('Send failure alert');
    expect(names).toContain('Send success heartbeat');
    expect(serialized).toContain('run.display_title === expectedName');
    expect(serialized).not.toContain('run.name === expectedName');
    expect(Object.keys(workflow.connections).length).toBeGreaterThan(0);
    expect(workflow.credentials).toBeUndefined();
    expect(serialized).not.toMatch(/ghp_|github_pat_|AKIA|service_role|BEGIN .*PRIVATE KEY/i);
  });
});
