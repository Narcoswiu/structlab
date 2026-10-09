import "server-only";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import { serverEnv } from "@/lib/env.server";

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.SMTP_HOST && serverEnv.EMAIL_FROM);
}

/** Адресът за въпроси в имейлите – взима се от „От:“ („Име <адрес>“ → адрес). */
export function getContactEmail(): string {
  const from = serverEnv.EMAIL_FROM ?? "";
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  template: ReactElement;
  /** на кого да отиде отговорът, ако не е подателят */
  replyTo?: string;
  /** допълнителни заглавки, напр. „List-Unsubscribe“ за напомнянията */
  headers?: Record<string, string>;
};

export async function sendEmail({
  to,
  subject,
  template,
  replyTo,
  headers,
}: SendEmailInput) {
  if (!isEmailConfigured()) {
    throw new Error("Пощата не е настроена (липсват SMTP_HOST / EMAIL_FROM).");
  }

  const port = serverEnv.SMTP_PORT ?? 465;
  const transport = nodemailer.createTransport({
    host: serverEnv.SMTP_HOST,
    port,
    secure: port === 465,
    auth: serverEnv.SMTP_USER
      ? { user: serverEnv.SMTP_USER, pass: serverEnv.SMTP_PASS }
      : undefined,
  });

  // Изпращаме и HTML, и чист текст – вторият е за клиенти без HTML и помага
  // писмото да не попадне в спам.
  const [html, text] = await Promise.all([
    render(template),
    render(template, { plainText: true }),
  ]);

  await transport.sendMail({
    from: serverEnv.EMAIL_FROM,
    to,
    replyTo,
    subject,
    html,
    text,
    headers,
  });
}
