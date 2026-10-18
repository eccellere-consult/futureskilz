import "server-only";

import { getServerEnvironment } from "@/server/env";

import {
  DeterministicAiProvider,
  FallbackAiProvider,
  OpenAiCompatibleProvider,
  type AiProvider,
} from "./ai";
import { ConsoleNotificationProvider, type NotificationProvider } from "./notification";
import { SmtpEmailProvider } from "./smtp";
import { InMemoryStorageProvider } from "./storage";

function availableProviders(providers: Array<AiProvider | null>): AiProvider[] {
  return providers.filter((provider): provider is AiProvider => provider !== null);
}

function createNotificationProvider(environment: ReturnType<typeof getServerEnvironment>): NotificationProvider {
  if (environment.NOTIFICATION_PROVIDER === "smtp") {
    if (!environment.SMTP_USER || !environment.SMTP_PASSWORD || !environment.EMAIL_FROM) {
      throw new Error("SMTP_USER, SMTP_PASSWORD and EMAIL_FROM are required when NOTIFICATION_PROVIDER=smtp.");
    }
    return new SmtpEmailProvider({
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      user: environment.SMTP_USER,
      password: environment.SMTP_PASSWORD,
      from: environment.EMAIL_FROM,
    });
  }

  const isLocalApp = ["localhost", "127.0.0.1"].includes(new URL(environment.APP_URL).hostname);
  return new ConsoleNotificationProvider(isLocalApp);
}

export function createProviders() {
  const environment = getServerEnvironment();
  const deterministic = new DeterministicAiProvider();
  const openAi = environment.OPENAI_API_KEY
    ? new OpenAiCompatibleProvider({
        name: "openai",
        model: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com/v1",
        apiKey: environment.OPENAI_API_KEY,
      })
    : null;
  const xAi = environment.XAI_API_KEY
    ? new OpenAiCompatibleProvider({
        name: "xai",
        model: "grok-3-mini",
        baseUrl: "https://api.x.ai/v1",
        apiKey: environment.XAI_API_KEY,
      })
    : null;
  const available = availableProviders([openAi, xAi]);
  const prioritized =
    environment.AI_PROVIDER === "xai" ? [xAi, openAi] : [openAi, xAi];
  const configured = availableProviders(prioritized);
  const ai =
    environment.AI_PROVIDER === "deterministic" || available.length === 0
      ? deterministic
      : new FallbackAiProvider([...configured, deterministic]);

  return {
    ai,
    storage: new InMemoryStorageProvider(),
    notifications: createNotificationProvider(environment),
    configuration: {
      ai: environment.AI_PROVIDER,
      storage: environment.STORAGE_PROVIDER,
      notifications: environment.NOTIFICATION_PROVIDER,
    },
  };
}

export * from "./ai";
export * from "./notification";
export * from "./storage";
