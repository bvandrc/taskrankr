/**
 * @fileoverview Instructional page explaining how to use the app
 */

import { isStandalonePWA } from 'is-standalone-pwa'
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Download,
  EyeOff,
  GripVertical,
  Hand,
  Layers,
  Link2,
  MousePointer2,
  Pin,
  PlayCircle,
  Settings,
} from 'lucide-react'
import { Link } from 'wouter'

import { ContactCard } from '@/components/appInfo/ContactCard'
import { SortInfo } from '@/components/appInfo/SortInfo'
import { BackButtonHeader } from '@/components/BackButton'
import { CardSection } from '@/components/primitives/CardSection'
import { IconCard } from '@/components/primitives/IconCard'
import {
  InlineEmphasized as Em,
  InlineLink,
} from '@/components/primitives/InlineText'
import { ScrollablePage } from '@/components/primitives/ScrollablePage'
import { Routes } from '@/lib/constants'

const HowToUse = () => {
  const isStandalone = isStandalonePWA()

  return (
    <ScrollablePage className="pb-16">
      <BackButtonHeader title="How To Use" />

      <div className="space-y-6">
        <CardSection
          title="Working with Tasks"
          data-testid="section-working-with-tasks"
        >
          <IconCard
            icon={<MousePointer2 className="size-5" />}
            title="Tap to Edit"
            description={
              <>
                <p className="mb-2">
                  Tap a task to edit it, where you can change the name,
                  description, and rank fields like priority, ease, enjoyment,
                  and time, as well as create nested subtasks to assist with
                  breaking down projects.
                </p>
                <p>
                  You can customize which rank fields are visible in{' '}
                  <InlineLink href={Routes.SETTINGS}>Settings</InlineLink>.
                </p>
              </>
            }
            data-testid="card-tap-to-edit"
          />
          <IconCard
            icon={<Hand className="size-5" />}
            title="Hold to Change Status"
            description={
              <>
                Press and hold a task to open the <Em>Status Menu</Em>. From
                there you can mark it as <Em>Pinned</Em>, <Em>In Progress</Em>{' '}
                (if setting enabled), <Em>Completed</Em>, or delete it.
              </>
            }
            data-testid="card-hold-to-change-status"
          />
        </CardSection>

        <CardSection title="Sorting Tasks" data-testid="section-sorting">
          <IconCard
            icon={<ArrowUpDown className="size-5" />}
            title="Sort Options"
            description={
              <>
                <div className="mb-4">
                  Use the <Em>sort buttons</Em> at the top of the task list to
                  order tasks by priority, ease, enjoyment, or time.
                </div>
                <SortInfo defaultExpanded={false} />
              </>
            }
            data-testid="card-sorting"
          />
        </CardSection>

        <CardSection title="Task Statuses" data-testid="section-ta">
          <IconCard
            icon={<Pin className="size-5" />}
            title="Pinned"
            description={
              <>
                <Em>Pin</Em> important tasks to keep them at the top of your
                list.
              </>
            }
            data-testid="card-pinned"
          />
          <IconCard
            icon={<PlayCircle className="size-5" />}
            title="In Progress (if setting enabled)"
            description={
              <>
                <Em>In Progress</Em> pins to the top of your list.
              </>
            }
            data-testid="card-in-progress"
          />
          <IconCard
            icon={<CheckCircle2 className="size-5" />}
            title="Completed"
            description={
              <>
                <Em>Completed</Em> top-level tasks are moved to a separate list
                you can access from the menu. Completed <i>subtasks</i> are
                shown as crossed out (or hidden, if configured).
              </>
            }
            data-testid="card-completed"
          />
        </CardSection>

        <CardSection title="Subtasks" data-testid="section-subtasks">
          <IconCard
            icon={<Layers className="size-5" />}
            title="Nested Tasks"
            description={
              <>
                Break down large tasks into subtasks by tapping a task and using
                the <Em>Add Subtask</Em> button. Subtasks can have their own
                subtasks, etc, creating a hierarchical structure for complex
                projects.
              </>
            }
            data-testid="card-nested-tasks"
          />
          <IconCard
            icon={<GripVertical className="size-5" />}
            title="Manual Ordering (Optional)"
            description={
              <>
                By default, subtasks follow the same sort order as the main
                list. Toggle <Em>Manual Mode</Em> in a task's subtasks panel to
                drag and reorder subtasks in a custom sequence, perfect for
                step-by-step workflows.
              </>
            }
            data-testid="card-manual-ordering"
          />
          <IconCard
            icon={<EyeOff className="size-5" />}
            title="Auto-Hide on Complete (Optional)"
            description={
              <>
                Enable <Em>Auto-Hide Completed</Em> in a task's subtask settings
                to automatically hide subtasks when they are marked as
                completed, keeping your list focused on what still needs to be
                done.
              </>
            }
            data-testid="card-auto-hide-completed"
          />
          <IconCard
            icon={<Link2 className="size-5" />}
            title="Auto-Complete Parent"
            description={
              <>
                Enable <Em>Inherit Completion State</Em> in a task's subtask
                settings to automatically mark the parent task as completed when
                all of its subtasks are completed. If a subtask is later added
                or reopened, the parent will revert back to open as well.
              </>
            }
            data-testid="card-auto-complete-parent"
          />
        </CardSection>

        <CardSection title="Additional" data-testid="section-additional">
          <Link href={Routes.SETTINGS} data-testid="link-settings">
            <IconCard
              className="hover-elevate cursor-pointer"
              icon={<Settings className="size-5" />}
              title="Customize Your Experience"
              titleRightIcon={
                <ChevronRight className="size-4 text-muted-foreground" />
              }
              description={
                <>
                  Configure which rank fields are visible or required, toggle
                  features like <Em>Auto-Pin New Tasks</Em>,{' '}
                  <Em>In Progress</Em> status, and more in the{' '}
                  <InlineLink href={Routes.SETTINGS}>Settings</InlineLink>.
                </>
              }
              data-testid="card-settings"
            />
          </Link>
          {!isStandalone && (
            <Link
              href={Routes.HOW_TO_INSTALL}
              data-testid="link-how-to-install"
            >
              <IconCard
                className="hover-elevate cursor-pointer"
                icon={<Download className="size-5" />}
                title="Install as App"
                titleRightIcon={
                  <ChevronRight className="size-4 text-muted-foreground" />
                }
                description={
                  <Em>
                    Add TaskRankr to your home screen for offline access and a
                    full-screen experience.
                  </Em>
                }
                data-testid="card-how-to-install"
              />
            </Link>
          )}
          <ContactCard />
        </CardSection>
      </div>
    </ScrollablePage>
  )
}

export default HowToUse
