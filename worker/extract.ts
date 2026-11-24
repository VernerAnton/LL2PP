// Claude CV extraction, run on the Worker so the Anthropic API key never reaches a browser.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { CandidateData, WorkExperience, Education, ExtraDetail } from '../src/types';
import type { ExtractRequest, ExtractResponse, ThinkingEffort } from '../src/shared/apiTypes';
import { selectedExtraFields, type ExtraField } from '../src/services/extraDetails';

// Schema for the extracted CV data. It is sent to the API as a structured-output JSON schema,
// so Claude's answer is guaranteed to be valid JSON of this shape, and the SDK validates the
// constraints the API can't enforce (e.g. non-empty strings) on the way back.
const WorkExperienceSchema = z.object({
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  dates: z.string().optional(),
});

const EducationSchema = z.object({
  institution: z.string().min(1),
  // Optional - formal degrees, exchange programs (e.g. Erasmus), and significant certificates are all valid
  degree: z.string().optional(),
  dates: z.string().optional(),
});

const CVDataSchema = z.object({
  name: z.string().min(1),
  workHistory: z.array(WorkExperienceSchema),
  education: z.array(EducationSchema),
});

// Extra details requested for a run (e.g. location) come back in "extras", keyed by field id.
// '' means the CV doesn't state it.
type CVData = z.infer<typeof CVDataSchema> & { extras?: Record<string, string> };

function buildSchema(extraFields: ExtraField[]) {
  if (extraFields.length === 0) return CVDataSchema;
  return CVDataSchema.extend({
    extras: z.object(
      Object.fromEntries(extraFields.map((field) => [field.id, z.string().describe(field.instruction)]))
    ),
  });
}

function buildUserMessage(cvText: string, extraFields: ExtraField[]): string {
  if (extraFields.length === 0) return `Extract the candidate data from this CV:\n\n${cvText}`;
  const fieldList = extraFields.map((field) => `- ${field.id}: ${field.instruction}`).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  return `Extract the candidate data from this CV. For this longlist, also extract these extra details into "extras":
${fieldList}

Each value is shown after the candidate's name on a slide, so keep it short and in exactly the form described. Base it only on what the CV states. If the CV doesn't give the information, use an empty string. Never guess.

Today's date: ${today}

CV:

${cvText}`;
}

// Values that mean "not stated" even though the instructions ask for an empty string
const EMPTY_VALUES = /^(-+|n\/?a|none|unknown|not (specified|stated|mentioned|available|given))\.?$/i;

// The app always uses the newest Claude Sonnet the API key can access (looked up via the
// Models API). This is the known-good model used if that lookup fails or the newest model
// rejects the request.
const FALLBACK_MODEL = 'claude-sonnet-5-5';

// Per-1M-token prices (USD) for the cost estimate shown in the UI. The Models API doesn't
// report prices, so a newer Sonnet not listed here is estimated at Sonnet 5.5 rates.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2.00, output: 10.00 },
  // Server-side refusal fallbacks may hand a request to another model
  'claude-opus-5-5': { input: 4.00, output: 20.00 },
};

const SYSTEM_PROMPT = `You extract structured candidate data from CVs for a recruitment longlist. The data is placed on presentation slides, so it must be accurate and consistently formatted.

1. Name
   - The candidate's complete full name.

2. Work history (at most the 5 most recent positions, most recent first)
   - Include only operational/employment positions the person actively held (CEO, CTO, Manager, Engineer, etc.).
   - Exclude all board positions: Board Member, Board Director, Advisory Board, Board of Directors, Non-Executive Director, Supervisory Board, Board Observer, Board Advisor. If someone has both operational and board roles, keep only the operational ones.
   - For each position give the company name, job title, and dates.
   - Dates: "MM/YYYY - MM/YYYY" when months are available (e.g. "03/2020 - 08/2023"), otherwise "YYYY - YYYY" (e.g. "2020 - 2023"). Use "Present" as the end date for current positions (e.g. "01/2022 - Present").
   - If the CV gives no dates for a position, leave the dates out. Never guess or invent dates.

3. Education
   - Include formal degrees (Bachelor, Master, MBA, PhD, etc.), significant certificate programs, and international exchange semesters (e.g. Erasmus, study abroad).
   - For exchanges or certificates without a formal degree title, put the program or exchange name in the degree field (e.g. "Erasmus Exchange Semester", "Google Data Analytics Certificate").
   - Exclude high school / secondary education, short online courses (under 3 months), and entries that list only an institution with no program or exchange.
   - Give the institution name, degree/program/exchange name where there is one, and dates in the same format as work history (leave dates out if missing).
   - If nothing qualifies, return an empty list.`;


// How long the "newest Sonnet" lookup is reused before asking the Models API again
const MODEL_CACHE_MS = 60 * 60 * 1000;
let cachedModel: { model: Promise<string>; at: number } | null = null;

function client(env: Env): Anthropic {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    // Only set in local development (.dev.vars), to point at a mock server
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    maxRetries: 3,
  });
}

/**
 * The newest active Claude Sonnet that supports everything the request uses. New Sonnet
 * releases are picked up automatically; claude-sonnet-5-5 is used if the lookup fails.
 */
export function getModel(env: Env): Promise<string> {
  if (cachedModel && Date.now() - cachedModel.at < MODEL_CACHE_MS) return cachedModel.model;
  const model = findNewestSonnet(client(env));
  cachedModel = { model, at: Date.now() };
  return model;
}

async function findNewestSonnet(anthropic: Anthropic): Promise<string> {
  try {
    const sonnets: Anthropic.ModelInfo[] = [];
    for await (const model of anthropic.models.list()) {
      if (model.line === 'sonnet' && model.lifecycle === 'active' && isCompatible(model)) sonnets.push(model);
    }
    sonnets.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return sonnets[0]?.id ?? FALLBACK_MODEL;
  } catch (error) {
    console.warn(`Could not look up the newest Sonnet, using ${FALLBACK_MODEL}:`, error);
    return FALLBACK_MODEL;
  }
}

function isCompatible(model: Anthropic.ModelInfo): boolean {
  const caps = model.capabilities;
  if (!caps) return false;
  return (
    caps.structured_outputs.supported &&
    caps.thinking.types.adaptive.supported &&
    caps.effort.low.supported &&
    caps.effort.medium.supported &&
    caps.effort.high.supported
  );
}

/** A problem with Claude's answer (not with the API call): worth retrying at a higher effort */
class OutputError extends Error {}

/**
 * Extract one CV. Retries once if the answer fails validation, and switches to the
 * known-good model if the newest Sonnet rejects the request.
 */
export async function extractCV(env: Env, request: ExtractRequest): Promise<ExtractResponse> {
  const anthropic = client(env);
  const fields = selectedExtraFields(request.extraFields);
  let lastError = 'Unknown error';
  let outputProblem = false;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const model = await getModel(env);
    try {
      return await performExtraction(anthropic, model, request.cvText, fields, request.effort);
    } catch (error) {
      lastError = describeError(error);
      outputProblem = error instanceof OutputError;
      console.error(`Extraction attempt ${attempt} failed:`, lastError);

      if (error instanceof Anthropic.BadRequestError && model !== FALLBACK_MODEL) {
        console.warn(`${model} rejected the request; switching to ${FALLBACK_MODEL}`);
        cachedModel = { model: Promise.resolve(FALLBACK_MODEL), at: Date.now() };
        continue;
      }
      // The SDK has already retried transient API errors; anything left won't be fixed by trying again
      if (error instanceof Anthropic.APIError) break;
    }
  }

  return { success: false, error: lastError, retryAtHigherEffort: outputProblem };
}

async function performExtraction(
  anthropic: Anthropic,
  model: string,
  cvText: string,
  extraFields: ExtraField[],
  effort: ThinkingEffort
): Promise<ExtractResponse> {
  const response = await anthropic.beta.messages.parse({
    model,
    // Leaves room for thinking tokens as well as the JSON answer
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(cvText, extraFields) }],
    // Thinking is adaptive (Claude decides how much to think); effort sets how deep it goes
    output_config: {
      effort,
      format: betaZodOutputFormat(buildSchema(extraFields)),
    },
    // If a safety classifier declines a CV by mistake, the API retries it on a fallback model
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category;
    throw new Error(`Claude declined to process this CV${category ? ` (${category})` : ''}`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new OutputError('Claude ran out of output tokens before finishing');
  }
  if (!response.parsed_output) {
    throw new OutputError('Claude returned no structured data');
  }

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return {
    success: true,
    data: toCandidateData(response.parsed_output, extraFields),
    model: response.model,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      // response.model is the model that actually answered (differs if a fallback ran)
      estimatedCost: calculateCost(response.model, inputTokens, outputTokens),
    },
  };
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = PRICING[model] ?? PRICING[FALLBACK_MODEL];
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

function toCandidateData(data: CVData, extraFields: ExtraField[]): CandidateData {
  const workHistory: WorkExperience[] = filterBoardMemberRoles(
    data.workHistory.map((item) => ({
      company: item.company.trim(),
      jobTitle: item.jobTitle.trim(),
      dates: item.dates?.trim() || undefined,
    }))
  ).slice(0, 5);

  const education: Education[] = data.education.map((item) => ({
    institution: item.institution.trim(),
    degree: item.degree?.trim() || undefined,
    dates: item.dates?.trim() || undefined,
  }));

  const extras: ExtraDetail[] = extraFields.map((field) => {
    const value = (data.extras?.[field.id] ?? '').trim();
    return { label: field.label, value: EMPTY_VALUES.test(value) ? '' : value };
  });

  return {
    name: data.name.trim(),
    workHistory,
    education,
    ...(extras.length > 0 ? { extras } : {}),
  };
}

/** Client-side backup to the prompt instruction */
function filterBoardMemberRoles(workHistory: WorkExperience[]): WorkExperience[] {
  const boardKeywords = [
    'board member',
    'board director',
    'advisory board',
    'board of directors',
    'non-executive director',
    'supervisory board',
    'board observer',
    'board advisor',
  ];
  return workHistory.filter((experience) => {
    const titleLower = experience.jobTitle.toLowerCase();
    return !boardKeywords.some((keyword) => titleLower.includes(keyword));
  });
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Anthropic API key on the server is invalid. Check ANTHROPIC_API_KEY in the Worker settings.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'The Anthropic API key does not have access to Claude Sonnet.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limit reached. Lower the concurrency level or try again in a minute.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error ${error.status ?? ''}: ${error.message}`.trim();
  }
  return error instanceof Error ? error.message : String(error);
}
