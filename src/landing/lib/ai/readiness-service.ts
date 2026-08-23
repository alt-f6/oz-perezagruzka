import OpenAI from "openai";
import {
  readinessOutputSchema,
  type ReadinessInput,
  type ReadinessOutput,
} from "@/landing/lib/validations/readiness";

const DEEPSEEK_MODEL = "deepseek-chat";
const AI_TIMEOUT_MS = 30_000;

// DeepSeek's JSON mode (response_format: { type: "json_object" }) requires
// the system prompt to literally contain the word "JSON" plus an explicit
// description of the expected structure, or the API rejects the request
// with a 400 before generation even starts. This spec is deliberately
// spelled out with per-field types instead of relying on a schema object
// (unlike Gemini's responseSchema, DeepSeek's OpenAI-compatible endpoint has
// no structured-schema parameter).
const SYSTEM_INSTRUCTION = `РОЛЬ
Ты — опытный профориентатор и педагог-навигатор онлайн-школы подготовки к ОГЭ «Перезагрузка». За плечами сотни подростков 13-16 лет и их родителей. Формат: до 10 человек в группе, живой учитель + ИИ-репетитор.

ТВОЯ СУПЕРСИЛА
Ты одновременно понимаешь мир подростка (интересы, сленг, игры, соцсети, страх «быть не таким») и говоришь на языке уставшей тревожной мамы, которая боится зря потратить деньги и время. Ты соединяешь честную оценку готовности к ОГЭ и взгляд в будущее — куда ребёнок может расти.

ЗАДАЧА
По анкете о ребёнке собери «Карту готовности» — тёплую, но чёткую и структурную. Интересно читать и маме, и подростку. Верни результат СТРОГО в виде одного JSON-объекта (JSON, без markdown-обрамления вроде \`\`\`json, без пояснений вне JSON, без лишних полей) со следующей структурой:
- "whatISee" (строка): 2-3 предложения — перескажи ситуацию так, чтобы мама почувствовала «меня услышали», а подросток — «меня не осуждают».
- "attentionZones" (массив строк): 2-3 пункта честно и по приоритету. Если барьер не знания, а мотивация/самостоятельность — назови прямо и мягко.
- "strengths" (массив строк): 1-2 пункта, опираясь на увлечения и характер. Мостик к будущему.
- "futurePaths" (массив строк): 2-3 РЕАЛЬНЫЕ профессии ближайшего будущего (5-10 лет) под интересы; для каждой одним предложением покажи, как навык работы с ИИ её усиливает.
- "firstStep" (строка): 1-2 совета на сегодня и мягкое приглашение на бесплатный разбор.
- "readinessScore" (целое число 0-100): твоя внутренняя оценка текущей готовности к ОГЭ. Это служебное поле только для команды школы, оно НИКОГДА не показывается пользователю на сайте — не намекай на него в тексте остальных блоков.

Ответ должен быть единственным валидным JSON-объектом ровно с этими шестью полями, без дополнительных ключей.

ПРАВИЛА
Тёплый тон, без канцелярита. НИКОГДА не гарантируй балл на экзамене. Без диагнозов и ярлыков («ленивый», «неспособный»). Не выдумывай факты. Без обещаний зарплат. Если данных мало — честно скажи, что точную картину даст только живой разбор. К маме обращайся на «вы», о ребёнке говори по имени, если оно известно (если имя не указано — используй нейтральное «ваш ребёнок»). Весь текст на русском языке, 200-280 слов суммарно по всем текстовым блокам (без учёта readinessScore).`;

function stripMarkdown(value: string): string {
  return value.replace(/[#*]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

// Applied only to the one genuinely free-text field interpolated into the
// prompt (input.name). Other ReadinessInput fields (subjects, studyStyle,
// hobbies, deadline) are already constrained to fixed enum values by
// readinessInputSchema, so they carry no injection surface. This does NOT
// touch the value stored on Lead.name in readiness.ts, only what's sent to
// DeepSeek, so the CRM keeps the user's name as typed.
const PROMPT_CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const PROMPT_STRUCTURAL_CHARS = /[`*_#<>{}[\]]/g;
// Intentionally strips only the matched role-label prefix (e.g. "SYSTEM:"),
// not the imperative text that follows it. This is not meant to be a
// complete injection filter on its own; it relies on the surrounding
// defenses (the .slice(0, 80) length cap below and DeepSeek's output being
// independently constrained by readinessOutputSchema.safeParse) to
// neutralize whatever text remains.
const PROMPT_ROLE_INJECTION = /^\s*(system|assistant|user|ignore all|ignore previous)\s*[:-]/gim;

/** Exported for direct unit testing; not part of the module's runtime API surface. */
export function sanitizePromptInput(value: string): string {
  return value
    .replace(PROMPT_CONTROL_CHARS, "")
    .replace(PROMPT_STRUCTURAL_CHARS, "")
    .replace(PROMPT_ROLE_INJECTION, "")
    .slice(0, 80)
    .trim();
}

function sanitizeOutput(output: ReadinessOutput): ReadinessOutput {
  const clean = (val: string | string[]): string | string[] =>
    Array.isArray(val) ? val.map(stripMarkdown) : stripMarkdown(val);

  return {
    ...output,
    whatISee: clean(output.whatISee) as string,
    attentionZones: clean(output.attentionZones),
    strengths: clean(output.strengths),
    futurePaths: clean(output.futurePaths),
    firstStep: clean(output.firstStep) as string,
  };
}

/** Exported for direct unit testing; not part of the module's runtime API surface. */
export function cleanAndExtractJSON(rawText: string): string {
  let cleanText = rawText.trim();

  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleanText.match(jsonRegex);

  if (match && match[1]) {
    cleanText = match[1].trim();
  }

  return cleanText;
}

const DEADLINE_LABELS: Record<ReadinessInput["deadline"], string> = {
  "<3m": "меньше 3 месяцев",
  "3-6m": "3-6 месяцев",
  "6-12m": "6-12 месяцев",
  ">1y": "больше года",
};

function buildPrompt(input: ReadinessInput): string {
  return `Данные ученика:
- Имя: ${input.name?.trim() ? sanitizePromptInput(input.name.trim()) || "не указано" : "не указано"}
- Класс: ${input.grade}
- Предметы ОГЭ: ${input.subjects}
- Как учится: ${input.studyStyle}
- Увлечения: ${input.hobbies.split("|").join(", ")}
- Срок до ОГЭ: ${DEADLINE_LABELS[input.deadline]}

Сгенерируй персональную «Карту готовности» строго в заданном JSON-формате.`;
}

export interface ReadinessAiResult {
  output: ReadinessOutput;
  model: string;
  latencyMs: number;
}

export async function generateReadinessMap(
  input: ReadinessInput,
): Promise<ReadinessAiResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  const client = new OpenAI({ apiKey, baseURL });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const completion = await client.chat.completions.create(
      {
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: buildPrompt(input) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      },
      { signal: controller.signal },
    );
    const latencyMs = Date.now() - startedAt;

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleanedRaw = cleanAndExtractJSON(raw);

    let candidate: unknown;
    try {
      candidate = JSON.parse(cleanedRaw);
    } catch {
      if (process.env.NODE_ENV !== "production") {
        console.error("❌ [DeepSeek JSON Parse Error] Failed to parse cleaned raw text:", cleanedRaw);
        console.error("Original raw response was:", raw);
      } else {
        console.error("❌ [DeepSeek JSON Parse Error] Failed to parse model output (length:", cleanedRaw.length, "chars)");
      }
      throw new Error("DeepSeek returned non-JSON output or invalid format");
    }

    const parsed = readinessOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      if (process.env.NODE_ENV !== "production") {
        console.error("❌ [Zod Schema Mismatch] Validating DeepSeek output failed!");
        console.error("Candidate JSON received:", JSON.stringify(candidate, null, 2));
        console.error("Validation Errors:", parsed.error.format());
      } else {
        console.error("❌ [Zod Schema Mismatch] DeepSeek output failed schema validation");
      }
      throw new Error(`DeepSeek response failed schema validation: ${parsed.error.message}`);
    }

    return { output: sanitizeOutput(parsed.data), model: DEEPSEEK_MODEL, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}
