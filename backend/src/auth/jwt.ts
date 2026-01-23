import * as jose from "jose";

// Auth payload that gets signed into the token
export interface AuthPayload {
  userId: string;
  companyId: string;
  role: string;
}

// Secret for signing tokens - required in all environments
const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
};

// Sign a JWT token with auth payload
export async function signAuthToken(payload: AuthPayload): Promise<string> {
  const secret = getSecret();
  const token = await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // Token valid for 7 days
    .sign(secret);
  return token;
}

// Verify and decode a JWT token
export async function verifyAuthToken(
  token: string
): Promise<AuthPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret);

    // Validate required fields
    if (
      typeof payload.userId !== "string" ||
      typeof payload.companyId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      companyId: payload.companyId,
      role: payload.role,
    };
  } catch (error) {
    // Token invalid or expired
    return null;
  }
}
