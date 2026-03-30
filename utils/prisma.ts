import { PrismaClient } from "@/prisma/generated";

/**
 * Prisma Client Singleton for TypeScript
 * * We extend the global object to prevent multiple instances of Prisma Client
 * in development, which would otherwise exhaust your database connection limit.
 */

// 1. Extend the NodeJS Global type to include our prisma instance
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// 2. Initialize the client: use the existing global one, or create a new one
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // In Prisma 7, you pass the database URL directly to the constructor
    datasourceUrl: process.env.DATABASE_URL, 
    // log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// 3. In development, save the instance to the global object
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;