import nodemailer from 'nodemailer'

// Email is sent through a Gmail account using an "app password" (no domain
// needed — ideal for a small private app). Set these in .env.local and Vercel:
//   GMAIL_USER          the Gmail address that sends the mail
//   GMAIL_APP_PASSWORD  a 16-char app password (Google account > Security)
// SERVER ONLY — never expose the app password to the browser.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// Public base URL used to build links in emails. Falls back to the production
// domain if the env var isn't set.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://debate-battle-five.vercel.app'

// Notify a debater that it's their turn because their opponent just submitted.
// Returns nothing; callers should treat failures as non-fatal.
export async function sendYourTurnEmail(to: string, debateId: string, resolution: string) {
  const link = `${APP_URL}/debate/${debateId}`

  await transporter.sendMail({
    from: `"Debate Battle" <${process.env.GMAIL_USER}>`,
    to,
    subject: "It's your turn — Debate Battle",
    text:
      `Your opponent just submitted their speech.\n\n` +
      `Resolution: ${resolution}\n\n` +
      `It's your turn — open the debate to respond:\n${link}\n`,
    html:
      `<p>Your opponent just submitted their speech.</p>` +
      `<p><strong>Resolution:</strong> ${resolution}</p>` +
      `<p>It's your turn — <a href="${link}">open the debate to respond</a>.</p>`,
  })
}
