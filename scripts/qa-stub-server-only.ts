/**
 * QA preload — stubs `server-only` so validation scripts can import server modules.
 */
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);
const serverOnlyResolved = nodeRequire.resolve("server-only");

nodeRequire.cache[serverOnlyResolved] = {
  id: "server-only",
  filename: serverOnlyResolved,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
} as unknown as NodeModule;
