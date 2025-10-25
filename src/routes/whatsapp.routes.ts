// src/routes/whatsapp.routes.ts
import { Router } from "express";
import { WhatsAppController } from "../controllers/WhatsAppController";

const router = Router();

router.post("/init", WhatsAppController.initSession);
router.post("/send", WhatsAppController.sendMessage);
router.get("/session/:sessionId/qr", WhatsAppController.getQr);
router.get("/session/:sessionId/qr/image", WhatsAppController.getQrImage);
router.delete("/session/:sessionId", WhatsAppController.closeSession);
router.post("/restart", WhatsAppController.restartSession);
router.get("/sessions", WhatsAppController.listSessions);
router.post("/send-media", WhatsAppController.sendMediaMessage);

export default router;