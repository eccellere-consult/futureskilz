export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiRequest = {
  messages: AiMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
};

export type AiResponse = {
  content: string;
  provider: string;
  model: string;
  usage: AiUsage;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(request: AiRequest): Promise<AiResponse>;
}

type OpenAiCompatibleOptions = {
  name: "openai" | "xai";
  model: string;
  baseUrl: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: "openai" | "xai";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: OpenAiCompatibleOptions) {
    this.name = options.name;
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    const response = await this.fetchImplementation(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxOutputTokens ?? 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`${this.name} request failed with status ${response.status}.`);
    }

    const result = (await response.json()) as ChatCompletionResponse;
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${this.name} returned no message content.`);

    return {
      content,
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: result.usage?.prompt_tokens ?? 0,
        outputTokens: result.usage?.completion_tokens ?? 0,
        costMicros: 0,
      },
    };
  }
}

export class FallbackAiProvider implements AiProvider {
  readonly name = "fallback-chain";
  readonly model: string;

  constructor(private readonly providers: AiProvider[]) {
    if (providers.length === 0) throw new Error("At least one AI provider is required.");
    this.model = providers.map((provider) => provider.model).join(" -> ");
  }

  async generate(request: AiRequest): Promise<AiResponse> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await provider.generate(request);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All AI providers failed.");
  }
}

export class DeterministicAiProvider implements AiProvider {
  readonly name = "deterministic";
  readonly model = "local-fallback-v1";

  async generate(request: AiRequest): Promise<AiResponse> {
    const latestUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === "user")?.content;
    const content = latestUserMessage
      ? `I understand: ${latestUserMessage.slice(0, 160)}. Let's choose one concrete next step.`
      : "Tell me what you want to become capable of doing.";

    return {
      content,
      provider: this.name,
      model: this.model,
      usage: {
        inputTokens: request.messages.reduce(
          (total, message) => total + Math.ceil(message.content.length / 4),
          0,
        ),
        outputTokens: Math.ceil(content.length / 4),
        costMicros: 0,
      },
    };
  }
}
