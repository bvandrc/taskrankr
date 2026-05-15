// biome-ignore lint/style/useFilenamingConvention: is fine

import type React from 'react'
import type { EmptyObject } from 'type-fest'

import { Spinner } from '@/components/primitives/Spinner'
import { HowToUseBanner } from './appInfo/HowToUseBanner'
import { InstallBanner } from './appInfo/InstallBanner'
import { WhyDifferentBanner } from './appInfo/WhyDifferentBanner'
import { DropdownMenuHeader } from './DropdownMenuHeader'

export const TaskListPageHeader = ({
  title,
  showTitle = true,
  ColumnHeaders,
  searchVal,
  setSearchVal,
}: {
  title: React.ReactNode
  showTitle?: boolean
  ColumnHeaders: React.ReactNode
  searchVal: string
  setSearchVal: (value: string) => void
}) => (
  <div className="shrink-0 max-w-5xl w-full mx-auto px-2 sm:px-4 pt-3">
    <WhyDifferentBanner />
    <HowToUseBanner />
    <InstallBanner />

    <DropdownMenuHeader
      title={title}
      showTitle={showTitle}
      searchVal={searchVal}
      onSearchChange={setSearchVal}
    >
      {ColumnHeaders}
    </DropdownMenuHeader>
  </div>
)

export const TaskListTreeLayout = ({
  children,
}: React.PropsWithChildren<EmptyObject>) => (
  <main className="flex-1 min-h-0 overflow-y-auto pb-32">
    <div className="max-w-5xl mx-auto px-2 sm:px-4 space-y-1">{children}</div>
  </main>
)

export const TaskListPageWrapper = ({
  children,
  isLoading,
  'data-testid': testId,
}: React.PropsWithChildren<{ isLoading: boolean; 'data-testid'?: string }>) => {
  if (isLoading) return <Spinner fullScreen />

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-background text-foreground"
      data-testid={testId}
    >
      {children}
    </div>
  )
}
