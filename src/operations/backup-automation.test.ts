/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

type WorkflowNode = {
  name: string;
  parameters: { jsCode?: string };
};

const n8nWorkflow = JSON.parse(read('ops/n8n/backup-workflow.json')) as {
  nodes: WorkflowNode[];
};

const executeCodeNode = (
  name: string,
  options: {
    json?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
    nodeData?: Record<string, Record<string, unknown>>;
  } = {},
) => {
  const node = n8nWorkflow.nodes.find((candidate) => candidate.name === name);
  if (!node?.parameters.jsCode) throw new Error(`Code node not found: ${name}`);
  const nodeData = options.nodeData ?? {};

  return runInNewContext(`(() => { ${node.parameters.jsCode} })()`, {
    $: (nodeName: string) => ({ first: () => ({ json: nodeData[nodeName] ?? {} }) }),
    $json: options.json ?? {},
    Buffer,
    items: options.items ?? [{ json: options.json ?? {} }],
  });
};

const requestId = '12345678-1234-4123-8123-123456789abc';
const startedAt = '2026-09-02T08:00:00.000Z';
const runId = '33608576626';
const correlationState = {
  requestId,
  startedAt,
  deadlineAt: '2099-01-01T00:00:00.000Z',
  pollCount: 0,
};
const matchingRun = {
  id: runId,
  display_title: `MBJ backup ${requestId}`,
  head_branch: 'main',
  event: 'workflow_dispatch',
  created_at: startedAt,
  status: 'completed',
  conclusion: 'success',
};
const artifactState = { ...correlationState, runId };
const verifiedResult = {
  contractVersion: 1,
  requestId,
  runId,
  backupId: 'a'.repeat(32),
  manifestSha256: 'b'.repeat(64),
  encryptedObjectKey: `backups/2026/09/${'a'.repeat(32)}.age`,
  verifiedAt: '2026-09-02T08:01:00.000Z',
  status: 'VERIFIED',
};

const resultItem = (value: unknown) => ({
  binary: {
    result: {
      fileName: 'backup-result.json',
      data: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString(
        'base64',
      ),
    },
  },
});

describe('backup automation contracts', () => {
  it('keeps the PowerShell exporter allowlisted, fail-closed, and cleanup-safe', () => {
    const script = read('scripts/backup/export-supabase.ps1');

    expect(script).toContain("$AllowedStorageBucket = 'athlete-avatars'");
    expect(script).toContain("$AllowedR2Bucket = 'mbj-backups'");
    expect(script).toContain(
      "$AllowedPoolerHostPattern = '^aws-[0-9]+-[a-z0-9-]+\\.pooler\\.supabase\\.com$'",
    );
    expect(script).toContain("$DefaultPoolerHost = 'aws-0-us-east-1.pooler.supabase.com'");
    expect(script).toContain('DATABASE_URL_HOST_REJECTED');
    expect(script).toContain('DATABASE_URL_TRANSACTION_POOLER_REJECTED');
    expect(script).toContain('DATABASE_URL_POOLER_HOST_REJECTED');
    expect(script).toContain('-- MBJ defines no custom PostgreSQL roles.');
    // Pre-migration production: pin --table only for allowlisted tables that
    // already exist, discovered via a dedicated read-only psql probe whose
    // output can only narrow the static allowlist, never widen it.
    expect(script).toContain("$PsqlCommand = 'psql'");
    expect(script).toMatch(/\$PgDumpCommand,\s*\$PsqlCommand,\s*\$AgeCommand/);
    expect(script).toContain('function Get-PresentAllowlistedTables');
    expect(script).toContain('information_schema.tables');
    expect(script).toContain("table_type = 'BASE TABLE'");
    expect(script).toMatch(
      /\$Candidates\s*\|\s*Where-Object\s*\{\s*\$discovered -contains \$_\s*\}/,
    );
    expect(script).toContain('DATABASE_TABLE_ALLOWLIST_MALFORMED');
    expect(script).toContain('DATABASE_TABLE_DISCOVERY_FAILED');
    expect(script).toContain('PRE_MIGRATION_NO_APPLICATION_TABLES');
    // Symmetric pre-migration tolerance for storage: an absent allowlisted
    // bucket is an empty snapshot, every other HTTP outcome stays fatal with a
    // classified code instead of the generic BACKUP_FAILED catch-all.
    expect(script).toContain('function Test-StorageBucketPresent');
    expect(script).toContain('/storage/v1/bucket/$AllowedStorageBucket');
    // Missing bucket = HTTP 404, or HTTP 400 wrapping a "404 / Bucket not found" body.
    expect(script).toMatch(/\$status -eq 404 -or \$body -match/);
    expect(script).toMatch(/bucket not found/i);
    expect(script).toContain('STORAGE_BUCKET_PROBE_FAILED');
    expect(script).toContain('http-status=');
    expect(script).toContain('PRE_MIGRATION_BUCKET_ABSENT');
    // A bare SafeFailureCode is no longer the only signal: the secret-free tail
    // of native stderr is surfaced on failure.
    expect(script).toContain('MBJ backup native diagnostic');
    expect(script).toContain('CUSTOM_DATABASE_ROLE_NOT_ALLOWLISTED');
    expect(script).not.toContain('db dump');
    expect(script).toMatch(/postgres\.\{1\}:\{2\}@\{3\}:5432\/\{4\}/);
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
    expect(workflow).toContain("$env:VERIFICATION_STATUS -ne 'VERIFIED'");
    // The gate runs under `shell: pwsh`; `!=` is a PowerShell ParserError, so
    // guard against the invalid operator regressing back into the gate.
    expect(workflow).not.toMatch(/VERIFICATION_STATUS\s*!=/);
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

  it('accepts a verified result correlated to the protected main run', () => {
    const [output] = executeCodeNode('Validate backup result', {
      items: [resultItem(verifiedResult)],
      nodeData: { 'Select exact artifact': artifactState },
    }) as Array<{ json: Record<string, unknown> }>;

    expect(output?.json).toMatchObject({ requestId, runId, status: 'VERIFIED' });
  });

  it('fails closed when run polling exceeds its deadline', () => {
    expect(() =>
      executeCodeNode('Correlate exact run', {
        json: { workflow_runs: [matchingRun] },
        nodeData: {
          'Generate request ID': { ...correlationState, deadlineAt: '2026-09-02T07:59:59.000Z' },
        },
      }),
    ).toThrow('RUN_POLL_TIMEOUT');
  });

  it('fails closed when more than one protected main run matches', () => {
    expect(() =>
      executeCodeNode('Correlate exact run', {
        json: { workflow_runs: [matchingRun, { ...matchingRun, id: '33608576627' }] },
        nodeData: { 'Generate request ID': correlationState },
      }),
    ).toThrow('RUN_CORRELATION_AMBIGUOUS');
  });

  it('fails closed when the exact result artifact is missing or expired', () => {
    expect(() =>
      executeCodeNode('Select exact artifact', {
        json: {
          artifacts: [{ id: 1, name: `backup-result-${requestId}`, expired: true }],
        },
        nodeData: { 'Correlate exact run': artifactState },
      }),
    ).toThrow('RESULT_ARTIFACT_MISSING_OR_EXPIRED');
  });

  it('fails closed when the result request does not match', () => {
    expect(() =>
      executeCodeNode('Validate backup result', {
        items: [
          resultItem({ ...verifiedResult, requestId: '87654321-4321-4321-8321-cba987654321' }),
        ],
        nodeData: { 'Select exact artifact': artifactState },
      }),
    ).toThrow('RESULT_CORRELATION_MISMATCH');
  });

  it('fails closed when the result JSON is malformed', () => {
    expect(() =>
      executeCodeNode('Validate backup result', {
        items: [resultItem('{not-json')],
        nodeData: { 'Select exact artifact': artifactState },
      }),
    ).toThrow('RESULT_JSON_MALFORMED');
  });

  it('fails closed when the result is not verified', () => {
    expect(() =>
      executeCodeNode('Validate backup result', {
        items: [resultItem({ ...verifiedResult, status: 'FAILED' })],
        nodeData: { 'Select exact artifact': artifactState },
      }),
    ).toThrow('RESULT_NOT_VERIFIED');
  });

  it('fails closed when the correlated GitHub execution fails', () => {
    expect(() =>
      executeCodeNode('Require successful run', {
        json: { runConclusion: 'failure' },
      }),
    ).toThrow('RUN_FAILURE');
  });
});
