import { useState } from 'react'
import type { SwitchProps } from '@radix-ui/react-switch'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Settings2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { SubtaskSortMode } from '~/shared/schema'
import { Switch } from '../../primitives/forms/Switch'
import { VisibilityToggleButton } from '../../VisibilityToggleButton'

const SortingMethodSwitch = ({
  sortMode,
  onSortModeChange,
}: {
  sortMode: SubtaskSortMode
  onSortModeChange: (mode: SubtaskSortMode) => void
}) => {
  const isManualSortMode = sortMode === SubtaskSortMode.MANUAL

  const handleSortToggle = () => {
    onSortModeChange(
      isManualSortMode ? SubtaskSortMode.INHERIT : SubtaskSortMode.MANUAL,
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-xs text-muted-foreground"
          data-testid="label-sorting-method"
        >
          Sorting Method
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="inline-flex rounded-md border border-white/10 overflow-hidden"
            role="radiogroup"
            aria-label="Subtask sort order"
            data-testid="toggle-sort-mode"
          >
            <label
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                isManualSortMode
                  ? 'bg-transparent text-muted-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
              data-testid="toggle-sort-inherit"
            >
              <input
                type="radio"
                name="subtask-sort-mode"
                value={SubtaskSortMode.INHERIT}
                checked={!isManualSortMode}
                onChange={() => isManualSortMode && handleSortToggle()}
                className="sr-only"
              />
              Inherit
            </label>
            <label
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                isManualSortMode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground',
              )}
              data-testid="toggle-sort-manual"
            >
              <input
                type="radio"
                name="subtask-sort-mode"
                value={SubtaskSortMode.MANUAL}
                checked={isManualSortMode}
                onChange={() => !isManualSortMode && handleSortToggle()}
                className="sr-only"
              />
              Manual
            </label>
          </div>
        </div>
      </div>
      <span
        className="block text-[11px] text-muted-foreground/70 leading-snug text-right"
        data-testid="text-sort-caption"
      >
        {isManualSortMode
          ? 'Drag subtasks into your preferred order using the grip handles.'
          : 'Subtasks follow the same sort order as the main task list.'}
      </span>
    </div>
  )
}

const SwitchRow = ({
  label,
  ...switchProps
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  'data-testid'?: string
} & Pick<SwitchProps, 'checked' | 'onCheckedChange'>) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: is present in the switch
  <label className="flex items-center justify-between cursor-pointer">
    <span className="text-xs text-muted-foreground">{label}</span>
    <Switch {...switchProps} />
  </label>
)

export interface SubtaskSettingsProps {
  sortMode: SubtaskSortMode
  autoHideCompleted: boolean
  inheritCompletionState: boolean
  showHidden: boolean
  hiddenCount: number
  onSortModeChange: (mode: SubtaskSortMode) => void
  onAutoHideCompletedChange: (value: boolean) => void
  onInheritCompletionStateChange: (value: boolean) => void
  onShowHiddenChange: (show: boolean) => void
}

const SubtasksSettingsMenu = ({
  sortMode,
  autoHideCompleted,
  inheritCompletionState,
  showHidden,
  hiddenCount,
  onSortModeChange,
  onAutoHideCompletedChange,
  onInheritCompletionStateChange,
  onShowHiddenChange,
}: SubtaskSettingsProps) => {
  return (
    <div className="px-3 py-2.5 space-y-3 bg-secondary/5 border-t border-white/5">
      <SortingMethodSwitch
        sortMode={sortMode}
        onSortModeChange={onSortModeChange}
      />

      <SwitchRow
        label="Auto-complete main task when all subtasks are complete"
        checked={inheritCompletionState}
        onCheckedChange={onInheritCompletionStateChange}
        data-testid="switch-inherit-completion-state"
      />

      <SwitchRow
        label="Auto-hide completed subtasks"
        checked={autoHideCompleted}
        onCheckedChange={onAutoHideCompletedChange}
        data-testid="switch-auto-hide-completed"
      />

      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <VisibilityToggleButton
            action={showHidden ? 'hide' : 'show'}
            label={`${showHidden ? 'Hide' : 'Show'} Hidden (${hiddenCount})`}
            onClick={() => onShowHiddenChange(!showHidden)}
            className="text-xs text-muted-foreground"
            data-testid="button-show-hidden"
          />
        </div>
      )}
    </div>
  )
}

export const SubtasksSettings = (props: SubtaskSettingsProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)

  const settingsMenu = <SubtasksSettingsMenu {...props} />

  return (
    <div className="border-y border-white/5">
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/10 transition-colors"
        onClick={() => setSettingsOpen(!settingsOpen)}
        data-testid="button-subtask-settings"
      >
        <span className="flex items-center gap-1.5 text-foreground">
          <Settings2 className="size-3.5" />
          Settings
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-200 rotate-360',
            settingsOpen && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {settingsMenu}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
