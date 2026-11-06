import { PrismaClient, type Prisma } from "@prisma/client";

export function createDatabase(): PrismaClient {
  return new PrismaClient();
}

export function executeBatch(db: PrismaClient, statements: Prisma.Sql[]): Promise<number[]> {
  return db.$transaction(statements.map((statement) => db.$executeRaw(statement)));
}
