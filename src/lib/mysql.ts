import "server-only";

import mysql, { type Pool } from "mysql2/promise";

import { getServerEnvironment } from "@/server/env";

// One pool for the whole process. It is kept on globalThis (not only in development) so production reuses it too:
// creating a pool per call would open new connections on every request and never close them.
const globalForMysql = globalThis as unknown as { mysqlPool?: Pool };

export function getMysqlPool(): Pool {
  if (globalForMysql.mysqlPool) {
    return globalForMysql.mysqlPool;
  }

  const environment = getServerEnvironment();
  if (!environment.MYSQL_USER || !environment.MYSQL_DATABASE) {
    throw new Error("MYSQL_USER and MYSQL_DATABASE are required for database access.");
  }

  const pool = mysql.createPool({
    host: environment.MYSQL_HOST,
    port: environment.MYSQL_PORT,
    user: environment.MYSQL_USER,
    password: environment.MYSQL_PASSWORD,
    database: environment.MYSQL_DATABASE,
    connectionLimit: environment.MYSQL_CONNECTION_LIMIT,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    charset: "utf8mb4",
    timezone: "Z",
  });

  // Drizzle reads and writes dates as UTC, so the database session must use UTC too.
  // Otherwise CURRENT_TIMESTAMP defaults and expiry checks drift by the server's offset.
  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  globalForMysql.mysqlPool = pool;
  return pool;
}

/**
 * The framework workspace engine (copied from the Eccellere Strategy Hub) imports a default-exported pool and calls
 * `query` and `getConnection` on it. This forwards to the one shared pool, created on first use.
 */
const workspacePool = {
  query: ((...args: Parameters<Pool["query"]>) => getMysqlPool().query(...args)) as Pool["query"],
  getConnection: () => getMysqlPool().getConnection(),
};

export default workspacePool;
