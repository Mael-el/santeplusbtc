import nodemailer from 'nodemailer';

export interface PasswordResetEmailResult {
  success: boolean;
  message: string;
  devCode?: string;
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST?.trim(),
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER?.trim(),
    pass: process.env.SMTP_PASSWORD?.trim(),
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    from: process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || 'no-reply@santeplus.bj',
  };
}

export async function sendPasswordResetEmail(recipient: string, code: string): Promise<PasswordResetEmailResult> {
  const { host, port, user, pass, secure, from } = getSmtpConfig();

  if (process.env.NODE_ENV === 'production' && (!host || !user || !pass)) {
    throw new Error('SMTP email configuration is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASSWORD.');
  }

  if (!host || !user || !pass) {
    const devCode = code;
    console.info(`[Email] Reset code for ${recipient}: ${devCode}`);
    return {
      success: true,
      message: 'Code de réinitialisation généré en mode développement. Vérifiez les logs du serveur.',
      devCode,
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: recipient,
    subject: 'Réinitialisation du mot de passe - Santé+ Bénin',
    text: `Votre code de réinitialisation est : ${code}. Il expire dans 15 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="color: #065f46; margin-bottom: 12px;">Réinitialisation du mot de passe</h2>
        <p>Vous avez demandé une réinitialisation de votre mot de passe sur Santé+ Bénin.</p>
        <p>Voici votre code de vérification :</p>
        <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 18px; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #064e3b; margin: 12px 0;">
          ${code}
        </div>
        <p>Ce code expire dans 15 minutes.</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    `,
  });

  return {
    success: true,
    message: 'Un code de réinitialisation a été envoyé par email.',
  };
}
