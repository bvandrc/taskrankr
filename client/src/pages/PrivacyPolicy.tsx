import { BackButtonHeader } from '@/components/BackButton'
import { ScrollablePage } from '@/components/primitives/ScrollablePage'

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-base font-semibold">{title}</h2>
    <div className="text-sm text-muted-foreground flex flex-col gap-2">
      {children}
    </div>
  </section>
)

const PrivacyPolicy = () => (
  <ScrollablePage className="pb-16">
    <BackButtonHeader title="Privacy Policy" />
    <div className="flex flex-col gap-6 max-w-prose mx-auto px-4 pt-4">
      <p className="text-xs text-muted-foreground">
        Last updated: June 26, 2026
      </p>

      <Section title="Overview">
        <p>
          TaskRankr ("we", "us", or "our") is a personal task management app.
          This policy explains what information we collect, how we use it, and
          your rights regarding your data.
        </p>
      </Section>

      <Section title="Information We Collect">
        <p>
          <strong>Account information:</strong> When you sign in with Google,
          Microsoft, GitHub, or email, we receive your name, email address, and
          a unique identifier from that provider. We do not receive or store
          your social-provider passwords.
        </p>
        <p>
          <strong>Task data:</strong> Tasks, subtasks, and settings you create
          are stored in our database and associated with your account.
        </p>
        <p>
          <strong>Usage data:</strong> We do not use analytics tracking or
          advertising cookies.
        </p>
      </Section>

      <Section title="How We Use Your Information">
        <ul className="list-disc list-inside flex flex-col gap-1">
          <li>To authenticate you and maintain your session.</li>
          <li>To store and sync your tasks across devices.</li>
        </ul>
        <p>We do not sell or share your personal data with third parties.</p>
      </Section>

      <Section title="Third-Party Authentication">
        <p>
          Sign-in is powered by{' '}
          <a
            href="https://firebase.google.com/support/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Firebase Authentication (Google)
          </a>
          . When you choose a social login, you are subject to that provider's
          privacy policy in addition to ours.
        </p>
      </Section>

      <Section title="Data Retention">
        <p>
          Your data is retained as long as your account exists. You may delete
          your account at any time by contacting us, which will permanently
          remove your tasks and account information.
        </p>
      </Section>

      <Section title="Security">
        <p>
          All data is transmitted over HTTPS. Passwords (for email sign-in) are
          managed and hashed by Firebase and are never stored by us in plain
          text.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions or requests regarding your data? Email us at{' '}
          <a
            href="mailto:support@taskrankr.com"
            className="underline hover:text-foreground"
          >
            support@taskrankr.com
          </a>
          .
        </p>
      </Section>
    </div>
  </ScrollablePage>
)

export default PrivacyPolicy
