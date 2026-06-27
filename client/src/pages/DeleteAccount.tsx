import { useState } from 'react'
import { useLocation } from 'wouter'

import { BackButtonHeader } from '@/components/BackButton'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/forms/Input'
import { Label } from '@/components/primitives/forms/Label'
import { ScrollablePage } from '@/components/primitives/ScrollablePage'
import { useAuth } from '@/hooks/useAuth'
import { firebaseAuth } from '@/lib/auth-client'
import { tsr } from '@/lib/ts-rest'

const CONFIRM_PHRASE = 'delete my account'

const DeleteAccount = () => {
  const { logout } = useAuth()
  const [, setLocation] = useLocation()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmed = input.toLowerCase() === CONFIRM_PHRASE

  const handleDelete = async () => {
    if (!confirmed) return
    setLoading(true)
    setError(null)
    try {
      const result = await tsr.account.delete()
      if (result.status !== 204) {
        setError('Something went wrong. Please try again.')
        return
      }
      await firebaseAuth.currentUser?.delete()
      await logout()
      setLocation('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollablePage className="pb-16">
      <BackButtonHeader title="Delete Account" />
      <div className="flex flex-col gap-6 max-w-prose mx-auto px-4 pt-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-destructive">
            This action is permanent and cannot be undone.
          </h2>
          <p className="text-sm text-muted-foreground">
            Deleting your account will permanently remove all of your tasks,
            settings, and account data. You will be signed out immediately.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-input">
            Type{' '}
            <span className="font-mono text-foreground">{CONFIRM_PHRASE}</span>{' '}
            to confirm
          </Label>
          <Input
            id="confirm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button
          variant="danger"
          disabled={!confirmed || loading}
          onClick={handleDelete}
        >
          {loading ? 'Deleting…' : 'Delete My Account'}
        </Button>
      </div>
    </ScrollablePage>
  )
}

export default DeleteAccount
