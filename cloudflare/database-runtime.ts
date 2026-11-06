import { env } from "cloudflare:workers";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient as WorkerPrismaClient } from "../src/generated/prisma-worker/wasm";
import type { PrismaClient, Prisma } from "@prisma/client";

export function createDatabase(): PrismaClient {
  return new WorkerPrismaClient({ adapter: new PrismaD1(env.DB) }) as unknown as PrismaClient;
}

/** D1's batch API provides a real atomic transaction; the Prisma adapter does not. */
export async function executeBatch(_db: PrismaClient, statements: Prisma.Sql[]): Promise<number[]> {
  const results = await env.DB.batch(statements.map(({ sql, values }) => env.DB.prepare(sql).bind(
    ...values.map((value) => value instanceof Date ? value.toISOString().replace("Z", "+00:00") : typeof value === "boolean" ? Number(value) : value),
  )));
  return results.map((result) => result.meta.changes);
}
