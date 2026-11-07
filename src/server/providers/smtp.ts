import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { renderEmail } from "@/server/email/templates";

import type { NotificationMessage, NotificationProvider, NotificationReceipt } from "./notification";

export type SmtpOptions = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

export class SmtpEmailProvider implements NotificationProvider {
  readonly channel = "email" as const;
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth: { user: options.user, pass: options.password },
    });
  }

  /** Signs in to the mail server without sending anything; throws the server's error when the login or connection fails. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }

  async send(message: NotificationMessage): Promise<NotificationReceipt> {
    const email = renderEmail(message.templateKey, message.variables);
    const result = await this.transporter.sendMail({
      from: this.options.from,
      to: message.destination,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: message.attachments,
      headers: { "X-Entity-Ref-ID": message.idempotencyKey },
    });

    return { provider: "smtp", externalId: result.messageId, acceptedAt: new Date() };
  }
}
