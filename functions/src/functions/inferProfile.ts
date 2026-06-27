import { onCall } from 'firebase-functions/v2/https';
import { FUNCTION_OPTS, ANTHROPIC_API_KEY } from '../config';
import { verifyAuth } from '../middleware/auth';

type SeekerProfile = 'clarity' | 'comfort' | 'action' | 'surrender';
const VALID_PROFILES = new Set<SeekerProfile>(['clarity', 'comfort', 'action', 'surrender']);

export const inferProfile = onCall(
  {
    ...FUNCTION_OPTS,
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (request): Promise<{ profile: SeekerProfile }> => {
    verifyAuth(request);

    const d = request.data as { answers?: unknown } | null;
    const raw = Array.isArray(d?.answers) ? (d.answers as unknown[]) : [];
    const answers = raw
      .slice(0, 3)
      .map(a => (typeof a === 'string' ? a.slice(0, 200) : ''));

    const [a1 = '', a2 = '', a3 = ''] = answers;

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      return { profile: 'clarity' };
    }

    const prompt = `A seeker answered three onboarding questions for an Islamic oracle app.

Answer 1 (Intent): "${a1}"
Answer 2 (Register): "${a2}"
Answer 3 (Timing): "${a3}"

Based on these three answers, classify the seeker's primary spiritual orientation into exactly one of: clarity, comfort, action, surrender.

Respond with ONLY the single classification word.
No explanation. No punctuation.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        return { profile: 'clarity' };
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const profile = (data.content ?? [])
        .filter(b => b.type === 'text')
        .map(b => b.text ?? '')
        .join('')
        .trim()
        .toLowerCase() as SeekerProfile;

      return { profile: VALID_PROFILES.has(profile) ? profile : 'clarity' };
    } catch {
      return { profile: 'clarity' };
    }
  },
);
