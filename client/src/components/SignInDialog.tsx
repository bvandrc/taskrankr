/**
 * @fileoverview Sign-in / sign-up dialog with Google and email/password flows.
 */
// TODO: can we use a package for this whole dialog?

import { useState } from 'react'
import type { AuthProvider } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { Mail } from 'lucide-react'

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

// TODO: get from a package
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden={true}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

const SocialButton = ({
  icon,
  label,
  onClick,
  variant = 'secondary',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'secondary' | 'outline'
}) => (
  <Button
    variant={variant}
    className="w-full justify-start gap-3 h-10"
    onClick={onClick}
  >
    {icon}
    <span className="flex-1 text-left">{label}</span>
  </Button>
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

  const signInWith = async (provider: AuthProvider) => {
    try {
      await signInWithPopup(firebaseAuth, provider)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <SocialButton
        icon={<GoogleIcon />}
        label="Continue with Google"
        onClick={() =>
          // onSetView(View.Choose) // no onSetView because separate provider dialog opens
          signInWith(new GoogleAuthProvider())
        }
      />
      {/* TODO: facebook, apple */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <SocialButton
        icon={<Mail className="size-5 shrink-0" />}
        label="Continue with Email"
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
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading} className="mt-1">
        {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? 'Have an account?' : 'No account?'}{' '}
        <button
          type="button"
          className="underline hover:text-foreground"
          onClick={switchMode}
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </button>
      </p>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground mx-auto"
        onClick={onBack}
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
