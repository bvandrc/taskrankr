/**
 * @fileoverview Unauthenticated landing page for TaskRankr.
 * Provides login/signup call-to-action for new users.
 */

import { useState } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { isStandalonePWA } from 'is-standalone-pwa'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle,
  Clock,
  Download,
  Info,
  ListTodo,
  Star,
  WifiOff,
} from 'lucide-react'

import { WhyDifferentDialog } from '@/components/appInfo/WhyDifferentDialog'
import { Button, type buttonVariants } from '@/components/primitives/Button'
import { InlineLink } from '@/components/primitives/InlineText'
import { SignInDialog } from '@/components/SignInDialog'
import { Routes } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useGuestMode } from '@/providers/GuestModeProvider'

const CaptionedIcon = ({
  icon: Icon,
  color,
  label,
}: {
  icon: LucideIcon
  color: string
  label: string
}) => (
  <div className="flex flex-col items-center gap-2">
    <Icon className={cn('size-6', color)} />
    <span className="text-sm">{label}</span>
  </div>
)

type LandingButtonProps = React.PropsWithChildren<{
  href?: string
  onClick?: () => void
  variant?: VariantProps<typeof buttonVariants>['variant']
  className?: string
  'data-testid'?: string
}>

const LandingButton = ({
  children,
  href,
  onClick,
  variant = 'default',
  className,
  'data-testid': testId,
}: LandingButtonProps) => (
  <Button
    size="lg"
    variant={variant}
    href={href}
    className={cn('text-lg px-8 w-55 max-w-55', className)}
    data-testid={testId}
    onClick={onClick}
  >
    {children}
  </Button>
)

const LandingButtonWithCaption = ({
  caption,
  ...props
}: LandingButtonProps & { caption: string }) => (
  <div className="flex flex-col items-center w-55">
    <LandingButton {...props} />
    <p className="text-xs text-muted-foreground mt-1.5 text-center">
      {caption}
    </p>
  </div>
)

const Landing = () => {
  const { enterGuestMode } = useGuestMode()
  const isStandalone = isStandalonePWA()
  const [showWhyDialog, setShowWhyDialog] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  return (
    <div className="max-h-screen bg-background text-foreground flex flex-col">
      <header className="p-6">
        <h1 className="text-xl font-bold" data-testid="text-logo">
          TaskRankr
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold leading-tight pb-2">
          Prioritize your tasks.
        </h2>
        <p className="text-lg text-muted-foreground pb-4">
          Rate and sort by priority, ease, enjoyment, and time for each task.
        </p>

        <div className="flex flex-col items-center gap-3 pt-2 pb-6 text-sm text-muted-foreground">
          <div className="flex justify-center gap-6">
            <CaptionedIcon
              icon={Star}
              color="text-yellow-500"
              label="Priority levels"
            />
            <CaptionedIcon
              icon={CheckCircle}
              color="text-emerald-500"
              label="Ease levels"
            />
            <CaptionedIcon
              icon={Clock}
              color="text-blue-500"
              label="Time tracking"
            />
          </div>
          <div className="flex justify-center gap-6">
            <CaptionedIcon
              icon={ListTodo}
              color="text-amber-500"
              label="Nested tasks"
            />
            <CaptionedIcon
              icon={WifiOff}
              color="text-violet-600"
              label="Works offline"
            />
          </div>
        </div>

        <InlineLink
          onClick={() => setShowWhyDialog(true)}
          className="mb-6 text-sm"
          data-testid="button-why-different"
        >
          <Info className="size-4 inline -translate-y-px mr-1" />
          What makes this app different, and how it can help you.
        </InlineLink>

        <div className="flex flex-col items-center sm:flex-row sm:items-start sm:gap-4 gap-2 justify-center">
          <LandingButtonWithCaption
            onClick={() => setShowSignIn(true)}
            caption="To back up your data and sync across devices"
            data-testid="button-get-started"
          >
            Log In / Sign Up
          </LandingButtonWithCaption>
          <LandingButtonWithCaption
            caption="No signup required"
            variant="outline"
            onClick={() => enterGuestMode()}
            data-testid="button-try-guest"
          >
            Try as Guest
          </LandingButtonWithCaption>
        </div>

        {!isStandalone && (
          <div className="mt-auto py-[8vh] flex justify-center">
            <LandingButton
              href={Routes.HOW_TO_INSTALL}
              className="gap-2 bg-accent text-accent-foreground border border-accent-border"
              data-testid="button-how-to-install"
            >
              <Download className="size-5" />
              Install as App
            </LandingButton>
          </div>
        )}
      </main>

      <WhyDifferentDialog
        open={showWhyDialog}
        onOpenChange={setShowWhyDialog}
      />
      <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
    </div>
  )
}

export default Landing
