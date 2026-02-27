// @ts-nocheck
/**
 * Aegis V4 CRE Oracle — workflow entry point
 * Copies v3-reference/aegis-oracle.ts with V4 module address injection.
 * The actual oracle logic is in src/oracle/aegis-oracle.ts.
 * This file is the CRE node entry point used by `cre simulate` / `cre deploy`.
 */
export { main } from "../src/oracle/aegis-oracle";
