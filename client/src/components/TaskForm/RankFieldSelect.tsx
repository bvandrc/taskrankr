/**
 * @fileoverview Select component for a single rank field in the task form
 */

import type { RankFieldValueMap } from '@/lib/constants'
import { getRankFieldStyle } from '@/lib/rank-field-styles'
import { cn } from '@/lib/utils'
import type { RankField } from '~/shared/schema'
import { FormControl, FormItem, FormLabel } from '../primitives/forms/Form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/forms/Select'

interface RankFieldSelectProps {
  name: RankField
  label: string
  field: {
    value: RankFieldValueMap[RankField] | null | undefined
    onChange: (value: RankFieldValueMap[RankField] | null) => void
  }
  isRequired: boolean
  levels: string[]
}

export const RankFieldSelect = ({
  name,
  label,
  levels,
  field,
  isRequired,
}: RankFieldSelectProps) => {
  const hasError = isRequired && !field.value
  const showNoneOption = !isRequired
  const NONE_VALUE = 'none'

  return (
    <FormItem>
      <FormLabel
        className="text-[10px] uppercase tracking-wider text-muted-foreground"
        isRequired={isRequired}
      >
        {label}
      </FormLabel>
      <Select
        onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
        value={field.value ?? NONE_VALUE}
      >
        <FormControl>
          <SelectTrigger
            data-testid={`rank-select-${name}`}
            className={cn(
              'bg-secondary/20 capitalize font-semibold h-10',
              hasError ? 'border-destructive/50' : 'border-white/5',
              getRankFieldStyle(name, field.value, 'text-muted-foreground'),
            )}
          >
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
        </FormControl>
        <SelectContent className="bg-card border-white/10 z-[200]">
          {showNoneOption && (
            <SelectItem
              value={NONE_VALUE}
              className="text-muted-foreground italic"
            >
              None
            </SelectItem>
          )}
          {levels.map((level) => (
            <SelectItem
              key={level}
              value={level}
              className={cn(
                'capitalize font-semibold',
                getRankFieldStyle(
                  name,
                  level satisfies string as RankFieldValueMap[typeof name],
                ),
              )}
            >
              {level}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasError && (
        <p className="text-[10px] text-destructive mt-1">Required</p>
      )}
    </FormItem>
  )
}
