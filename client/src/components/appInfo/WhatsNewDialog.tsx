import { useEffect, useState } from 'react'
import { Sparkles as ChangelogIcon } from 'lucide-react'

export { ChangelogIcon }

import { Button } from '@/components/primitives/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/overlays/Dialog'
import {
  APP_VERSION,
  type ChangelogEntry,
  changelog,
  getLastSeenVersion,
  getUnseenEntries,
  setLastSeenVersion,
} from '@/lib/changelog'
import { STANDARD_DATE_FORMAT } from '@/lib/constants'

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-US', STANDARD_DATE_FORMAT)
}

const ChangelogEntryList = ({ entries }: { entries: ChangelogEntry[] }) => (
  <div className="space-y-6 py-2">
    {entries.map((entry) => (
      <div key={entry.version}>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-sm font-semibold text-foreground">
            v{entry.version}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(entry.date)}
          </span>
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1.5">
          {entry.title}
        </h3>
        <ul className="space-y-1">
          {entry.changes.map((change) => (
            <li
              key={`changelog-${entry.version}`}
              className="text-sm text-muted-foreground flex gap-2"
            >
              <span className="text-primary mt-0.5 shrink-0">•</span>
              {change}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)

const ChangelogDialog = ({
  open,
  onOpenChange,
  title,
  entries,
  buttonText,
  buttonVariant = 'default',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  entries: ChangelogEntry[]
  buttonText: string
  buttonVariant?: 'default' | 'outline'
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className="max-w-md max-h-[80vh] overflow-y-auto"
      data-testid="dialog-changelog"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ChangelogIcon className="size-5 text-primary" />
          {title}
        </DialogTitle>
      </DialogHeader>

      <ChangelogEntryList entries={entries} />

      <DialogFooter>
        <Button
          onClick={() => onOpenChange(false)}
          variant={buttonVariant}
          className="w-full"
          data-testid="button-changelog-dismiss"
        >
          {buttonText}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const WhatsNewDialog = () => {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ChangelogEntry[]>([])

  useEffect(() => {
    if (getLastSeenVersion() !== APP_VERSION) {
      const unseen = getUnseenEntries()
      if (unseen.length > 0) {
        setEntries(unseen)
        setOpen(true)
      } else {
        setLastSeenVersion(APP_VERSION)
      }
    }
  }, [])

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setLastSeenVersion(APP_VERSION)
      setOpen(false)
    }
  }

  if (entries.length === 0) return null

  return (
    <ChangelogDialog
      open={open}
      onOpenChange={handleClose}
      title="What's New"
      entries={entries}
      buttonText="Got it"
    />
  )
}

export const FullChangelogDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => (
  <ChangelogDialog
    open={open}
    onOpenChange={onOpenChange}
    title="Changelog"
    entries={changelog}
    buttonText="Close"
    buttonVariant="outline"
  />
)
