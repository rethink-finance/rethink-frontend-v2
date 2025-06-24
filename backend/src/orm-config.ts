// src/orm-config.ts
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();

export const ormConfig = {
  type: "postgres" as const,
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_DATABASE || "rethink_db",
  entities: [path.join(__dirname, "**", "*.entity.{ts,js}")],
  migrations: [path.join(__dirname, "migrations", "*{.ts,.js}")],
  synchronize: false,
};
