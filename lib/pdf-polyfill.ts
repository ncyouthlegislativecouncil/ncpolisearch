// pdf.js (bundled inside pdf-parse) references the browser `DOMMatrix` global.
// Node's serverless runtime doesn't define it, so importing pdf-parse there
// throws "ReferenceError: DOMMatrix is not defined" at module-load time — which
// crashes the whole cron route. Define a pure-JS implementation on globalThis
// BEFORE pdf-parse is imported. (Local Node/tsx happens to have it, which is why
// the CLI backfill worked but the serverless cron did not.)
import DOMMatrix from "dommatrix";

const g = globalThis as typeof globalThis & { DOMMatrix?: unknown };
if (typeof g.DOMMatrix === "undefined") {
  g.DOMMatrix = DOMMatrix;
}
