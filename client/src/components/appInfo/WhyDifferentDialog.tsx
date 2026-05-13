import { CheckCircle, ListTodo, Star } from 'lucide-react'
import { useLocation } from 'wouter'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/overlays/Dialog'
import { Routes } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { InlineLink } from '../primitives/InlineText'

const TEXT_SECTION_STYLE = 'text-emerald-300'
const TEXT_PARAGRAPH_LEAD_STYLE = cn(TEXT_SECTION_STYLE, 'font-medium')

export const WhyDifferentDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const [, setLocation] = useLocation()

  const goToSettings = (e: React.MouseEvent) => {
    e.preventDefault()
    onOpenChange(false)
    setLocation(Routes.SETTINGS)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        data-testid="dialog-why-different"
      >
        <DialogHeader>
          <DialogTitle
            data-testid="text-why-different-title"
            className={TEXT_SECTION_STYLE}
          >
            Why TaskRankr?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground/90 text-left">
          <p>
            Hi, Blake here. I have tried over 30 to-do list apps, and couldn't
            find a single one that helped me organize my tasks and projects the
            way I wanted, and so I made TaskRankr. It has helped me, and I
            believe it can help you too!
          </p>

          <h3 className={cn(TEXT_SECTION_STYLE, 'font-semibold pt-1')}>
            What sets TaskRankr apart:
          </h3>

          <ul className="space-y-4 list-none">
            <li className="flex gap-2">
              <Star className="size-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <span className={TEXT_PARAGRAPH_LEAD_STYLE}>
                  More priority levels.
                </span>{' '}
                Other apps let you sort by priority, but only have 3 levels.
                TaskRankr gives you 5, so you can be more specific about what
                matters most.
              </div>
            </li>

            <li className="flex gap-2">
              <CheckCircle className="size-4 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <span className={TEXT_PARAGRAPH_LEAD_STYLE}>
                  Sort by ease, enjoyment, and time.
                </span>{' '}
                At different times of life, or the week, or the day, there is
                more to consider than just importance. TaskRankr gives you the
                option to sort by <strong>Ease, Enjoyment, or Time</strong>:
                <ul className="my-1.5 space-y-1.5 ml-1">
                  <li className="flex gap-2">
                    <span className="text-emerald-500 shrink-0">•</span>
                    <span>
                      <strong>Ease or Enjoyment</strong> — You've been working
                      on high-priority tasks all day. Now it's evening and you
                      want to stay productive but enjoy yourself (e.g. hobbies
                      or side projects) — sort by <strong>Enjoyment</strong> for
                      something fun, or <strong>Ease</strong> to knock out
                      something easy.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500 shrink-0">•</span>
                    <span>
                      <strong>Time</strong> — You have a few minutes; sort by{' '}
                      <strong>Time</strong> to make the most of it.
                    </span>
                  </li>
                </ul>
                You can hide any of these in your{' '}
                <InlineLink onClick={goToSettings}>settings</InlineLink> to suit
                your needs.
              </div>
            </li>

            <li className="flex gap-2">
              <ListTodo className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <span className={TEXT_PARAGRAPH_LEAD_STYLE}>
                  Jot down ideas without clutter.
                </span>{' '}
                More-specific sorting means you can freely jot down random ideas
                or projects — as "low importance" as they are — without the
                worry of burying what actually matters.
              </div>
            </li>

            <li className="flex gap-2">
              <ListTodo className="size-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <span className={TEXT_PARAGRAPH_LEAD_STYLE}>
                  The best subtask system out there.
                </span>{' '}
                Create subtasks, subtasks of subtasks, and so on. Subtasks get
                crossed out as you complete them. Within each level, you can
                manually sort them (i.e. a step-by-step process), or, leave
                un-ordered, where subtasks will inherit the overall sort order
                of your view (highest priority/greatest ease/etc.). Other
                features such as "auto-complete when all subtasks complete" let
                <em>you</em> decide and configure how you want a task's workflow
                to be.
              </div>
            </li>
          </ul>

          <div className="border-t border-border pt-4 space-y-3">
            <p>
              I encourage you to give it a shot. I built this to help me, and if
              you're someone who can use some organization of their tasks, I
              think it can help you too. Check out{' '}
              <InlineLink onClick={goToSettings}>Settings</InlineLink> to see
              what you can customize.
            </p>
            <p className="text-muted-foreground text-center">
              If you find any bugs or have feature suggestions, please email me
              at{' '}
              <InlineLink href="mailto:taskrankr@gmail.com">
                taskrankr@gmail.com
              </InlineLink>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
