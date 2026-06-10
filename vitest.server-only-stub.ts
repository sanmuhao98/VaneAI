// vitest alias target for the 'server-only' package: the real module throws when
// imported outside a React Server context, which would block importing server
// modules (execute-job 等) in integration tests. Tests run in node — safe to stub.
export {}
