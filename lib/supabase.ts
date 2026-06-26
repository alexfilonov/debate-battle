import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Single shared Supabase client instance for the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// TypeScript types matching our database schema
export type DebateStatus = 'waiting' | 'in_progress' | 'complete'
export type Side = 'affirmative' | 'negative'
// 'two_phone' = original async structured flow; 'one_phone' = in-person live mode
export type DebateFormat = 'two_phone' | 'one_phone'

export type Debate = {
  id: string
  format: DebateFormat
  topic_area: string
  resolution: string
  status: DebateStatus
  created_by: string
  created_at: string
}

// ── One-phone (in-person) live debate mode ──────────────────────────────────

// A diarized utterance. AssemblyAI labels each distinct voice 'A' or 'B'.
export type LiveSegment = { speaker: string; text: string }

// Per-criterion 1-10 scores. Length-neutral: talking more must NOT raise these.
export type LiveScores = {
  argument: number
  evidence: number
  responsiveness: number
  consistency: number
  persuasiveness: number
}

// One side's result. `speaker` is which diarized voice (A/B) Claude assigned here.
// best_criterion / worst_criterion are optional so old stored verdicts still render.
export type LiveSideVerdict = {
  speaker: string
  scores: LiveScores
  best_criterion?: keyof LiveScores
  worst_criterion?: keyof LiveScores
  feedback: string
}

// The full structured verdict Claude returns for a one-phone debate.
export type LiveVerdict = {
  topic: string            // the topic Claude inferred they were arguing about
  winner: 'pro' | 'con'
  summary: string          // overall reasoning for the verdict
  pro: LiveSideVerdict
  con: LiveSideVerdict
}

// Row in the live_results table — one per one-phone debate.
export type LiveResult = {
  debate_id: string
  transcript: LiveSegment[]
  inferred_topic: string | null
  winner: 'pro' | 'con' | null
  verdict: LiveVerdict | null
  created_at: string
}

export type DebateParticipant = {
  id: string
  debate_id: string
  user_id: string
  side: Side
}

export type Speech = {
  id: string
  debate_id: string
  user_id: string
  round: number
  audio_url: string | null
  transcript: string | null
  created_at: string
}

// How well the opposing side answered a given argument.
export type ClashResponse = 'refuted' | 'partial' | 'dropped'

// One argument a debater made, plus how their opponent handled it.
export type ClashPoint = {
  point: string          // short summary of the argument
  response: ClashResponse // how the OPPONENT responded to it
  note: string           // one line on how it was (or wasn't) addressed
}

// Actionable per-debater analysis that powers the feedback dashboard.
export type SideAnalysis = {
  strength: string        // one headline strength
  growth: string          // one biggest area to improve
  suggestions: string[]   // concrete ways to strengthen the case
}

export type Judgement = {
  id: string
  debate_id: string
  winner: Side
  reasoning: string
  affirmative_feedback: string
  negative_feedback: string
  // Per-category 1-10 scores set by the AI judge. Nullable because judgements
  // created before scores existed don't have them.
  aff_argumentation: number | null
  aff_evidence: number | null
  aff_rebuttal: number | null
  neg_argumentation: number | null
  neg_evidence: number | null
  neg_rebuttal: number | null
  // Structured analysis for the dashboard. Nullable for older judgements.
  // *_points are the arguments THAT side made (response = how the opponent answered).
  aff_points: ClashPoint[] | null
  neg_points: ClashPoint[] | null
  aff_analysis: SideAnalysis | null
  neg_analysis: SideAnalysis | null
  created_at: string
}
