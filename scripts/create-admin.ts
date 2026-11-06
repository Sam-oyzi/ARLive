// Creates a platform admin, or sets a new password on an existing one.
//   npm run admin:create -- you@example.com "Your Name"
// The password comes from ADMIN_PASSWORD, or is generated and printed once.
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { randomPassword } from "../src/lib/utils";

async function main() {
  const [rawUsername, name = "Platform Admin"] = process.argv.slice(2);
  const username = rawUsername?.trim().toLowerCase();
  if (!username || !/^[a-z0-9._@+-]{3,80}$/.test(username)) {
    throw new Error('Usage: npm run admin:create -- you@example.com "Your Name"');
  }

  const provided = process.env.ADMIN_PASSWORD;
  if (provided && (provided.length < 12 || provided.length > 72)) throw new Error("ADMIN_PASSWORD must be 12 to 72 characters.");
  const password = provided ?? randomPassword(20);
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const existing = await db.user.findUnique({ where: { username } });
    if (existing && existing.role !== "SUPER_ADMIN") {
      throw new Error(`${username} already exists as ${existing.role}. Pick another username.`);
    }
    await db.user.upsert({
      where: { username },
      update: { passwordHash, passwordChangedAt: new Date(), active: true },
      create: { username, name, role: "SUPER_ADMIN", passwordHash },
    });
  } finally {
    await db.$disconnect();
  }

  console.log(`Platform admin ready: ${username}`);
  if (!provided) console.log(`Password (shown once): ${password}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
