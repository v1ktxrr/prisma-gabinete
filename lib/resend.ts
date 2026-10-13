import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
    console.warn("⚠️ [resend] RESEND_API_KEY não configurada no ambiente. Envios de e-mail falharão.");
}

export const resend = new Resend(resendApiKey || "re_dummy_key_for_build");

export const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
export const DEFAULT_FROM_NAME = process.env.RESEND_FROM_NAME || "Sistema de Comunicação - Gabinete";

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    idempotencyKey?: string;
}

/**
 * Envia um e-mail genérico utilizando o cliente do Resend.
 */
export async function sendEmail({ to, subject, html, text, from, idempotencyKey }: SendEmailParams) {
    const fromAddress = from || `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;
    
    const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
    }, {
        idempotencyKey,
    });

    if (error) {
        console.error("[resend] Erro ao enviar e-mail:", error);
        return { success: false, error };
    }

    return { success: true, data };
}

/**
 * Envia um e-mail de convite de usuário com um template visual premium.
 */
export async function sendInviteEmail({
    email,
    nome,
    inviteLink,
    cargo,
    unidadeId,
}: {
    email: string;
    nome: string;
    inviteLink: string;
    cargo: string;
    unidadeId: string;
}) {
    const cargoFormatado = cargo.charAt(0).toUpperCase() + cargo.slice(1);
    const subject = `Convite de Acesso - Prisma Gabinete Virtual`;
    
    // Template HTML responsivo e com estética premium (alinhado com cores sóbrias e modernas)
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Convite de Acesso - Prisma</title>
        <style>
            body {
                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }
            .wrapper {
                width: 100%;
                table-layout: fixed;
                background-color: #f8fafc;
                padding: 40px 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            }
            .header {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                padding: 32px;
                text-align: center;
                color: #ffffff;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.025em;
                color: #ffffff;
            }
            .content {
                padding: 40px 32px;
                color: #334155;
                line-height: 1.6;
            }
            .welcome {
                font-size: 18px;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 16px;
                color: #0f172a;
            }
            .details-box {
                background-color: #f1f5f9;
                border-radius: 12px;
                padding: 20px;
                margin: 24px 0;
                border-left: 4px solid #6366f1;
            }
            .details-row {
                margin-bottom: 8px;
                font-size: 14px;
            }
            .details-row:last-child {
                margin-bottom: 0;
            }
            .label {
                font-weight: 600;
                color: #475569;
                display: inline-block;
                width: 80px;
            }
            .value {
                color: #0f172a;
            }
            .btn-container {
                text-align: center;
                margin: 32px 0 24px 0;
            }
            .btn {
                background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 32px;
                font-size: 16px;
                font-weight: 600;
                border-radius: 8px;
                display: inline-block;
                box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
                transition: all 0.2s ease;
            }
            .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 14px rgba(99, 102, 241, 0.4);
            }
            .warning {
                font-size: 12px;
                color: #64748b;
                text-align: center;
                margin-top: 32px;
                line-height: 1.4;
            }
            .footer {
                background-color: #f8fafc;
                border-top: 1px solid #e2e8f0;
                padding: 24px 32px;
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
            }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                    <h1>PRISMA</h1>
                </div>
                <div class="content">
                    <p class="welcome">Olá, ${nome}!</p>
                    <p>Você foi convidado a participar do sistema <strong>Prisma - Gabinete Virtual</strong>. Abaixo estão os detalhes da sua conta pré-configurada:</p>
                    
                    <div class="details-box">
                        <div class="details-row">
                            <span class="label">Unidade:</span>
                            <span class="value">${unidadeId}</span>
                        </div>
                        <div class="details-row">
                            <span class="label">Cargo:</span>
                            <span class="value">${cargoFormatado}</span>
                        </div>
                        <div class="details-row">
                            <span class="label">E-mail:</span>
                            <span class="value">${email}</span>
                        </div>
                    </div>
                    
                    <p>Para concluir a ativação de sua conta e escolher uma senha de acesso permanente, clique no botão de ativação abaixo:</p>
                    
                    <div class="btn-container">
                        <a href="${inviteLink}" class="btn" target="_blank">Ativar Minha Conta</a>
                    </div>
                    
                    <p class="warning">Este link de convite é de uso pessoal, intransferível e expira em 24 horas. Caso o botão não funcione, copie e cole o link a seguir no seu navegador:<br>
                    <span style="word-break: break-all; color: #6366f1;">${inviteLink}</span></p>
                </div>
                <div class="footer">
                    <p>Prisma Gabinete Virtual &copy; ${new Date().getFullYear()}</p>
                    <p>Esta é uma mensagem automática de segurança. Por favor, não responda a este e-mail.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `Olá, ${nome}!
Você foi convidado a participar do sistema Prisma - Gabinete Virtual.

Detalhes da conta:
- Unidade: ${unidadeId}
- Cargo: ${cargoFormatado}
- E-mail: ${email}

Para ativar sua conta e escolher sua senha permanente, acesse o link abaixo:
${inviteLink}

O link é válido por 24 horas.
`;

    return sendEmail({
        to: email,
        subject,
        html,
        text,
    });
}
