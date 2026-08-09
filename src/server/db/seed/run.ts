import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "../schema";
import { seedDatabase } from "./seed-database";

const requiredVariables = ["MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"] as const;
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Missing database variables: ${missingVariables.join(", ")}`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: "utf8mb4",
  });

  try {
    const result = await seedDatabase(drizzle({ client: connection, schema, mode: "default" }));
    console.log(`Seeded ${result.skills} skills, ${result.roles} roles, ${result.roleSkillRequirements} role-skill requirements, and ${result.skillRelationships} skill relationships.`);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});