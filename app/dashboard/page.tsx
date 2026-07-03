import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Debate } from '@/lib/supabase'
import SignOutButton from '@/components/SignOutButton'

// Dashboard is a Server Component — it fetches data on the server before rendering.
// This means the user's debates are already loaded when the page appears (no loading flash).
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // Get the currently logged-in user
  const { data: { user } } = await supabase.auth.getUser()

  // If somehow not logged in, send back to home
  if (!user) redirect('/')

  // Step 1: find every debate this user takes part in.
  // PostgREST's `id.in.(...)` only accepts a literal list of values, not a SQL
  // sub-select, so we first fetch the user's participant rows to get the IDs.
  // (The creator is always inserted as a participant when a debate is created,
  // so this also covers debates this user started.)
  const { data: participantRows } = await supabase
    .from('debate_participants')
    .select('debate_id')
    .eq('user_id', user.id)

  const debateIds = participantRows?.map((row) => row.debate_id) ?? []

  // Step 2: fetch those debates. Build an `or` filter so we still catch debates
  // the user created even if their participant row somehow failed to insert.
  // `created_by.eq` always applies; the `id.in.(...)` clause is only added when
  // we actually have IDs (an empty `in.()` list is invalid syntax).
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
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Top navigation bar */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: 'var(--font-bebas)', fontSize: '1.6rem', letterSpacing: '0.03em' }}>
          debatable<span style={{ color: '#e11d48' }}>.</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">

        {/* Header + new debate button */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your Debates</h2>
          <Link
            href="/debate/new"
            className="bg-white text-gray-900 font-semibold px-5 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            + New Debate
          </Link>
        </div>

        {/* Debate list */}
        {!debates || debates.length === 0 ? (
          // Empty state — shown when user has no debates yet
          <div className="text-center py-20 text-gray-500">
            <div className="text-4xl mb-4">⚔️</div>
            <p className="text-lg font-medium text-gray-400 mb-2">No debates yet</p>
            <p className="text-sm mb-6">Start your first debate and challenge a friend.</p>
            <Link
              href="/debate/new"
              className="bg-white text-gray-900 font-semibold px-5 py-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Start a Debate
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {debates.map((debate: Debate) => (
              <Link
                key={debate.id}
                href={`/debate/${debate.id}`}
                className="bg-gray-900 rounded-xl p-5 hover:bg-gray-800 transition-colors border border-gray-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {/* Topic area badge */}
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {debate.topic_area}
                    </span>
                    {/* Resolution — the actual debate statement */}
                    <p className="text-white font-medium mt-1">{debate.resolution}</p>
                  </div>
                  {/* Status badge — shows where the debate is in the flow */}
                  <StatusBadge status={debate.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Small badge component to show debate status with color coding
function StatusBadge({ status }: { status: string }) {
  const styles = {
    waiting: 'bg-yellow-900/40 text-yellow-400 border-yellow-800',
    in_progress: 'bg-blue-900/40 text-blue-400 border-blue-800',
    complete: 'bg-green-900/40 text-green-400 border-green-800',
  }[status] ?? 'bg-gray-800 text-gray-400 border-gray-700'

  const labels = {
    waiting: 'Waiting for opponent',
    in_progress: 'In progress',
    complete: 'Complete',
  }[status] ?? status

  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-lg border whitespace-nowrap ${styles}`}>
      {labels}
    </span>
  )
}
