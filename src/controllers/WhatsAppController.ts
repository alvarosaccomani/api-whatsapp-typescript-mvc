// src/controllers/WhatsAppController.ts
import { Request, Response } from "express";
import qr from "qr-image";
import WhatsAppService from "../services/WhatsAppService";
import { Session, SessionModel } from "../models/Session";

// Interfaz para la lista de sesiones
interface SessionListItem {
  uuid: string;
  id: string;
  status: string;
  lastUpdated: Date;
  isConnected: boolean;
}

export class WhatsAppController {
  // Iniciar sesión (genera QR)
  static async initSession(req: Request, res: Response) {
    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId es obligatorio y debe ser un string" });
    }

    try {
      WhatsAppService.getInstance(sessionId);
      await SessionModel.findOneAndUpdate(
        { id: sessionId },
        { id: sessionId, status: "INIT", lastUpdated: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      );
      res.json({
        success: true,
        message: "Sesión iniciada. Espera el código QR.",
        sessionId
      });
    } catch (error: any) {
      console.error("Error al iniciar sesión:", error);
      res.status(500).json({ error: error.message || "Error interno" });
    }
  }

  // Enviar mensaje de texto
  static async sendMessage(req: Request, res: Response) {
    const { phone, message, sessionId } = req.body;
    if (!sessionId || !phone || !message) {
      return res.status(400).json({ error: "sessionId, phone y message son obligatorios" });
    }

    try {
      const service = WhatsAppService.getInstance(sessionId);
      const result = await service.sendMessage({ phone, message });
      res.json({ success: true, whatsapp: result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Enviar imagen u otro archivo (URL, filePath o base64)
  static async sendMediaMessage(req: Request, res: Response) {
    const { sessionId, phone, caption = "", url, filePath, base64, mimeType = "image/jpeg", filename = "image.jpg" } = req.body;

    if (!sessionId || !phone) {
      return res.status(400).json({ error: "sessionId y phone son obligatorios" });
    }

    if (!url && !filePath && !base64) {
      return res.status(400).json({ error: "Se requiere 'url', 'filePath' o 'base64'" });
    }

    try {
      let cleanBase64 = base64;
      // Eliminar prefijo data: si existe
      if (base64 && base64.startsWith("data:")) {
        cleanBase64 = base64.split(",")[1];
      }

      const service = WhatsAppService.getInstance(sessionId);
      const result = await service.sendMediaMessage({
        phone,
        caption,
        url,
        filePath,
        base64: cleanBase64,
        mimeType,
        filename
      });

      res.json({ success: true, whatsapp: result });
    } catch (error: any) {
      console.error("Error al enviar media:", error);
      res.status(400).json({ error: error.message });
    }
  }

  // Obtener datos del QR (para polling)
  static async getQr(req: Request, res: Response) {
    const { sessionId } = req.params;
    const session = await SessionModel.findOne({ id: sessionId }).lean();

    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada" });
    }

    if (session.status === "QR_NEEDED") {
      return res.json({
        qr: session.qr,
        status: session.status,
        sessionId: session.id,
        lastUpdated: session.lastUpdated,
      });
    }

    // Si no es QR_NEEDED, devolvemos el estado sin error
    return res.json({
      status: session.status,
      message: "QR no disponible (sesión en otro estado)",
    });
  }

  // Obtener imagen SVG del QR
  static async getQrImage(req: Request, res: Response) {
    const { sessionId } = req.params;
    const session = await SessionModel.findOne({ id: sessionId }).lean();

    if (!session || session.status !== "QR_NEEDED") {
      return res.status(404).json({ error: "QR no disponible" });
    }

    try {
      const qrSvg = qr.imageSync(session.qr, { type: "svg", margin: 4 });
      res.setHeader("Content-Type", "image/svg+xml");
      res.send(qrSvg);
    } catch (err) {
      res.status(500).json({ error: "Error al generar QR" });
    }
  }

  // Listar todas las sesiones
  static async listSessions(_req: Request, res: Response) {
    try {
      const sessions = await SessionModel.find().lean() as unknown as Session[];
      const list: SessionListItem[] = sessions.map(s => ({
        uuid: s.uuid,
        id: s.id,
        status: s.status,
        lastUpdated: s.lastUpdated,
        isConnected: s.status === "CONNECTED"
      }));
      res.json(list);
    } catch (error: any) {
      console.error("Error al listar sesiones:", error);
      res.status(500).json({ error: "Error interno" });
    }
  }

  // Cerrar sesión
  static async closeSession(req: Request, res: Response) {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId es obligatorio" });
    }

    try {
      await WhatsAppService.closeSession(sessionId);
      res.json({ success: true, message: "Sesión cerrada" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Reiniciar sesión
  static async restartSession(req: Request, res: Response) {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId es obligatorio" });
    }

    try {
      await WhatsAppService.closeSession(sessionId);
      WhatsAppService.getInstance(sessionId);
      await SessionModel.findOneAndUpdate(
        { id: sessionId },
        { id: sessionId, status: "INIT", lastUpdated: new Date() },
        { upsert: true }
      );
      res.json({ success: true, message: "Sesión reiniciada" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}