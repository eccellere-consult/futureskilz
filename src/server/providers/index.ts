import "server-only";

import { getServerEnvironment } from "@/server/env";

import {
  DeterministicAiProvider,
  FallbackAiProvider,
  OpenAiCompatibleProvider,
  type AiProvider,
} from "./ai";
import { ConsoleNotificationProvider } from "./notification";
import { InMemoryStorageProvider } from "./storage";

function availableProviders(providers: Array<AiProvider | null>): AiProvider[] {
  return providers.filter((provider): provider is AiProvider => provider !== null);
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
    notifications: new ConsoleNotificationProvider(),
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
