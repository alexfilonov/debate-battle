import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/judge
// Fetches all speeches for a debate, sends them to Claude, saves the verdict.
// Idempotent: if a judgement already exists it returns it without calling Claude again.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { debateId } = await request.json()
  if (!debateId) return NextResponse.json({ error: 'Missing debateId' }, { status: 400 })

  // Return early if this debate has already been judged
  const { data: existing } = await supabase
    .from('judgements')
    .select('*')
    .eq('debate_id', debateId)
    .single()

  if (existing) return NextResponse.json({ judgement: existing })

  // Fetch the debate, participants, and speeches all at once
  const [debateRes, participantsRes, speechesRes] = await Promise.all([
    supabase.from('debates').select('*').eq('id', debateId).single(),
    supabase.from('debate_participants').select('*').eq('debate_id', debateId),
    supabase.from('speeches').select('*').eq('debate_id', debateId),
  ])

  if (debateRes.error || !debateRes.data) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  const debate = debateRes.data
  const participants = participantsRes.data ?? []
  const speeches = speechesRes.data ?? []

  // Build a lookup from user_id → side so we can label each speech
  const sideByUser = Object.fromEntries(participants.map(p => [p.user_id, p.side]))

  // Get each of the 4 speeches by side + round
  function getTranscript(side: string, round: number): string {
    const speech = speeches.find(
      s => sideByUser[s.user_id] === side && s.round === round
    )
    return speech?.transcript ?? '[No transcript available]'
  }

  const affOpening   = getTranscript('affirmative', 1)
  const negOpening   = getTranscript('negative', 1)
  const affRebuttal  = getTranscript('affirmative', 2)
  const negRebuttal  = getTranscript('negative', 2)

  // Ask Claude to judge the debate and return structured JSON
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an experienced competitive debate judge. Evaluate the following debate and provide a verdict.

RESOLUTION: "${debate.resolution}"

--- AFFIRMATIVE OPENING SPEECH (Round 1) ---
${affOpening}

--- NEGATIVE OPENING SPEECH (Round 1) ---
${negOpening}

--- AFFIRMATIVE REBUTTAL (Round 2) ---
${affRebuttal}

--- NEGATIVE REBUTTAL (Round 2) ---
${negRebuttal}

Weigh each debater's OPENING and REBUTTAL equally — a strong rebuttal does not
make up for a weak opening, and vice versa.

Do all of the following:

1. Score each debater 1-10 on three dimensions:
   - argumentation: clarity, structure, and strength of their arguments
   - evidence: use of evidence, examples, and logical reasoning
   - rebuttal: how directly and effectively they engaged with the opponent

2. Identify the 2-4 main arguments (points) EACH side made. For each point, judge
   how well the OPPOSING side responded to it:
   - "refuted": directly and convincingly answered
   - "partial": acknowledged but only partly answered
   - "dropped": ignored entirely
   A dropped or partially-answered point counts in favor of the side that made it.

3. For each debater give one headline strength, one biggest area to improve, and
   2-3 concrete, actionable suggestions to strengthen their case — better argument
   angles, tighter logic, or specific evidence they could have used.

Respond with ONLY a valid JSON object in this exact format, no text outside the
JSON. The "winner" MUST be the side with the higher total score:
{
  "winner": "affirmative" or "negative",
  "reasoning": "2-4 sentence explanation of why this side won overall",
  "affirmative_feedback": "2-3 sentence narrative summary for the affirmative debater",
  "negative_feedback": "2-3 sentence narrative summary for the negative debater",
  "scores": {
    "affirmative": { "argumentation": <1-10>, "evidence": <1-10>, "rebuttal": <1-10> },
    "negative": { "argumentation": <1-10>, "evidence": <1-10>, "rebuttal": <1-10> }
  },
  "points": {
    "affirmative": [ { "point": "<short summary>", "response": "refuted|partial|dropped", "note": "<how the negative handled it>" } ],
    "negative": [ { "point": "<short summary>", "response": "refuted|partial|dropped", "note": "<how the affirmative handled it>" } ]
  },
  "analysis": {
    "affirmative": { "strength": "<one strength>", "growth": "<one improvement area>", "suggestions": ["<suggestion>", "<suggestion>"] },
    "negative": { "strength": "<one strength>", "growth": "<one improvement area>", "suggestions": ["<suggestion>", "<suggestion>"] }
  }
}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from Claude' }, { status: 500 })
  }

  // Parse Claude's JSON. It's instructed to return only JSON, but if it ever
  // returns malformed output we fail gracefully instead of throwing an
  // unhandled exception (which would surface as an opaque 500).
  let verdict: {
    winner: string
    reasoning: string
    affirmative_feedback: string
    negative_feedback: string
    scores: {
      affirmative: { argumentation: number; evidence: number; rebuttal: number }
      negative: { argumentation: number; evidence: number; rebuttal: number }
    }
    points: {
      affirmative: { point: string; response: string; note: string }[]
      negative: { point: string; response: string; note: string }[]
    }
    analysis: {
      affirmative: { strength: string; growth: string; suggestions: string[] }
      negative: { strength: string; growth: string; suggestions: string[] }
    }
  }
  try {
    // Strip any markdown code fences Claude might wrap the JSON in
    const jsonText = content.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    verdict = JSON.parse(jsonText)
  } catch {
    return NextResponse.json(
      { error: 'Judge returned an invalid response. Please try again.' },
      { status: 502 }
    )
  }

  // Use a true service-role client (no user cookies) to write the judgement.
  // judgements has no INSERT policy for users, so this must run as service_role.
  const adminClient = createSupabaseAdminClient()

  // Insert the judgement. A unique constraint on judgements.debate_id guards
  // against both debaters triggering the judge at the same instant: the early
  // existence check above isn't atomic, so two requests could both reach here.
  // If the other request won the race we get a duplicate-key error (Postgres
  // code 23505) and simply return the judgement it already saved.
  const { data: inserted, error: insertError } = await adminClient
    .from('judgements')
    .insert({
      debate_id: debateId,
      winner: verdict.winner,
      reasoning: verdict.reasoning,
      affirmative_feedback: verdict.affirmative_feedback,
      negative_feedback: verdict.negative_feedback,
      aff_argumentation: verdict.scores.affirmative.argumentation,
      aff_evidence: verdict.scores.affirmative.evidence,
      aff_rebuttal: verdict.scores.affirmative.rebuttal,
      neg_argumentation: verdict.scores.negative.argumentation,
      neg_evidence: verdict.scores.negative.evidence,
      neg_rebuttal: verdict.scores.negative.rebuttal,
      aff_points: verdict.points.affirmative,
      neg_points: verdict.points.negative,
      aff_analysis: verdict.analysis.affirmative,
      neg_analysis: verdict.analysis.negative,
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      // A concurrent request already created the judgement — return that one.
      const { data: existingJudgement } = await adminClient
        .from('judgements')
        .select('*')
        .eq('debate_id', debateId)
        .single()
      if (existingJudgement) return NextResponse.json({ judgement: existingJudgement })
    }
    return NextResponse.json({ error: 'Failed to save judgement' }, { status: 500 })
  }

  // Mark the debate complete. The judgement row is the source of truth, so this
  // is best-effort and runs after the insert succeeds.
  await adminClient.from('debates').update({ status: 'complete' }).eq('id', debateId)

  return NextResponse.json({ judgement: inserted })
}
