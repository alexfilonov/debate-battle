'use client'

import { useRef, useLayoutEffect, useState } from 'react'
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
} from 'motion/react'

// Measures the rendered width of a DOM element, updating on resize.
// Used to calculate how far to shift the marquee before wrapping.
function useElementWidth(ref: React.RefObject<HTMLSpanElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    function update() {
      if (ref.current) setWidth(ref.current.offsetWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [ref])
  return width
}

interface VelocityRowProps {
  children: React.ReactNode
  baseVelocity: number
  damping?: number
  stiffness?: number
  numCopies?: number
}

// Single infinitely scrolling row. Direction is determined by the sign of baseVelocity:
// positive = left-to-right scroll, negative = right-to-left.
// Speeding up the page scroll temporarily boosts/reverses the animation speed.
function VelocityRow({
  children,
  baseVelocity,
  damping = 80,
  stiffness = 400,
  numCopies = 5,
}: VelocityRowProps) {
  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const scrollVelocity = useVelocity(scrollY)
  const smoothVelocity = useSpring(scrollVelocity, { damping, stiffness })
  // Maps scroll speed (px/s) to a velocity multiplier
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false })

  const copyRef = useRef<HTMLSpanElement>(null)
  const copyWidth = useElementWidth(copyRef)

  // Wraps a value into the [min, max) range so the marquee loops seamlessly
  function wrap(min: number, max: number, v: number) {
    const range = max - min
    return (((v - min) % range) + range) % range + min
  }

  const x = useTransform(baseX, v => {
    if (copyWidth === 0) return '0px'
    return `${wrap(-copyWidth, 0, v)}px`
  })

  const directionFactor = useRef(baseVelocity > 0 ? 1 : -1)
  useAnimationFrame((_, delta) => {
    let moveBy = directionFactor.current * Math.abs(baseVelocity) * (delta / 1000)
    if (velocityFactor.get() < 0) directionFactor.current = -1
    else if (velocityFactor.get() > 0) directionFactor.current = 1
    moveBy += directionFactor.current * moveBy * velocityFactor.get()
    baseX.set(baseX.get() + moveBy)
  })

  return (
    <div style={{ overflow: 'hidden', width: '100%' }}>
      <motion.div style={{ x, display: 'flex', whiteSpace: 'nowrap' }}>
        {Array.from({ length: numCopies }).map((_, i) => (
          <span key={i} ref={i === 0 ? copyRef : null} style={{ flexShrink: 0 }}>
            {children}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

interface ScrollVelocityProps {
  text: string
  // positive = scrolls right, negative = scrolls left
  velocity?: number
  damping?: number
  style?: React.CSSProperties
  textStyle?: React.CSSProperties
}

export default function ScrollVelocity({
  text,
  velocity = 60,
  damping = 80,
  style,
  textStyle,
}: ScrollVelocityProps) {
  return (
    <div style={{ overflow: 'hidden', ...style }}>
      <VelocityRow baseVelocity={velocity} damping={damping}>
        <span style={textStyle}>{text}&nbsp;&nbsp;·&nbsp;&nbsp;</span>
      </VelocityRow>
    </div>
  )
}
