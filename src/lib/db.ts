import { Prisma, PrismaClient } from "@prisma/client";
import { createDatabase, executeBatch } from "@/lib/database-runtime";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createDatabase();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** The complete set of statements commits together, including on D1. */
export async function writeBatch(statements: Prisma.Sql[]): Promise<number[]> {
  if (!statements.length) return [];
  return executeBatch(db, statements);
}
