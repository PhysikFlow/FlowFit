// Browser-only process shim required by the vendored Supabase bundle.
// The bundle reads only `version` to emit a Node deprecation warning.
const processShim = Object.freeze({
  env: Object.freeze({}),
  version: ""
});

export default processShim;
