'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Side } from '@/lib/supabase'

export type FeedItem = {
  id: string
  href: string          // destination when the row is clicked (differs by format)
  title: string
  topic: string
  formatLabel: string
  status: string
  side?: Side
  score: number | null
  won?: boolean
  hosted?: boolean
}

type Filter = 'all' | 'active' | 'decided'

export default function DebateFeed({ feed }: { feed: FeedItem[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const active = feed.filter((f) => f.status !== 'complete')
  const decided = feed.filter((f) => f.status === 'complete')
  const visible = filter === 'active' ? active : filter === 'decided' ? decided : feed

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: 'var(--font-bebas)', fontSize: '1.5rem', letterSpacing: '.02em' }}>ALL DEBATES</h2>
        <div className="flex gap-1.5 text-xs">
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>All {feed.length}</Pill>
          <Pill active={filter === 'active'} onClick={() => setFilter('active')}>Active {active.length}</Pill>
          <Pill active={filter === 'decided'} onClick={() => setFilter('decided')}>Decided {decided.length}</Pill>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((f) => <FeedRow key={f.id} item={f} decided={f.status === 'complete'} />)}
        </div>
      )}
    </>
  )
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 cursor-pointer"
      style={active
        ? { background: '#f4f4f5', color: '#0c0c0f' }
        : { background: '#18181b', border: '1px solid rgba(255,255,255,.1)', color: '#a1a1aa' }}
    >
      {children}
    </button>
  )
}

function FeedRow({ item, decided }: { item: FeedItem; decided?: boolean }) {
  const accent = decided
    ? (item.won === false ? '#e11d48' : '#22c55e')
    : (item.status === 'waiting' ? '#eab308' : '#3b82f6')

  return (
    <Link
      href={item.href}
      className="flex items-center gap-4 rounded-xl px-4 py-3.5"
      style={{ background: decided ? '#141417' : '#18181b', border: `1px solid rgba(255,255,255,${decided ? '.06' : '.08'})`, color: 'inherit', textDecoration: 'none' }}
    >
      <div className="self-stretch rounded" style={{ width: 4, background: accent }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="uppercase" style={{ color: '#71717a', fontSize: '.68rem', letterSpacing: '.1em' }}>{item.topic}</span>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '.58rem', letterSpacing: '.08em', color: '#a1a1aa', background: '#27272a', padding: '2px 6px', borderRadius: 4 }}>{item.formatLabel}</span>
        </div>
        <div className="font-semibold truncate" style={{ fontSize: '.98rem' }}>{item.title}</div>
      </div>

      {decided ? (
        <div className="flex items-center gap-3 shrink-0">
          <span style={{ color: '#52525b', fontFamily: 'var(--font-bebas)', fontSize: '1.15rem' }}>{item.score == null ? '—' : item.score.toFixed(1)}</span>
          {item.hosted ? (
            <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '.92rem', letterSpacing: '.12em', color: '#a1a1aa' }}>HOSTED</span>
          ) : (
            <span style={{ fontFamily: 'var(--font-bebas)', fontSize: '.92rem', letterSpacing: '.12em', color: item.won ? '#22c55e' : '#e11d48' }}>{item.won ? 'WON' : 'LOST'}</span>
          )}
        </div>
      ) : (
        <div className="text-right shrink-0">
          {item.side && <div style={{ fontSize: '.78rem', color: item.side === 'negative' ? '#60a5fa' : '#fb7185' }}>{item.side === 'negative' ? 'Negative' : 'Affirmative'}</div>}
          <div style={{ fontSize: '.74rem', color: '#71717a' }}>{item.status === 'waiting' ? 'waiting for opponent' : 'in progress'}</div>
        </div>
      )}
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16" style={{ color: '#71717a' }}>
      <p className="font-medium mb-2" style={{ color: '#a1a1aa' }}>No debates yet</p>
      <p className="text-sm mb-6">Start your first debate — your judge scores show up here.</p>
      <Link
        href="/debate/new"
        className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5"
        style={{ fontFamily: 'var(--font-bebas)', background: '#f4f4f5', color: '#0c0c0f', fontSize: '1.05rem', letterSpacing: '.12em' }}
      >
        <span className="text-lg leading-none">+</span> START A DEBATE
      </Link>
    </div>
  )
}
