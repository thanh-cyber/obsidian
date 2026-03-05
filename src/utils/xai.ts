/**
 * xAI Grok Chat Completions API (OpenAI-compatible).
 * @see https://docs.x.ai/docs/guides/chat-completions
 * @see https://docs.x.ai/developers/models
 */

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const MODEL = "grok-4-1-fast-reasoning";
const DEFAULT_MAX_TOKENS = 4096;
const REASONING_TIMEOUT_MS = 120_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface XaiChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; refusal?: string | null };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_XAI_API_KEY;
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : undefined;
}

export function hasXaiApiKey(): boolean {
  return !!getApiKey();
}

/**
 * Send a chat completion request to xAI Grok.
 * Uses grok-4-1-fast-reasoning model. Reasoning models may take longer; timeout is 120s.
 */
export async function sendXaiChat(messages: ChatMessage[]): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("xAI API key not configured. Set VITE_XAI_API_KEY in .env.local.");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("At least one message is required.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REASONING_TIMEOUT_MS);

  try {
    const res = await fetch(XAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: DEFAULT_MAX_TOKENS,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      let errMessage = `xAI API error ${res.status}`;
      try {
        const json = JSON.parse(text);
        if (json.error?.message) errMessage = json.error.message;
      } catch {
        if (text) errMessage += `: ${text.slice(0, 200)}`;
      }
      throw new Error(errMessage);
    }

    const data = (await res.json()) as XaiChatResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (content == null || (typeof content === "string" && content.trim() === "")) {
      throw new Error("Empty or invalid response from xAI.");
    }
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Try a shorter message or try again.");
      }
      throw err;
    }
    throw new Error("Failed to reach xAI API.");
  }
}
