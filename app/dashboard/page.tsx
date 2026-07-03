import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Debate, DebateParticipant, Judgement, LiveResult, Side } from '@/lib/supabase'
import SignOutButton from '@/components/SignOutButton'
import DebateFeed from '@/components/DebateFeed'

// ============================================================================
// Dashboard — "Command center" (score-based)
// Server Component: all data is fetched on the server before render.
//
// Replaces the old win/loss record with the AI-judge POINT SYSTEM:
//   • headline = your average judge score (/10) across judged debates
//   • per-criterion averages + average score by side
//   • each decided debate shows YOUR score in that debate, not a head-to-head tally
//
// Scoring data sources (see docs/schema.sql):
//   • two_phone → judgements.{aff,neg}_{argumentation,evidence,rebuttal} (1–10)
//     The user's side comes from debate_participants.side, so we know which
//     half of the judgement is theirs. These power the personal averages.
//   • one_phone → live_results.verdict (pro/con rubric, 1–10 ×5). One-phone has
//     NO participant rows — just a logged-in *holder* plus two anonymous diarized
//     voices — so a score can't be attributed to "you". One-phone debates are
//     therefore shown in the feed as *hosted* results but EXCLUDED from your
//     personal averages. (To include them, decide a rule for which voice is the
//     account holder and fold it into accumulateTwoPhone-style logic below.)
// ============================================================================

// ---- score helpers ---------------------------------------------------------

// Average a list of maybe-null 1–10 scores; returns null if none are present.
function avg(nums: Array<number | null | undefined>): number | null {
  const vals = nums.filter((n): n is number => typeof n === 'number')
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// The three two-phone criteria for a given side, pulled off a judgement row.
function twoPhoneCriteria(j: Judgement, side: Side) {
  const p = side === 'affirmative' ? 'aff' : 'neg'
  return {
    argument: j[`${p}_argumentation` as const] as number | null,
    evidence: j[`${p}_evidence` as const] as number | null,
    rebuttal: j[`${p}_rebuttal` as const] as number | null,
  }
}

// One-phone: overall score (mean of the 5 rubric criteria) for the winning side.
function onePhoneWinnerScore(r: LiveResult): number | null {
  const v = r.verdict
  if (!v || !r.winner) return null
  const s = r.winner === 'pro' ? v.pro?.scores : v.con?.scores
  if (!s) return null
  return avg([s.argument, s.evidence, s.responsiveness, s.consistency, s.persuasiveness])
}

const fmt = (n: number | null) => (n == null ? '—' : n.toFixed(1))

// ---- page ------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 1) Debates this user takes part in (creator is always a participant).
  const { data: participantRows } = await supabase
    .from('debate_participants')
    .select('debate_id, side, user_id')

  const myParticipations = (participantRows ?? []).filter((r) => r.user_id === user.id)
  const debateIds = myParticipations.map((r) => r.debate_id)
  // debate_id -> the user's side (two-phone only)
  const mySide = new Map<string, Side>(myParticipations.map((r) => [r.debate_id, r.side as Side]))

  const orFilter =
    debateIds.length > 0
      ? `created_by.eq.${user.id},id.in.(${debateIds.join(',')})`
      : `created_by.eq.${user.id}`

  const { data: debates } = await supabase
    .from('debates')
    .select('*')
    .or(orFilter)
    .order('created_at', { ascending: false })

  const allDebates = (debates ?? []) as Debate[]
  const allIds = allDebates.map((d) => d.id)

  // 2) Verdicts for those debates (RLS already limits this to the user's debates).
  const { data: judgementRows } = allIds.length
    ? await supabase.from('judgements').select('*').in('debate_id', allIds)
    : { data: [] as Judgement[] }
  const { data: liveRows } = allIds.length
    ? await supabase.from('live_results').select('*').in('debate_id', allIds)
    : { data: [] as LiveResult[] }

  const judgements = new Map<string, Judgement>((judgementRows ?? []).map((j) => [j.debate_id, j]))
  const liveResults = new Map<string, LiveResult>((liveRows ?? []).map((r) => [r.debate_id, r]))

  // 3) Roll up the personal point-system stats from TWO-PHONE judged debates.
  const overallScores: number[] = []
  const critArgument: Array<number | null> = []
  const critEvidence: Array<number | null> = []
  const critRebuttal: Array<number | null> = []
  const affScores: number[] = []
  const negScores: number[] = []

  for (const d of allDebates) {
    if (d.format !== 'two_phone') continue
    const j = judgements.get(d.id)
    const side = mySide.get(d.id)
    if (!j || !side) continue
    const c = twoPhoneCriteria(j, side)
    const overall = avg([c.argument, c.evidence, c.rebuttal])
    if (overall == null) continue
    overallScores.push(overall)
    critArgument.push(c.argument)
    critEvidence.push(c.evidence)
    critRebuttal.push(c.rebuttal)
    ;(side === 'affirmative' ? affScores : negScores).push(overall)
  }

  const avgScore = avg(overallScores)            // headline /10
  const judgedCount = overallScores.length
  const activeCount = allDebates.filter((d) => d.status !== 'complete').length
  const criteria = [
    { label: 'Argument', value: avg(critArgument) },
    { label: 'Evidence', value: avg(critEvidence) },
    { label: 'Rebuttal', value: avg(critRebuttal) },
  ]
  const affAvg = avg(affScores)
  const negAvg = avg(negScores)

  // 4) Build the feed view-model (newest first; allDebates is already sorted).
  type FeedItem = {
    id: string
    href: string              // where the row links — /judge for one-phone, room for two-phone
    title: string
    topic: string
    formatLabel: string
    status: Debate['status']
    side?: Side
    score: number | null      // your score (two-phone) or winning score (one-phone)
    won?: boolean             // two-phone: did your side win
    hosted?: boolean          // one-phone: shown as a hosted result
  }

  const feed: FeedItem[] = allDebates.map((d) => {
    const base = {
      id: d.id,
      status: d.status,
      formatLabel: d.format === 'one_phone' ? '1-PHONE' : '2-PHONE',
    }
    if (d.format === 'one_phone') {
      const r = liveResults.get(d.id)
      return {
        ...base,
        // One-phone verdict lives at /judge — link there directly so users
        // can revisit the verdict after leaving, unlike the two-phone room.
        href: `/debate/${d.id}/judge`,
        title: r?.inferred_topic || d.resolution || 'In-person debate',
        topic: 'In person',
        score: r ? onePhoneWinnerScore(r) : null,
        hosted: true,
      }
    }
    const j = judgements.get(d.id)
    const side = mySide.get(d.id)
    const c = j && side ? twoPhoneCriteria(j, side) : null
    return {
      ...base,
      href: `/debate/${d.id}`,
      title: d.resolution || 'Untitled debate',
      topic: d.topic_area || '—',
      side,
      score: c ? avg([c.argument, c.evidence, c.rebuttal]) : null,
      won: j && side ? j.winner === side : undefined,
    }
  })

  const active = feed.filter((f) => f.status !== 'complete')

  // The "Your move" hero features the most recent active debate.
  // NOTE: true turn detection ("they recorded, waiting on you") needs the
  //       speeches rows — wire that in to gate this precisely.
  const yourMove = active[0]

  const bebas = { fontFamily: 'var(--font-bebas)' } as const
  const amber = '#d97706'

  return (
    <div className="min-h-screen" style={{ background: '#0c0c0f', color: '#f4f4f5' }}>
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <nav
        className="flex items-center justify-between px-5 sm:px-8 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}
      >
        <div className="flex items-center gap-7">
          <span style={{ ...bebas, fontSize: '1.6rem', letterSpacing: '.03em', lineHeight: 1 }}>
            debatable<span style={{ color: amber }}>.</span>
          </span>
          <div className="hidden sm:flex gap-5 text-sm">
            <span style={{ borderBottom: `2px solid ${amber}`, paddingBottom: 3 }}>Debates</span>
            <span style={{ color: '#71717a' }}>Stats</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/debate/new"
            className="flex items-center gap-2 rounded-[10px] px-4 py-2"
            style={{ ...bebas, background: '#f4f4f5', color: '#0c0c0f', fontSize: '1.05rem', letterSpacing: '.12em' }}
          >
            <span className="text-lg leading-none">+</span> NEW DEBATE
          </Link>
          <span className="hidden sm:inline text-sm" style={{ color: '#71717a' }}>{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      {/* ── Body: rail (sidebar on lg / summary card on mobile) + feed ──── */}
      <div className="lg:grid lg:max-w-6xl lg:mx-auto" style={{ gridTemplateColumns: '300px 1fr' }}>

        {/* DESKTOP RAIL ------------------------------------------------------ */}
        <aside
          className="hidden lg:flex flex-col gap-7 px-6 py-8"
          style={{ borderRight: '1px solid rgba(255,255,255,.08)' }}
        >
          <ScoreHeadline avgScore={avgScore} judgedCount={judgedCount} />
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat value={String(judgedCount)} label="judged" />
            <MiniStat value={String(activeCount)} label="active now" />
          </div>
          <RailSection title="Avg by criterion">
            <div className="flex flex-col gap-3">
              {criteria.map((c) => (
                <CriterionBar key={c.label} label={c.label} value={c.value} />
              ))}
            </div>
          </RailSection>
          <RailSection title="Avg score by side">
            <div className="flex gap-2.5">
              <SidePill label="Affirmative" value={affAvg} color="#fb7185" bg="rgba(225,29,72,.1)" border="rgba(225,29,72,.25)" />
              <SidePill label="Negative" value={negAvg} color="#60a5fa" bg="rgba(37,99,235,.1)" border="rgba(37,99,235,.25)" />
            </div>
          </RailSection>
        </aside>

        {/* MAIN -------------------------------------------------------------- */}
        <main className="px-5 sm:px-8 py-7 max-w-3xl w-full mx-auto lg:mx-0">

          {/* MOBILE SUMMARY CARD (score rail collapsed) */}
          <div
            className="lg:hidden rounded-2xl p-4 mb-3.5"
            style={{ background: '#18181b', border: '1px solid rgba(255,255,255,.08)' }}
          >
            <div className="flex items-end justify-between">
              <div>
                <div className="uppercase mb-1.5" style={{ color: '#71717a', fontSize: '.6rem', letterSpacing: '.14em' }}>Avg judge score</div>
                <div className="flex items-baseline gap-1" style={{ ...bebas, lineHeight: .8 }}>
                  <span style={{ fontSize: '2.8rem', color: amber }}>{fmt(avgScore)}</span>
                  <span style={{ fontSize: '1.1rem', color: '#71717a' }}>/10</span>
                </div>
                <div className="mt-1" style={{ color: '#71717a', fontSize: '.62rem' }}>across {judgedCount} judged debates</div>
              </div>
              <MiniStat value={String(activeCount)} label="active" tight />
            </div>
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5 mt-4">
              {criteria.map((c) => (
                <CriterionBar key={c.label} label={c.label} value={c.value} small />
              ))}
            </div>
          </div>

          {/* YOUR MOVE hero */}
          {yourMove && (
            <Link
              href={`/debate/${yourMove.id}`}
              className="block rounded-2xl p-5 sm:p-6 mb-7"
              style={{
                background: 'linear-gradient(180deg,rgba(217,119,6,.16),rgba(217,119,6,.05))',
                border: '1px solid rgba(217,119,6,.4)',
              }}
            >
              <div className="flex items-center justify-between gap-5">
                <div>
                  <div className="mb-2" style={{ ...bebas, fontSize: '1.05rem', letterSpacing: '.14em', color: amber }}>YOUR MOVE</div>
                  <div className="font-semibold leading-tight" style={{ fontSize: '1.15rem' }}>{yourMove.title}</div>
                  <div className="mt-2" style={{ color: '#a1a1aa', fontSize: '.84rem' }}>
                    {yourMove.topic}
                    {yourMove.side ? <> · you&apos;re <span style={{ color: yourMove.side === 'negative' ? '#60a5fa' : '#fb7185' }}>{yourMove.side === 'negative' ? 'Negative' : 'Affirmative'}</span></> : null}
                  </div>
                </div>
                <div className="rounded-[10px] px-4 py-2.5 whitespace-nowrap" style={{ ...bebas, background: amber, color: '#0c0c0f', fontSize: '1.05rem', letterSpacing: '.1em' }}>OPEN →</div>
              </div>
            </Link>
          )}

          {/* ALL DEBATES */}
          <DebateFeed feed={feed} />
        </main>
      </div>
    </div>
  )
}

// ---- presentational bits ---------------------------------------------------

function ScoreHeadline({ avgScore, judgedCount }: { avgScore: number | null; judgedCount: number }) {
  return (
    <div>
      <div className="uppercase mb-2.5" style={{ color: '#71717a', fontSize: '.68rem', letterSpacing: '.14em' }}>Avg judge score</div>
      <div className="flex items-baseline gap-1.5" style={{ fontFamily: 'var(--font-bebas)', lineHeight: .8 }}>
        <span style={{ fontSize: '4.2rem', color: '#d97706' }}>{avgScore == null ? '—' : avgScore.toFixed(1)}</span>
        <span style={{ fontSize: '1.6rem', color: '#71717a' }}>/10</span>
      </div>
      <div className="rounded-md overflow-hidden mt-3.5" style={{ height: 8, background: '#27272a' }}>
        <div style={{ width: `${((avgScore ?? 0) / 10) * 100}%`, height: '100%', background: '#d97706' }} />
      </div>
      <div className="mt-2" style={{ color: '#71717a', fontSize: '.74rem' }}>across {judgedCount} judged debates</div>
    </div>
  )
}

function MiniStat({ value, label, tight }: { value: string; label: string; tight?: boolean }) {
  return (
    <div className="rounded-[10px]" style={{ background: tight ? '#0c0c0f' : '#18181b', border: '1px solid rgba(255,255,255,.08)', padding: tight ? '7px 11px' : '13px 14px', textAlign: tight ? 'center' : 'left' }}>
      <div style={{ fontFamily: 'var(--font-bebas)', fontSize: tight ? '1.2rem' : '1.7rem', lineHeight: 1 }}>{value}</div>
      <div className="mt-1" style={{ color: '#71717a', fontSize: tight ? '.58rem' : '.7rem' }}>{label}</div>
    </div>
  )
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="uppercase mb-3.5" style={{ color: '#71717a', fontSize: '.68rem', letterSpacing: '.14em' }}>{title}</div>
      {children}
    </div>
  )
}

function CriterionBar({ label, value, small }: { label: string; value: number | null; small?: boolean }) {
  return (
    <div>
      <div className="flex justify-between mb-1" style={{ fontSize: small ? '.66rem' : '.78rem' }}>
        <span style={{ color: small ? '#a1a1aa' : undefined }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-bebas)', fontSize: small ? '.9rem' : '.95rem' }}>{value == null ? '—' : value.toFixed(1)}</span>
      </div>
      <div className="rounded overflow-hidden" style={{ height: small ? 5 : 6, background: '#27272a' }}>
        <div style={{ width: `${((value ?? 0) / 10) * 100}%`, height: '100%', background: '#d97706' }} />
      </div>
    </div>
  )
}

function SidePill({ label, value, color, bg, border }: { label: string; value: number | null; color: string; bg: string; border: string }) {
  return (
    <div className="flex-1 rounded-[9px]" style={{ background: bg, border: `1px solid ${border}`, padding: '11px 12px' }}>
      <div style={{ fontSize: '.7rem', color }}>{label}</div>
      <div className="mt-1" style={{ fontFamily: 'var(--font-bebas)', fontSize: '1.4rem', lineHeight: 1 }}>
        {value == null ? '—' : value.toFixed(1)}<span style={{ fontSize: '.75rem', color: '#71717a' }}>/10</span>
      </div>
    </div>
  )
}

