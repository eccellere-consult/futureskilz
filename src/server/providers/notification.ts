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

  // Variables can hold sign-in links, so they are printed only for a localhost APP_URL.
  constructor(private readonly revealVariables = false) {}

  async send(message: NotificationMessage): Promise<NotificationReceipt> {
    const externalId = `console:${message.idempotencyKey}`;
    console.info("Notification accepted by local fallback", {
      channel: this.channel,
      templateKey: message.templateKey,
      externalId,
      ...(this.revealVariables ? { variables: message.variables } : {}),
    });

    return { provider: "console", externalId, acceptedAt: new Date() };
  }
}
