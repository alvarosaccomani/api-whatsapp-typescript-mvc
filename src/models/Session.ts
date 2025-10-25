// src/models/Session.ts
import { Schema, model } from "mongoose";
import { v4 as uuidv4 } from "uuid";

// ✅ Interfaz para uso en la aplicación (lo que devuelve .lean())
export interface Session {
  uuid: string;
  id: string;
  qr?: string;
  status: "INIT" | "QR_NEEDED" | "CONNECTED" | "AUTH_FAILED" | "DISCONNECTED";
  lastUpdated: Date;
}

// ✅ Esquema SIN tipado genérico (evita TS2590)
const sessionSchema = new Schema({
  uuid: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    index: true,
  },
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  qr: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    required: true,
    enum: ["INIT", "QR_NEEDED", "CONNECTED", "AUTH_FAILED", "DISCONNECTED"],
    default: "INIT",
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

// ✅ Modelo SIN tipado genérico
const SessionModel = model("Session", sessionSchema);

// ✅ Exportamos el modelo y una función helper para tipar .lean()
export { SessionModel };

// Helper para tipar resultados de .lean()
export const toSession = (doc: any): Session => ({
  uuid: doc.uuid,
  id: doc.id,
  qr: doc.qr,
  status: doc.status,
  lastUpdated: doc.lastUpdated,
});