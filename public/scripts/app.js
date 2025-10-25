// ====== GESTIÓN DE VISTAS ======
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${btn.dataset.view}-view`).classList.add('active');
        if (btn.dataset.view === 'sessions') loadSessions();
    });
});

// ====== VARIABLES GLOBALES ======
let currentSessionId = null;
let isConnected = false;

// ====== FUNCIÓN: Iniciar sesión ======
async function initSession() {
    const sessionId = document.getElementById("sessionId").value?.trim();
    if (!sessionId) return alert("Ingresa un Session ID");
        currentSessionId = sessionId;
        showStatus("Iniciando sesión...", "info", "status");
    
    try {
        const res = await fetch("/api/whatsapp/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId })
        });
        if (!res.ok) throw new Error("Error al iniciar");
        
        document.getElementById("session-controls").style.display = "block";
        document.getElementById("qr-img").style.display = "block";
        showStatus("⏳ Esperando QR...", "info", "status");
        startPolling();
        
        // Actualizar formularios
        document.getElementById("send-sessionId").value = sessionId;
        document.getElementById("image-sessionId").value = sessionId;
        document.getElementById("send-instructions").style.display = "none";
        document.getElementById("image-instructions").style.display = "none";
        document.getElementById("send-form").style.display = "block";
        document.getElementById("image-form").style.display = "block";
        } catch (err) {
        showStatus(`❌ Error: ${err.message}`, "error", "status");
    }
}

// ====== FUNCIÓN: Mostrar estado ======
function showStatus(text, type = "info", elementId = "status") {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.className = "status " + type;
    el.style.display = "block";
}

// ====== POLLING ======
let pollInterval = null;
function startPolling() {
    stopPolling();
    pollInterval = setInterval(checkSessionStatus, 3000);
    checkSessionStatus();
}
function stopPolling() {
    if (pollInterval) clearInterval(pollInterval);
}
async function checkSessionStatus() {
    if (!currentSessionId) return;
        try {
        const res = await fetch(`/api/whatsapp/session/${currentSessionId}/qr`);
        const data = await res.json();
        const img = document.getElementById("qr-img");
        
        if (data.status === "CONNECTED") {
            isConnected = true;
            showStatus("✅ ¡Conectado! Puedes enviar mensajes.", "connected", "status");
            img.style.display = "none";
        } else if (data.status === "QR_NEEDED") {
            img.src = `/api/whatsapp/session/${currentSessionId}/qr/image?_t=${Date.now()}`;
            img.style.display = "block";
            showStatus("👇 Escanea este código con WhatsApp", "info", "status");
        } else {
            showStatus(`Estado: ${data.status}`, "error", "status");
            img.style.display = "none";
        }
    } catch (err) {
        console.error("Poll error:", err);
    }
}

// ====== SESIÓN: Reiniciar / Cerrar ======
async function restartSession() {
    if (!currentSessionId) return;
        showStatus("Reiniciando...", "info", "status");
        try {
        const res = await fetch("/api/whatsapp/restart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: currentSessionId })
        });
        if (res.ok) {
            showStatus("Sesión reiniciada. Esperando nuevo QR...", "info", "status");
            isConnected = false;
            document.getElementById("qr-img").style.display = "block";
        }
    } catch (err) {
        showStatus(`❌ Error: ${err.message}`, "error", "status");
    }
}

async function closeSession() {
    if (!currentSessionId || !confirm("¿Cerrar sesión?")) return;
    try {
        const res = await fetch(`/api/whatsapp/session/${currentSessionId}`, { method: "DELETE" });
        if (res.ok) {
            stopPolling();
            currentSessionId = null;
            isConnected = false;
            document.getElementById("session-controls").style.display = "none";
            document.getElementById("qr-img").style.display = "none";
            document.getElementById("send-form").style.display = "none";
            document.getElementById("image-form").style.display = "none";
            document.getElementById("send-instructions").style.display = "block";
            document.getElementById("image-instructions").style.display = "block";
            showStatus("Sesión cerrada.", "info", "status");
        }
    } catch (err) {
        showStatus(`❌ Error: ${err.message}`, "error", "status");
    }
}

// ====== ENVIAR TEXTO ======
async function sendMessage() {
    const phone = document.getElementById("phone").value?.trim();
    const message = document.getElementById("message").value?.trim();
    if (!phone || !message || !currentSessionId) {
        showStatus("Completa todos los campos", "error", "send-status");
        return;
    }
    
    showStatus("Enviando...", "info", "send-status");
    try {
        const res = await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: currentSessionId, phone, message })
        });
        const result = await res.json();
        if (res.ok) {
            showStatus("✅ ¡Mensaje enviado!", "connected", "send-status");
            document.getElementById("phone").value = "";
            document.getElementById("message").value = "";
        } else {
            showStatus(`❌ ${result.error}`, "error", "send-status");
        }
    } catch (err) {
    showStatus(`❌ Error: ${err.message}`, "error", "send-status");
    }
}

// ====== ENVIAR IMAGEN ======
async function sendImage() {
    const phone = document.getElementById("image-phone").value?.trim();
    const caption = document.getElementById("image-caption").value?.trim();
    const fileInput = document.getElementById("image-file");
    const file = fileInput.files[0];
    
    if (!phone || !file || !currentSessionId) {
        showStatus("Selecciona un archivo y completa el teléfono", "error", "image-status");
        return;
    }
    
    if (file.size > 16 * 1024 * 1024) {
        showStatus("❌ El archivo debe pesar menos de 16 MB", "error", "image-status");
        return;
    }
    
    showStatus("Procesando imagen...", "info", "image-status");
    
    // Convertir a base64
    const reader = new FileReader();
    reader.onload = async () => {
    const base64 = reader.result.split(",")[1]; // ✅ CORRECTO
    const mimeType = file.type || "image/jpeg";
    const filename = file.name;
    
    try {
        const res = await fetch("/api/whatsapp/send-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: currentSessionId,
                phone,
                caption,
                base64,
                mimeType,
                filename
            })
        });
        // ... resto del código
    } catch (err) {
        showStatus(`❌ Error: ${err.message}`, "error", "image-status");
    }
    };
    reader.readAsDataURL(file);
}

// ====== LISTAR SESIONES ======
async function loadSessions() {
    const container = document.getElementById("sessions-list");
    try {
        const res = await fetch("/api/whatsapp/sessions");
        const sessions = await res.json();
        
        if (sessions.length === 0) {
            container.innerHTML = "<p>No hay sesiones activas</p>";
            return;
        }
        
        let html = `
            <table>
            <thead>
                <tr>
                <th>Session ID</th>
                <th>Estado</th>
                <th>Última actualización</th>
                <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        sessions.forEach(s => {
            const statusClass = 
            s.status === "CONNECTED" ? "status-connected" :
            s.status === "QR_NEEDED" ? "status-qr" : "status-error";
            const statusText = 
            s.status === "CONNECTED" ? "Conectado" :
            s.status === "QR_NEEDED" ? "Esperando QR" : s.status;
            
            html += `
            <tr>
                <td><strong>${s.id}</strong></td>
                <td class="${statusClass}">${statusText}</td>
                <td>${new Date(s.lastUpdated).toLocaleString()}</td>
                <td>
                <button class="action-btn close-btn" onclick="closeSessionFromList('${s.id}')">
                    ❌ Cerrar
                </button>
                </td>
            </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p class="status error">Error al cargar sesiones: ${err.message}</p>`;
    }
}

// ====== CERRAR SESIÓN DESDE LISTA ======
async function closeSessionFromList(sessionId) {
    if (!confirm(`¿Cerrar sesión "${sessionId}"?`)) return;
    try {
    const res = await fetch(`/api/whatsapp/session/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
        alert("Sesión cerrada");
        loadSessions();
        // Si es la sesión actual, resetear
        if (currentSessionId === sessionId) {
        stopPolling();
        currentSessionId = null;
        isConnected = false;
        document.getElementById("session-controls").style.display = "none";
        document.getElementById("qr-img").style.display = "none";
        document.getElementById("send-form").style.display = "none";
        document.getElementById("image-form").style.display = "none";
        document.getElementById("send-instructions").style.display = "block";
        document.getElementById("image-instructions").style.display = "block";
        showStatus("Sesión cerrada.", "info", "status");
        }
    } else {
        alert("Error al cerrar sesión");
    }
    } catch (err) {
        alert("Error de red: " + err.message);
    }
}