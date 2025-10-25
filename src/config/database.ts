// src/config/database.ts
import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "api_whatsapp",
  logging: false, // desactiva logs SQL (opcional)
});

export default sequelize;