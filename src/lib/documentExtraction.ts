/**
 * documentExtraction.ts — generalized "read a client-uploaded document,
 * pull out only the values explicitly stated or directly computable against
 * a given field schema" extractor. Originated in selfServiceEngine.ts as
 * extractAnswersFromDocument (tied to that engine's Step[] shape); lifted out
 * here so Business Context, AI Discovery Studio, Design Studio, and any
 * future form can reuse the same mechanism against their own flat field
 * lists, without importing a file scoped to the Self-Service Generator.
 */

import { chatCompletionContentWithFailover, modelFor } from './llmClient';

export interface ExtractableField {
  id: string;
  label: string;
  type?: string;
  options?: string[];
}

export async function extractFieldsFromDocument(
  fields: ExtractableField[],
  docText: string
): Promise<Record<string, string>> {
  const schema = fields.map((f) => ({ id: f.id, label: f.label, type: f.type, options: f.options }));

  const systemPrompt = `You extract form-field values from a document a client has uploaded, strictly against a given question schema.

RULES:
1. Only include a question id in your output if its value is explicitly stated in the document, or directly computable from numbers explicitly stated in it (e.g. growth rate from two years of revenue).
2. Never guess, infer from industry norms, or invent a plausible-sounding value. If the document doesn't clearly contain it, omit that key entirely.
3. For "select"/"radio" questions, only fill in a value if it exactly matches one of the provided options; otherwise omit it.
4. Keep values concise — a number, a short phrase, or (for textarea) a few sentences at most, not a copy of the whole document.

Output a single JSON object: { "answers": { "<question_id>": "<value>", ... } } — no markdown, no commentary, no code fences. Include only keys you are confident about; an empty object is a valid answer if nothing matches.`;

  const { content: raw } = await chatCompletionContentWithFailover((provider) => {
    const { model, reasoningEffort } = modelFor(provider);
    return {
      model,
      reasoning_effort: reasoningEffort,
      max_completion_tokens: 3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Question schema:\n${JSON.stringify(schema, null, 2)}\n\nUploaded document:\n\n${docText}`,
        },
      ],
    };
  });

  const parsed = JSON.parse(raw) as { answers?: Record<string, unknown> };

  // The model's output isn't runtime-checked against our TS types — coerce
  // every value to a string (or drop it) so callers never have to guard
  // against a stray number/boolean/object breaking a .trim() downstream.
  const answers: Record<string, string> = {};
  for (const [id, val] of Object.entries(parsed.answers ?? {})) {
    if (val === null || val === undefined) continue;
    if (typeof val === 'object') continue; // arrays/objects aren't a valid form-field value
    const str = String(val).trim();
    if (str) answers[id] = str;
  }
  return answers;
}
