import "server-only";
import nodemailer from "nodemailer";
import { config } from "./config";

export async function sendLoginEmail(email: string, link: string): Promise<{ devLink?: string }> {
  if (!config.smtpUrl) {
    if (config.isProd) throw new Error("SMTP_URL manquant en production");
    console.log(`\n[auth] Lien de connexion pour ${email} :\n${link}\n`);
    return { devLink: link };
  }
  const transport = nodemailer.createTransport(config.smtpUrl);
  await transport.sendMail({
    from: config.mailFrom,
    to: email,
    subject: "Ton lien de connexion – Winamax LoL Pronos",
    text: `Salut !\n\nClique sur ce lien pour te connecter (valable 15 minutes) :\n${link}\n\nSi tu n'es pas à l'origine de cette demande, ignore cet email.`,
    html: `<div style="font-family:Arial,sans-serif;background:#0B0B0B;color:#fff;padding:32px">
      <h1 style="color:#E30613;font-style:italic;text-transform:uppercase;margin:0 0 16px">LoL Pronos</h1>
      <p>Clique sur le bouton pour te connecter. Le lien est valable 15 minutes.</p>
      <p><a href="${link}" style="display:inline-block;background:#E30613;color:#fff;padding:12px 24px;text-decoration:none;font-weight:bold;text-transform:uppercase">Se connecter</a></p>
      <p style="color:#9A9A9A;font-size:12px">Si tu n'es pas à l'origine de cette demande, ignore cet email.</p></div>`,
  });
  return {};
}
