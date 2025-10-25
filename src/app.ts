// src/app.ts
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import cors from "cors";
import mongoose from "mongoose";
import whatsappRoutes from "./routes/whatsapp.routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend
app.use(express.static(path.join(__dirname, "../public")));

// Rutas
app.use("/api/whatsapp", whatsappRoutes);

// Servir frontend estático (opcional)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/qr-viewer.html"));
});

// Conectar a MongoDB
mongoose.connect(process.env.MONGO_URI as string)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => console.error("❌ Error en MongoDB:", err));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});