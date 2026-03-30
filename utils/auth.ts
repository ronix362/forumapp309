import bcrypt from "bcryptjs";
import { JwtPayload } from "jsonwebtoken";
import jwt, { SignOptions } from "jsonwebtoken";
const SALT_ROUNDS = 10;

/**
 * 1. Password Tools
 * Uses bcryptjs for Vercel/Serverless compatibility.
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 2. Token Tools
 */
export function generateToken(
  payload: object, 
  secret: string, 
  expiresIn: string | number
): string {
  // We cast the options to SignOptions to satisfy the compiler
  const options: SignOptions = { 
    expiresIn: expiresIn as any // Using 'as any' here handles the union type cleanly
  };

  return jwt.sign(payload, secret, options);
}

export function verifyToken(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    return decoded as JwtPayload;
  } catch (error) {
    return null;
  }
}

// Define an interface for the return type to ensure your API routes have full intellisense
interface AuthUser {
  userId: number;
  role: string;
  username: string;
}

/**
 * 3. Access Token Verification
 * Validates the Authorization header and extracts user data.
 */
export function verifyAccessToken(authHeader: string | undefined | null): AuthUser {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Unauthorized: Missing token");
    }

    const accessToken = authHeader.split(" ")[1]; 
    if (!accessToken) {
      throw new Error("Unauthorized: Missing token");
    }

    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new Error("Internal Server Error: ACCESS_TOKEN_SECRET is not defined");
    }

    const decoded = verifyToken(accessToken, secret);
    
    // Check for the specific fields you encoded in your Login route
    if (!decoded || !decoded.id || !decoded.username) {
      throw new Error("Unauthorized: Invalid token");
    }

    return { 
      userId: decoded.id as number, 
      role: (decoded.role as string) || "user", 
      username: decoded.username as string 
    };
}