/**
 * Unit tests for CRM V2 pilot allowlist parsing (used by qa:crm-v2-shell).
 */

import {
  isUserInPilotAllowlist,
  parsePilotAllowlistFromEnv,
} from "@/lib/crm-v2/pilotConfig";

const VALID_A = "11111111-1111-4111-8111-111111111111";
const VALID_B = "22222222-2222-4222-8222-222222222222";

export function runPilotConfigUnitTests(): { passed: number; failed: string[] } {
  const failed: string[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
    } catch (error) {
      failed.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  test("missing env denies", () => {
    const key = "CRM_V2_PILOT_USER_IDS";
    const prev = process.env[key];
    Reflect.deleteProperty(process.env, key);
    const result = parsePilotAllowlistFromEnv();
    if (prev !== undefined) process.env[key] = prev;
    else Reflect.deleteProperty(process.env, key);
    if (result.ok || result.reason !== "missing") {
      throw new Error("expected missing");
    }
  });

  test("empty env denies", () => {
    const key = "CRM_V2_PILOT_USER_IDS";
    const prev = process.env[key];
    process.env[key] = "   ";
    const result = parsePilotAllowlistFromEnv();
    if (prev !== undefined) process.env[key] = prev;
    else Reflect.deleteProperty(process.env, key);
    if (result.ok || result.reason !== "empty") {
      throw new Error("expected empty");
    }
  });

  test("malformed token denies entire allowlist", () => {
    const key = "CRM_V2_PILOT_USER_IDS";
    const prev = process.env[key];
    process.env[key] = `${VALID_A},not-a-uuid`;
    const result = parsePilotAllowlistFromEnv();
    if (prev !== undefined) process.env[key] = prev;
    else Reflect.deleteProperty(process.env, key);
    if (result.ok || result.reason !== "malformed") {
      throw new Error("expected malformed");
    }
  });

  test("valid comma list parses", () => {
    const key = "CRM_V2_PILOT_USER_IDS";
    const prev = process.env[key];
    process.env[key] = `${VALID_A}, ${VALID_B}`;
    const result = parsePilotAllowlistFromEnv();
    if (prev !== undefined) process.env[key] = prev;
    else Reflect.deleteProperty(process.env, key);
    if (!result.ok) throw new Error("expected ok");
    if (!isUserInPilotAllowlist(VALID_A, result.userIds)) throw new Error("A missing");
    if (!isUserInPilotAllowlist(VALID_B.toUpperCase(), result.userIds)) throw new Error("B missing");
  });

  return { passed: 4 - failed.length, failed };
}
