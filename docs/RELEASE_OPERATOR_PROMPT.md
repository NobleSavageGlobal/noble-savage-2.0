# Release Operator Prompt

## Improved wording (concise)
Execute a full release pass for this repository: run end-to-end diagnostics, fix any configuration or deployment blockers, commit only production-safe changes to main, and deploy backend and frontend to Railway with live verification.

## Copy/paste prompt (detailed)
Use release-operator mode for this run.

Goals:
1. Run complete end-to-end validation for backend, frontend, auth, uploads, and hosted health checks.
2. Fix configuration issues that would block production stability.
3. Keep local-only files out of the commit.
4. Commit and push to main.
5. Deploy to Railway and verify both services are healthy.

Execution contract:
- Use the repository scripts first: scripts/full_diagnostic.sh, then scripts/release_one_shot.sh.
- If a check fails, stop and fix root cause before continuing.
- For every non-trivial change, include file-level reasoning and risk.
- Before deploy, print a short release readiness summary.
- After deploy, confirm public backend health endpoint and frontend response status.

Output format:
- Release status: PASS or FAIL
- Changes shipped: bullet list with file paths
- Verification evidence: tests/build/deploy checks and outcomes
- Rollback note: one safe rollback path if production regresses
