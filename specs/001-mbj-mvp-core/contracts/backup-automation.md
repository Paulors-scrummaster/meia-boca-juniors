# Backup Automation Contract

## Trigger correlation

- n8n generates a random UUID `request_id` containing no personal or club data.
- `workflow_dispatch` accepts `request_id` and runs only from protected `main`.
- The workflow `run-name` includes the exact request ID. n8n queries runs for this workflow and accepts
  exactly one run whose name, branch, and event match the request; zero, multiple, or ambiguous matches
  fail closed and alert the owner.
- `workflow_call` accepts the same request ID and exposes the verified result fields as typed outputs to
  the calling database-release workflow.

## Sanitized result artifact

Manual dispatch uploads an artifact named `backup-result-<request_id>` with one-day retention. It
contains one UTF-8 JSON file named `backup-result.json`:

```json
{
  "contractVersion": 1,
  "requestId": "uuid",
  "runId": "github-actions-run-id",
  "backupId": "opaque-non-personal-id",
  "manifestSha256": "64-lowercase-hex-characters",
  "encryptedObjectKey": "backups/yyyy/mm/<opaque-id>.age",
  "verifiedAt": "UTC timestamp",
  "status": "VERIFIED"
}
```

The artifact MUST NOT contain database rows, Storage objects, manifests, credentials, signed URLs,
provider responses, logs, personal data, or plaintext backup paths. Its values are operational evidence,
not authorization credentials.

## n8n acceptance rules

After the correlated run completes successfully, n8n downloads the uniquely named artifact through its
fine-grained GitHub credential and validates the JSON schema. It accepts the result only when:

1. `contractVersion` is supported;
2. `requestId` equals the generated request;
3. `runId` equals the correlated completed run;
4. `manifestSha256` is valid SHA-256 hex;
5. `encryptedObjectKey` is an allowlisted key below the private backup prefix;
6. `verifiedAt` is a valid UTC timestamp from the current execution window; and
7. `status` is exactly `VERIFIED`.

Only then may n8n confirm retention, send the success heartbeat, and return the safe backup ID/checksum.
Timeout, failed/cancelled run, ambiguous correlation, absent/expired artifact, schema failure, mismatch,
or unverified state follows the alert branch and MUST NOT satisfy a pre-migration gate.

## Reusable workflow outputs

For `workflow_call`, `backup_id`, `manifest_sha256`, `encrypted_object_key`, `verified_at`, and
`verification_status` are populated from the same validated result file. The caller MUST require
`verification_status == VERIFIED` and a valid checksum before applying a production migration.
