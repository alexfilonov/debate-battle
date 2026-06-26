import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Static resolutions per topic area — avoids a Claude call on every page load.
// Swap back to dynamic generation when ready to re-enable.
const STATIC_RESOLUTIONS: Record<string, string[]> = {
  'U.S. Politics': [
    'The Electoral College should be abolished in favor of a national popular vote.',
    'Term limits should be imposed on all members of the U.S. Congress.',
    'The U.S. Supreme Court should be expanded to 13 justices.',
    'Social media companies should be held legally liable for political misinformation on their platforms.',
    'The United States should adopt a federal ranked-choice voting system.',
  ],
  'International Politics': [
    'NATO membership should be extended to Ukraine.',
    'The United Nations Security Council veto power should be abolished.',
    'Economic sanctions are an effective tool of modern foreign policy.',
    'The United States should significantly reduce its military presence in the Middle East.',
    'China poses a greater long-term threat to global stability than Russia.',
  ],
  'Economics': [
    'The federal minimum wage should be raised to $20 per hour.',
    'Universal Basic Income would do more harm than good to the U.S. economy.',
    'Billionaires should face a minimum effective tax rate of 50%.',
    'Free trade agreements benefit American workers more than they hurt them.',
    'The U.S. national debt is a crisis that requires immediate spending cuts.',
  ],
  'Technology': [
    'Frontier AI development should be subject to a mandatory international moratorium until safety standards are established.',
    'Social media platforms should be regulated as public utilities.',
    'End-to-end encryption should be preserved even if it impedes criminal investigations.',
    'Tech companies have too much influence over democratic elections.',
    'The long-term risks of artificial general intelligence outweigh its potential benefits.',
  ],
  'Science': [
    'Nuclear energy should be central to the global clean energy transition.',
    'Gene editing of human embryos should be permitted for therapeutic purposes.',
    'Geoengineering research should be actively funded as a response to climate change.',
    'The U.S. government should mandate vaccines for all school-age children.',
    'Animal testing for medical research is ethically justifiable given its benefits to human health.',
  ],
  'Philosophy': [
    'Free will is an illusion incompatible with modern neuroscience.',
    'Moral relativism is a more defensible position than moral absolutism.',
    'The ends justify the means in cases of extreme necessity.',
    'It is unethical to have children in an era of climate crisis and political instability.',
    'Consciousness can never be meaningfully replicated by artificial intelligence.',
  ],
  'Sports': [
    'Performance-enhancing drugs should be permitted in professional sports.',
    'College athletes should receive a salary from their universities.',
    'Esports deserve full recognition alongside traditional athletic competitions.',
    'The NFL is morally responsible for the long-term health consequences suffered by its players.',
    'The Olympic Games do more harm than good to the cities that host them.',
  ],
  'Culture': [
    'Cancel culture does more harm than good to public discourse.',
    'Streaming services are destroying the traditional film industry.',
    'Standardized testing should be permanently abolished from college admissions.',
    'Violent video games contribute to real-world aggression in young people.',
    'Artistic works should be judged independently of their creators\' personal conduct.',
  ],
}

// POST /api/resolutions
// Accepts a topic area and returns 5 static debate resolutions.
// Only accessible to logged-in users.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topicArea } = await request.json()
  if (!topicArea) return NextResponse.json({ error: 'Missing topicArea' }, { status: 400 })

  const resolutions = STATIC_RESOLUTIONS[topicArea]
  if (!resolutions) return NextResponse.json({ error: 'Unknown topic area' }, { status: 400 })

  return NextResponse.json({ resolutions })
}
