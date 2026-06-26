/**
 * @fileoverview Sign-in / sign-up dialog with Google, Microsoft, and email/password flows.
 */

import { useState } from 'react'
import type { AuthProvider } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  type OAuthCredential,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { Mail } from 'lucide-react'
import { Link } from 'wouter'

import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/forms/Input'
import { Label } from '@/components/primitives/forms/Label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/overlays/Dialog'
import { firebaseAuth } from '@/lib/auth-client'
import { Routes } from '@/lib/constants'

const SocialButton = ({
  icon,
  label,
  onClick,
  variant = 'secondary',
  'data-testid': testId,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'secondary' | 'outline'
  'data-testid': string
}) => (
  <Button
    variant={variant}
    className="w-full justify-start gap-3 h-10"
    onClick={onClick}
    data-testid={testId}
  >
    <span className="size-5 shrink-0 flex items-center justify-center">
      {icon}
    </span>
    <span className="flex-1 text-left">{label}</span>
  </Button>
)

const ErrorText = ({ error }: { error: string }) => (
  <p className="text-sm text-danger brightness-200">{error}</p>
)

enum View {
  Choose = 'choose',
  EmailSignIn = 'email-signin',
  EmailSignUp = 'email-signup',
}

const ChooseView = ({
  onSuccess,
  onSetView,
}: {
  onSuccess: () => void
  onSetView: (view: View) => void
}) => {
  const [error, setError] = useState<string | null>(null)
  const [pendingLink, setPendingLink] = useState<OAuthCredential | null>(null)

  const signInWith = async (provider: AuthProvider) => {
    try {
      const result = await signInWithPopup(firebaseAuth, provider)
      if (pendingLink) await linkWithCredential(result.user, pendingLink)
      onSuccess()
    } catch (e: unknown) {
      const err = e as {
        code?: string
        credential?: OAuthCredential
        customData?: { email?: string }
      }
      if (err?.code === 'auth/account-exists-with-different-credential') {
        setPendingLink(err.credential ?? null)
        const email = err.customData?.email
        setError(
          `An account already exists with${email ? ` email ${email}` : ' this email'}. Sign in with your original method to link accounts.`,
        )
      } else {
        setError(e instanceof Error ? e.message : 'Sign in failed')
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <SocialButton
        icon={
          <img
            src="https://cdn.brandfetch.io/id6O2oGzv-/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1755835725776"
            alt=""
          />
        }
        label="Continue with Google"
        data-testid="button-signin-google"
        onClick={() => signInWith(new GoogleAuthProvider())}
      />
      <SocialButton
        icon={
          <img
            src="https://cdn.brandfetch.io/idchmboHEZ/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1727706673120"
            alt=""
          />
        }
        label="Continue with Microsoft"
        data-testid="button-signin-microsoft"
        onClick={() => signInWith(new OAuthProvider('microsoft.com'))}
      />
      <SocialButton
        icon={
          <img
            src="https://cdn.brandfetch.io/idZAyF9rlg/theme/dark/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1779162684348"
            alt=""
            className="invert" // change from black to white
          />
        }
        label="Continue with GitHub"
        data-testid="button-signin-github"
        onClick={() => signInWith(new GithubAuthProvider())}
      />
      {error && <ErrorText error={error} />}
      <p className="text-center text-xs text-muted-foreground mt-1">
        By signing in you agree to our{' '}
        <Link
          href={Routes.PRIVACY_POLICY}
          className="underline hover:text-foreground"
        >
          Privacy Policy
        </Link>
        .
      </p>
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <SocialButton
        icon={<Mail />}
        label="Continue with Email"
        data-testid="button-signin-email"
        onClick={() => onSetView(View.EmailSignIn)}
        variant="outline"
      />
    </div>
  )
}

const EmailView = ({
  mode,
  onModeChange,
  onBack,
  onSuccess,
}: {
  mode: View.EmailSignIn | View.EmailSignUp
  onModeChange: (mode: View.EmailSignIn | View.EmailSignUp) => void
  onBack: () => void
  onSuccess: () => void
}) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === View.EmailSignUp

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(firebaseAuth, email, password)
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password)
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setError(null)
    onModeChange(isSignUp ? View.EmailSignIn : View.EmailSignUp)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          data-testid="input-email"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          data-testid="input-password"
          required
        />
      </div>
      {error && <ErrorText error={error} />}
      <Button
        type="submit"
        disabled={loading}
        className="mt-1"
        data-testid="button-submit"
      >
        {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? 'Have an account?' : 'No account?'}{' '}
        <button
          type="button"
          className="underline hover:text-foreground"
          onClick={switchMode}
          data-testid="button-switch-mode"
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </button>
      </p>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground mx-auto"
        onClick={onBack}
        data-testid="button-back"
      >
        ← Other sign-in options
      </button>
      <p className="text-center text-xs text-muted-foreground mt-1">
        Passwords secured by Firebase
      </p>
    </form>
  )
}

export const SignInDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const [mode, setMode] = useState<View>(View.Choose)

  const close = () => {
    onOpenChange(false)
    setMode(View.Choose)
  }

  const isChooseView = !(mode === View.EmailSignIn || mode === View.EmailSignUp)

  return (
    <Dialog open={open} onOpenChange={(val) => !val && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {mode === View.EmailSignUp
              ? 'Create account'
              : 'Sign in to TaskRankr'}
          </DialogTitle>
        </DialogHeader>

        {isChooseView ? (
          <ChooseView onSuccess={close} onSetView={setMode} />
        ) : (
          <EmailView
            mode={mode}
            onModeChange={setMode}
            onBack={() => setMode(View.Choose)}
            onSuccess={close}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
