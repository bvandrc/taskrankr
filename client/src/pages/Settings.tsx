/**
 * @fileoverview User preferences and settings configuration page.
 */

import { useRef, useState } from 'react'
import { toMerged } from 'es-toolkit'
import { isStandalonePWA } from 'is-standalone-pwa'
import {
  ChevronRight,
  Download,
  LogOut,
  type LucideIcon,
  Trash2,
  Upload,
} from 'lucide-react'
import { Link } from 'wouter'

import { ContactCard } from '@/components/appInfo/ContactCard'
import { SortInfo } from '@/components/appInfo/SortInfo'
import { FullChangelogDialog } from '@/components/appInfo/WhatsNewDialog'
import { BackButtonHeader } from '@/components/BackButton'
import { Button } from '@/components/primitives/Button'
import { CollapsibleCard } from '@/components/primitives/CollapsibleCard'
import { Checkbox } from '@/components/primitives/forms/Checkbox'
import { Switch } from '@/components/primitives/forms/Switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/primitives/overlays/AlertDialog'
import { ScrollablePage } from '@/components/primitives/ScrollablePage'
import { useAuth } from '@/hooks/useAuth'
import { toastError, toastInfo } from '@/hooks/useToasts'
import { APP_VERSION } from '@/lib/changelog'
import { RANK_FIELDS_COLUMNS } from '@/lib/columns'
import { Routes } from '@/lib/constants'
import { tsr } from '@/lib/ts-rest'
import { cn } from '@/lib/utils'
import { useGuestMode } from '@/providers/GuestModeProvider'
import { useSettings } from '@/providers/SettingsProvider'
import { useSync } from '@/providers/SyncProvider'
import { useTaskMutations, useTasks } from '@/providers/TasksProvider'
import { AuthPaths } from '~/shared/constants'
import { contract } from '~/shared/contract'
import { type FieldConfig, type FieldFlags, TaskStatus } from '~/shared/schema'

const Card = ({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) => (
  <div
    className={cn('p-4 bg-card rounded-lg border border-white/10', className)}
  >
    {children}
  </div>
)

const UserInfoCard = () => {
  const { user } = useAuth()

  return (
    <Card className="flex items-center justify-between">
      <div>
        <p
          className="font-semibold text-foreground"
          data-testid="text-user-name"
        >
          {user?.firstName} {user?.lastName}
        </p>
        <p
          className="text-sm text-muted-foreground"
          data-testid="text-user-email"
        >
          {user?.email}
        </p>
      </div>
      <Button
        href={AuthPaths.LOGOUT}
        variant="outline"
        className="gap-2 border-muted-foreground/30 text-muted-foreground"
        data-testid="button-logout"
      >
        <LogOut className="size-4" />
        Log Out
      </Button>
    </Card>
  )
}

interface SwitchSettingProps {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  'data-testid': string
}

const SwitchSetting = ({
  title,
  description,
  checked,
  onCheckedChange,
  'data-testid': testId,
}: SwitchSettingProps) => (
  <>
    <div className="flex-1 mr-2">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      data-testid={testId}
    />
  </>
)

const SwitchCard = (props: SwitchSettingProps) => (
  <Card className="flex items-center justify-between">
    <SwitchSetting {...props} />
  </Card>
)

const AttributeCheckboxRow = ({
  name,
  label,
  visible,
  required,
  updateFieldFlags,
  className,
}: FieldFlags & {
  name: keyof FieldConfig
  label: string
  updateFieldFlags: (
    field: keyof FieldConfig,
    flags: Partial<FieldFlags>,
  ) => void
  className?: string
}) => (
  <tr className={className}>
    <td className="py-3 text-foreground">{label}</td>
    <td className="py-3 text-center">
      <Checkbox
        checked={visible}
        onCheckedChange={(checked) =>
          updateFieldFlags(name, { visible: !!checked })
        }
        data-testid={`checkbox-${name}-visible`}
      />
    </td>
    <td className="py-3 text-center">
      <Checkbox
        checked={required}
        onCheckedChange={(checked) =>
          updateFieldFlags(name, { required: !!checked })
        }
        disabled={!visible}
        className={!visible ? 'opacity-50' : ''}
        data-testid={`checkbox-${name}-required`}
      />
    </td>
  </tr>
)

const AttributeSettingsCard = ({
  fieldConfig,
  updateFieldFlags,
}: {
  fieldConfig: FieldConfig
  updateFieldFlags: (
    field: keyof FieldConfig,
    flags: Partial<FieldFlags>,
  ) => void
}) => (
  <Card className="mt-4">
    <h3 className="font-semibold text-foreground mb-4">Attribute Settings</h3>
    <p className="text-sm text-muted-foreground mb-4">
      Control which attributes appear in forms and task cards.
    </p>
    <table className="w-full" data-testid="table-attribute-settings">
      <thead>
        <tr className="border-b border-white/10">
          <th className="text-left py-2 font-medium text-sm text-muted-foreground">
            Attribute
          </th>
          <th className="text-center py-2 font-medium text-sm text-muted-foreground">
            Visible
          </th>
          <th className="text-center py-2 font-medium text-sm text-muted-foreground">
            Required
          </th>
        </tr>
      </thead>
      <tbody>
        {RANK_FIELDS_COLUMNS.map(({ name, label }) => (
          <AttributeCheckboxRow
            key={name}
            name={name}
            label={label}
            {...fieldConfig[name]}
            updateFieldFlags={updateFieldFlags}
            className="border-b border-white/5"
          />
        ))}
      </tbody>
    </table>
  </Card>
)

const ExportButton = () => {
  const { tasks } = useTasks()
  const hasNoTasks = tasks.length === 0

  return (
    <Button
      variant="outline"
      className="gap-2"
      onClick={() => {
        window.location.href = contract.tasks.export.path
      }}
      disabled={hasNoTasks}
      data-testid="button-export"
    >
      <Download className="size-4" />
      Export Tasks
    </Button>
  )
}

const ImportButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)
  const { forceSync } = useSync()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const result = await tsr.tasks.import({
        body: { tasks: data.tasks || data },
      })
      if (result.status !== 200) {
        toastError({
          title: 'Failed to import tasks',
          description: result.body.message,
        })
        return
      }

      void forceSync()
      toastInfo({ title: 'Tasks imported successfully' })
    } catch (err) {
      if (err instanceof SyntaxError || err instanceof TypeError) {
        toastError({ title: 'Failed to import tasks' })
      } else {
        throw err
      }
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        data-testid="button-import"
      >
        <Upload className="size-4" />
        {isImporting ? 'Importing...' : 'Import Tasks'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-import-file"
      />
    </>
  )
}

const ClearLocalStorageConfirmDialog = () => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 text-red-400/70 border-red-400/30"
          data-testid="button-clear-local-storage"
        >
          <Trash2 className="size-4" />
          Clear Local Storage
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Local Storage?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all locally cached data and re-pull fresh data from
            the server. Your synced data won't be affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-clear">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              localStorage.clear()
              toastInfo({ title: 'Local storage cleared' })
              window.location.reload()
            }}
            data-testid="button-confirm-clear"
          >
            Clear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const InfoCard = ({
  title,
  description,
  icon: IconComponent,
  href,
  onClick,
  'data-testid': testId,
}: {
  title: string
  description: string
  icon: LucideIcon
  href?: string
  onClick?: () => void
  'data-testid'?: string
}) => {
  const content = (
    <Card className="flex items-center justify-between hover-elevate cursor-pointer">
      <div>
        <h3 className="font-semibold text-foreground/80">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <IconComponent className="size-5 text-muted-foreground shrink-0" />
    </Card>
  )

  return href ? (
    <Link href={href} data-testid={testId}>
      {content}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      data-testid={testId}
    >
      {content}
    </button>
  )
}

const HowToUseCard = () => (
  <InfoCard
    title="How To Use"
    description="Learn how to get the most out of TaskRankr"
    icon={ChevronRight}
    href={Routes.HOW_TO_USE}
  />
)

const InstallAsAppCard = () => (
  <InfoCard
    title="Install as App"
    description="Add to your home screen for offline access"
    icon={ChevronRight}
    href={Routes.HOW_TO_INSTALL}
    data-testid="link-how-to-install"
  />
)

const ChangelogCard = () => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <InfoCard
        title="Change History"
        description="See what's been added and improved"
        icon={ChevronRight}
        onClick={() => setOpen(true)}
        data-testid="button-view-changelog"
      />
      <FullChangelogDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

const Settings = () => {
  const { tasks: allTasks } = useTasks()
  const { setTaskStatus } = useTaskMutations()
  const { settings, updateSettings } = useSettings()
  const { isGuestMode } = useGuestMode()
  const isStandalone = isStandalonePWA()

  const updateFieldFlags = (
    field: keyof FieldConfig,
    flags: Partial<FieldFlags>,
  ) =>
    updateSettings({
      fieldConfig: toMerged(settings.fieldConfig, { [field]: flags }),
    })

  return (
    <ScrollablePage>
      <BackButtonHeader title="Settings" />

      <div className="space-y-4">
        <SwitchCard
          title="Automatically Pin new tasks"
          description="When enabled, new tasks will be pinned to the top of your list automatically."
          checked={settings.autoPinNewTasks}
          onCheckedChange={(checked) =>
            updateSettings({ autoPinNewTasks: checked })
          }
          data-testid="switch-auto-pin"
        />
        <SwitchCard
          title="Always sort pinned by Priority"
          description={
            settings.alwaysSortPinnedByPriority
              ? 'Pinned tasks are always sorted by priority first, then by your selected sort.'
              : 'Pinned tasks are sorted using your selected sort only.'
          }
          checked={settings.alwaysSortPinnedByPriority}
          onCheckedChange={(checked) =>
            updateSettings({ alwaysSortPinnedByPriority: checked })
          }
          data-testid="switch-sort-pinned-priority"
        />
        <SwitchCard
          title='Enable "In Progress" Status'
          description='Allow tasks to be marked as "In Progress" to pin to the top and track active work.'
          checked={settings.enableInProgressStatus}
          onCheckedChange={(checked) => {
            updateSettings({ enableInProgressStatus: checked })
            if (!checked) {
              const inProgressTask = allTasks.find(
                (t) => t.status === TaskStatus.IN_PROGRESS,
              )
              if (inProgressTask) {
                setTaskStatus(inProgressTask.id, TaskStatus.PINNED)
              }
            }
          }}
          data-testid="switch-enable-in-progress"
        />
      </div>

      <AttributeSettingsCard
        fieldConfig={settings.fieldConfig}
        updateFieldFlags={updateFieldFlags}
      />

      <div className="my-6">
        <SortInfo />
      </div>

      <div className="flex flex-col gap-3 py-2">
        <HowToUseCard />
        {!isStandalone && <InstallAsAppCard />}
        <ChangelogCard />
        {!isGuestMode && <UserInfoCard />}
        <ContactCard showDebugDownload />
      </div>

      <div className="pt-6 space-y-3">
        <CollapsibleCard
          title="Import/Export Data"
          className="bg-card/50"
          data-testid="collapsible-import-export"
        >
          <div className="flex flex-wrap justify-center gap-3">
            <ExportButton />
            <ImportButton />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Export your tasks as JSON or import from a previously exported file.
          </p>
        </CollapsibleCard>

        <CollapsibleCard
          title="Clear Local Data"
          className="bg-card/50"
          data-testid="collapsible-clear-local-data"
        >
          <p className="text-sm text-muted-foreground mb-3">
            Remove all locally cached data and re-pull fresh data from the
            server. Your synced data on the server won't be affected.
          </p>
          <ClearLocalStorageConfirmDialog />
        </CollapsibleCard>
      </div>

      <div className="mt-16 text-center text-muted-foreground">
        <p className="text-sm font-medium" data-testid="text-app-name">
          TaskRankr
        </p>
        <p className="text-xs mt-1" data-testid="text-app-description">
          Track tasks with priority, ease, enjoyment, and time ratings.
        </p>
        <p className="text-xs mt-1" data-testid="text-app-version">
          v{APP_VERSION}
        </p>
      </div>
    </ScrollablePage>
  )
}

export default Settings
