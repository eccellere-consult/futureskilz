import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

const requiredVariables = ["MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Missing database variables: ${missingVariables.join(", ")}`);
}

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: "utf8mb4",
});

try {
  await migrate(drizzle(connection), { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied successfully.");
} finally {
  await connection.end();
}