export type NotificationMessage = {
  destination: string;
  templateKey: string;
  variables: Record<string, string>;
  idempotencyKey: string;
};

export type NotificationReceipt = {
  provider: string;
  externalId: string;
  acceptedAt: Date;
};

export interface NotificationProvider {
  readonly channel: "whatsapp" | "email" | "web_push";
  send(message: NotificationMessage): Promise<NotificationReceipt>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
  readonly channel = "email" as const;

  async send(message: NotificationMessage): Promise<NotificationReceipt> {
    const externalId = `console:${message.idempotencyKey}`;
    console.info("Notification accepted by local fallback", {
      channel: this.channel,
      templateKey: message.templateKey,
      externalId,
    });

    return { provider: "console", externalId, acceptedAt: new Date() };
  }
}
