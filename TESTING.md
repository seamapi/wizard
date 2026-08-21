# Testing the Seam Wizard

Use this guide to decide what kind of test to write, where it belongs, and what
the test can replace.

## Test types

### Unit tests

A unit test checks the public behavior of one source module. Its collaborators
stay real. The test can use Node.js APIs, external packages, and type-only
imports, but it imports runtime behavior only from the module with the same
name.

Keep a unit test beside its module:

```text
src/lib/api-key.ts
src/lib/api-key.test.ts
```

A test that uses a temporary directory can still be a unit test when the file
system is part of that module's public behavior. Use the real file system in a
temporary directory.

### Integration tests

An integration test checks multiple wizard modules together. This includes a
test that imports a memory adapter, store, or other sibling module to exercise
its subject. It also includes an orchestration module that runs several real
collaborators.

Put integration tests under top-level `test/`, mirroring `src/lib/`:

```text
src/lib/steps/connection.ts
src/lib/steps/connection.test.ts      # unit behavior
test/steps/connection.test.ts         # connection + adapter + store
```

### End-to-end tests

An end-to-end test starts the real package or host CLI and checks observable
process behavior. Put it under `test/`. Keep each user-visible flow in one
end-to-end test; test its branches in smaller module or integration tests.

### Evals

An eval is a manual, paid test of probabilistic agent behavior. It reports
quality, cost, and time instead of supplying a deterministic CI pass/fail gate.
Eval code and fixtures belong under top-level `eval/`; deterministic tests of
the eval harness follow the same unit and integration placement rules above.

## Fixtures

Reusable or on-disk test data belongs under `test/fixtures/`. A small value used
by one test stays in that test file. Eval sample applications belong under
`eval/fixtures/` because they are eval inputs, not test fixtures.

## Boundaries

Use classical assertions: call the subject, then assert on its return value or
on data captured at a process boundary.

The wizard has these process boundaries:

- **Host state and authentication:** use `createMemoryAdapter()`, install it
  with `setAdapter()`, and restore it with `resetAdapter()`.
- **Terminal:** render Ink components with `ink-testing-library`, or capture
  writes to stdout. At the package entrypoint, the renderer can be replaced so
  a test does not take over the terminal.
- **Wire:** replace `fetch` or use a local HTTP server, capture the request, and
  return a real `Response`. Never call a live service from a deterministic test.
- **Disk:** use the real file system in a temporary directory. Do not fake
  `node:fs`.
- **Environment:** use `vi.stubEnv()` and restore it after the test.
- **Agent execution:** inject the narrow runner or harness seam and capture its
  events. Real model calls belong only in an eval.

Prefer an injected value over module-path substitution. A module replacement is
acceptable only at a process edge that has no value-level injection seam, such
as stopping the package entrypoint before Ink takes over the terminal.

## Assertions

Assert on observable behavior:

- rendered terminal text;
- returned values;
- stored adapter state;
- files written in a temporary project;
- HTTP requests sent and responses handled;
- process exit status;
- agent events and resulting diffs.

An assertion that one internal helper called another tests implementation
structure. Keep it only when the call crosses one of the process boundaries
above and the captured message is itself the behavior.

## Rule of thumb

> A test for one module stays beside it. A test for cooperating modules goes in
> `test/`. Fake only the edge where data leaves the wizard, and assert on the
> data that crossed it.
