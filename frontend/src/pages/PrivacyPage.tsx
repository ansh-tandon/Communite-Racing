import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GOOGLE_SIGN_IN } from '../components/GoogleButton';

// Where players write to about their data. Must be a mailbox someone reads.
const CONTACT = 'hello@communitieracing.in';
const UPDATED = '19 October 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl font-bold uppercase tracking-[0.01em] text-white">{title}</h2>
      {children}
    </section>
  );
}

/** Public, plain-language privacy policy. Linked from the login page and Google's consent screen. */
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg text-white/80">
      <div className="mx-auto max-w-2xl px-5 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 sm:pt-8">
        <header className="flex items-center justify-between gap-4">
          <img src="/cr-logo-white.png" alt="Communitie Racing" width={733} height={224} className="h-9 w-auto sm:h-10" />
          <Link to="/login" className="flex min-h-[44px] items-center gap-1.5 text-sm text-white/65 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden />Back
          </Link>
        </header>

        <main className="mt-10 space-y-10 text-base leading-relaxed">
          <div>
            <h1 className="font-display text-[min(44px,11.5vw)] font-black uppercase leading-[0.92] text-white sm:text-6xl">Privacy</h1>
            <p className="mt-4 text-sm text-white/55">Last updated {UPDATED}</p>
            <p className="mt-5">
              The Communitie Racing Quiz League is a free prediction game for our community. This page explains
              what we keep about you, why, and how to have it removed.
            </p>
          </div>

          <Section title="What we keep">
            <ul className="list-disc space-y-2 pl-5 marker:text-white/40">
              <li><span className="font-semibold text-white">Your email address</span>, to sign you in.</li>
              <li><span className="font-semibold text-white">Your racing name</span>, which other players see on the leaderboards.</li>
              {GOOGLE_SIGN_IN && (
                <li>
                  <span className="font-semibold text-white">If you continue with Google</span>: your Google account ID and
                  email address. We don't get your password, contacts or anything else from your Google account.
                </li>
              )}
              <li><span className="font-semibold text-white">Your quiz answers, points and badges</span>, to score each race and run the championship.</li>
            </ul>
          </Section>

          <Section title="What other players see">
            <p>Your racing name, points, positions and badges. Never your email address.</p>
          </Section>

          <Section title="Who else is involved">
            <p>We don't sell your data or use it for advertising. A few services help run the game:</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-white/40">
              {GOOGLE_SIGN_IN && <li><span className="font-semibold text-white">Google</span>, if you choose to continue with Google.</li>}
              <li><span className="font-semibold text-white">Resend</span> sends the 6-digit login codes to your email.</li>
              <li><span className="font-semibold text-white">Render</span> hosts the app and its database.</li>
              <li>The login page loads its background video from GIPHY and its fonts from Google Fonts.</li>
            </ul>
          </Section>

          <Section title="In your browser">
            <p>
              We keep your login in your browser's local storage so you stay signed in, for up to 7 days at a time.
              There are no advertising or tracking cookies.
            </p>
          </Section>

          <Section title="Deleting your account">
            <p>
              Email <a href={`mailto:${CONTACT}`} className="font-semibold text-white underline underline-offset-4">{CONTACT}</a> from
              the address you play with, and we'll delete your account, answers and scores. You can change your racing name any
              time in Profile.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              Write to <a href={`mailto:${CONTACT}`} className="font-semibold text-white underline underline-offset-4">{CONTACT}</a>.
              If this policy changes, we'll update the date at the top.
            </p>
          </Section>
        </main>
      </div>
    </div>
  );
}
