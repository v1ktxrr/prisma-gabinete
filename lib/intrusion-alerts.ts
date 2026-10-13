import { sendEmail } from "./resend";

/**
 * Dispara alertas assíncronos não-bloqueantes por Telegram e/ou e-mail (Resend)
 * quando uma atividade suspeita ou tentativa de intrusão é detectada.
 */
export function sendIntrusionAlert(ip: string, path: string, reason: string, email?: string) {
    const telegramToken = process.env.TELEGRAM_ALERT_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
    
    const timestamp = new Date().toISOString();
    const message = `🚨 [ALERTA DE INTRUSÃO - PRISMA]
IP: ${ip}
Rota: ${path}
Motivo: ${reason}
Data/Hora: ${timestamp}`;

    // 1. Envio para Telegram (Assíncrono)
    if (telegramToken && telegramChatId) {
        fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: message,
            }),
        })
        .then(async (res) => {
            if (!res.ok) {
                const text = await res.text();
                console.error(`[intrusion-alerts] Telegram respondeu com erro (${res.status}):`, text);
            }
        })
        .catch((err) => {
            console.error("[intrusion-alerts] Erro ao enviar mensagem para o Telegram:", err);
        });
    }

    // 2. Envio de E-mail via Resend (Assíncrono)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
        let recipients: string[] = [];
        if (email) {
            recipients = [email];
        } else {
            recipients = (process.env.DEV_EMAILS || "")
                .split(",")
                .map((e) => e.trim().toLowerCase())
                .filter(Boolean);
        }

        if (recipients.length > 0) {
            const html = `
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid #ef4444; border-radius: 8px; max-width: 600px;">
                    <h2 style="color: #ef4444; margin-top: 0;">🚨 Alerta de Segurança - Tentativa de Acesso Não Autorizado</h2>
                    <p>Foi detectada uma atividade suspeita ou tentativa de intrusão no Cockpit do Desenvolvedor.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold; width: 120px;">IP de Origem:</td>
                            <td>${ip}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Rota Acessada:</td>
                            <td><code>${path}</code></td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Motivo:</td>
                            <td style="color: #dc2626;">${reason}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; font-weight: bold;">Data/Hora:</td>
                            <td>${new Date().toLocaleString("pt-BR")}</td>
                        </tr>
                    </table>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
                        Este e-mail é disparado automaticamente quando há violação de regras de firewall, IP whitelist, Cloudflare Access ou falha na autenticação MFA do Cockpit de Root.
                    </p>
                </div>
            `;

            sendEmail({
                to: recipients,
                subject: `🚨 ALERTA DE INTRUSÃO - Cockpit Root`,
                html,
                text: message,
            })
            .then((result) => {
                if (!result.success) {
                    console.error("[intrusion-alerts] Resend falhou ao enviar email:", result.error);
                }
            })
            .catch((err) => {
                console.error("[intrusion-alerts] Erro inesperado ao enviar email pelo Resend:", err);
            });
        }
    }
}
