// src/app.ts
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import cors from "cors";
import sequelize from "./config/database";
import whatsappRoutes from "./routes/whatsapp.routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend
app.use(express.static(path.join(__dirname, "../public")));

// Rutas
app.use("/api/whatsapp", whatsappRoutes);

// Endpoint de salud
app.get("/health", async (req, res) => {
  try {
    // Verificar conexión a PostgreSQL
    await sequelize.authenticate();
    
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      postgres: "connected"
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      error: "Database connection failed",
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/test-internet", async (req, res) => {
  try {
    const response = await fetch("https://web.whatsapp.com", { method: "HEAD" });
    res.json({ online: true, status: response.status });
  } catch (err: any) {
    res.json({ online: false, error: err.message });
  }
});

// Servir frontend estático (opcional)
app.get("/manager", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

// Conectar a PostgreSQL
sequelize.authenticate()
  .then(() => console.log("✅ Conectado a PostgreSQL"))
  .catch(err => console.error("❌ Error en PostgreSQL:", err));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});