import Anthropic from '@anthropic-ai/sdk'
import type { LiveSegment, LiveVerdict } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Judge an unstructured, in-person debate (one-phone mode).
//
// This is a DIFFERENT rubric from the structured two-phone judge in
// app/api/judge/route.ts: there are no formal sides or rounds, so Claude has to
// infer the topic, decide which diarized voice (A/B) was arguing which side, and
// score on criteria suited to a free-form argument. The rubric is deliberately
// length-neutral — talking more must not earn a higher score.
export async function judgeLiveDebate(segments: LiveSegment[]): Promise<LiveVerdict> {
  // Flatten the diarized utterances into a readable transcript for the prompt.
  const transcriptText = segments
    .map((s) => `Speaker ${s.speaker}: ${s.text}`)
    .join('\n')

  const message = await anthropic.messages.create({
    // The Claude API skill mandates claude-opus-4-8 as the default model.
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert, impartial debate judge analyzing an UNSTRUCTURED, in-person argument between two people, recorded on a single device. The transcript below is automatically diarized: each line is labeled "Speaker A" or "Speaker B".

The conversation was casual and free-form — there were no formal sides, rounds, or time limits. Do all of the following:

1. Infer the TOPIC they were effectively arguing about.
2. Assess the TONE of the debate. Is this a casual/lighthearted argument (e.g. where to go tonight, sports opinions, pop culture) or a serious/substantive one (e.g. economics, policy, philosophy)? This determines your voice in steps 4 and 5.
3. Work out each speaker's position, then assign one speaker to "pro" and the other to "con" (pro = the side advancing or defending the main claim; con = the side opposing it). Always assign a winner — every argument has two sides.
4. Score EACH side 1-10 on five criteria:
   - argument: strength and clarity of their core claims and reasoning
   - evidence: use of facts, examples, and concrete support (vs. bare assertion)
   - responsiveness: how well they actually engaged the other person's points instead of talking past them
   - consistency: internal logic; absence of contradictions or fallacies
   - persuasiveness: the overall convincing force of their case
   Then identify each side's single BEST criterion (highest score) and single WORST criterion (lowest score).
5. Pick a WINNER ("pro" or "con") — the side that argued better overall. You must always pick one.
6. Write a summary (2-4 sentences) and per-side feedback (2-3 sentences) with a voice that MATCHES THE TONE you assessed:
   - Casual/lighthearted debate → write like a witty, amused friend watching the argument. Have some fun with it.
   - Serious/substantive debate → write like an analytical, authoritative judge. Stay precise and incisive.
   Either way, keep the structure — just match the register to the room.

CRITICAL JUDGING RULES:
- Judge QUALITY, not QUANTITY. Speaking more, talking longer, or interrupting must NOT earn a higher score. A concise, sharp point beats a long rambling one.
- Reward intellectual honesty: conceding a fair point is good-faith reasoning, not a loss.
- Base everything ONLY on what was actually said in the transcript.
- LANGUAGE: Debaters may speak different languages. Judge each speaker's arguments in the language they used. Do NOT penalize anyone for speaking a language other than English — score the quality of the argument itself, regardless of language.

Respond with ONLY a valid JSON object in exactly this format, no text outside the JSON:
{
  "topic": "<the topic they were arguing about>",
  "winner": "pro" or "con",
  "summary": "<2-4 sentence explanation of the verdict, tone-matched to the debate>",
  "pro": {
    "speaker": "A" or "B",
    "scores": { "argument": <1-10>, "evidence": <1-10>, "responsiveness": <1-10>, "consistency": <1-10>, "persuasiveness": <1-10> },
    "best_criterion": "<the key with the highest score: argument | evidence | responsiveness | consistency | persuasiveness>",
    "worst_criterion": "<the key with the lowest score: argument | evidence | responsiveness | consistency | persuasiveness>",
    "feedback": "<2-3 sentences, tone-matched>"
  },
  "con": {
    "speaker": "A" or "B",
    "scores": { "argument": <1-10>, "evidence": <1-10>, "responsiveness": <1-10>, "consistency": <1-10>, "persuasiveness": <1-10> },
    "best_criterion": "<the key with the highest score: argument | evidence | responsiveness | consistency | persuasiveness>",
    "worst_criterion": "<the key with the lowest score: argument | evidence | responsiveness | consistency | persuasiveness>",
    "feedback": "<2-3 sentences, tone-matched>"
  }
}

--- TRANSCRIPT ---
${transcriptText}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected non-text response from Claude')
  }

  // Claude is instructed to return only JSON, but strip any markdown code fences
  // it might wrap the JSON in before parsing (same guard as the structured judge).
  const jsonText = content.text
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  return JSON.parse(jsonText) as LiveVerdict
}
