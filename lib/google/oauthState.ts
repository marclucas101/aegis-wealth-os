import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getGoogleOAuthStateSecret } from "./env";

type OAuthStatePayload = {
  adviserUserId: string;
  nonce: string;
  exp: number;
};

function signPayload(encoded: string): string {
  const secret = getGoogleOAuthStateSecret();
  if (!secret) {
    throw new Error("GOOGLE_OAUTH_STATE_SECRET is not configured");
  }

  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function createOAuthState(adviserUserId: string): string {
  const payload: OAuthStatePayload = {
    adviserUserId,
    nonce: randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signPayload(encoded);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (
    provided.length !== expectedBuf.length ||
    !timingSafeEqual(provided, expectedBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as OAuthStatePayload;

    if (
      !payload.adviserUserId ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
