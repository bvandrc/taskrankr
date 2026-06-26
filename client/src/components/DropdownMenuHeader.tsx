/**
 * @fileoverview Page header with hamburger dropdown menu and collapsible search.
 * Accepts `children` rendered to the right of the menu trigger, and an
 * optional search bar that slides in below the header row.
 */

import { useState } from 'react'
import {
  CheckCircle2,
  HelpCircle,
  Home,
  LogIn,
  LogOut,
  Menu,
  Paperclip,
  Search,
  Settings,
} from 'lucide-react'
import { useLocation } from 'wouter'

import { SignInDialog } from '@/components/SignInDialog'
import { Routes } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useGuestMode } from '@/providers/GuestModeProvider'
import { Button } from './primitives/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './primitives/DropdownMenu'
import { SearchInput } from './SearchInput'

const Title = ({
  title,
  showTitle,
  className,
}: {
  title: React.ReactNode
  showTitle?: boolean
  className?: string
}) =>
  title && (
    <h1
      className={
        showTitle
          ? cn('text-2xl font-bold tracking-tight', className)
          : 'sr-only'
      }
    >
      {title}
    </h1>
  )

type DropdownMenuHeaderProps = React.PropsWithChildren<{
  title?: React.ReactNode
  showTitle?: boolean
  searchVal: string
  onSearchChange: (value: string) => void
}>

export const DropdownMenuHeader = ({
  title,
  showTitle = true,
  searchVal,
  onSearchChange,
  children,
}: DropdownMenuHeaderProps) => {
  const { isGuestMode, exitGuestMode } = useGuestMode()
  const [showSignIn, setShowSignIn] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [location] = useLocation()
  const isHome = location === Routes.HOME

  const toggleSearch = () => {
    setIsSearchExpanded((prev) => {
      if (prev) onSearchChange('')
      return !prev
    })
  }

  return (
    <>
      <Title
        title={title}
        showTitle={showTitle}
        className="mb-2 px-2 sm:hidden"
      />
      <div className="flex items-center gap-1 mb-2 pr-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              data-testid="button-menu"
            >
              <Menu className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-card border-white/10 w-48"
          >
            <DropdownMenuItem
              icon={Search}
              label="Search"
              onClick={toggleSearch}
              data-testid="menu-item-search"
            />
            {isHome ? (
              <DropdownMenuItem
                icon={CheckCircle2}
                label="Completed Tasks"
                href={Routes.COMPLETED}
                data-testid="menu-item-completed"
              />
            ) : (
              <DropdownMenuItem
                icon={Home}
                label="Home (Open Tasks)"
                href={Routes.HOME}
                data-testid="menu-item-home"
              />
            )}
            {!isGuestMode && (
              <DropdownMenuItem
                icon={Paperclip}
                label="File Attachments"
                href={Routes.FILE_ATTACHMENTS}
                data-testid="menu-item-file-attachments"
              />
            )}
            <DropdownMenuItem
              icon={Settings}
              label="Settings"
              href={Routes.SETTINGS}
              data-testid="menu-item-settings"
            />
            <DropdownMenuItem
              icon={HelpCircle}
              label="How To Use"
              href={Routes.HOW_TO_USE}
              data-testid="menu-item-how-to-use"
            />
            {isGuestMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon={LogIn}
                  label="Sign Up"
                  data-testid="menu-item-signup"
                  onClick={() => setShowSignIn(true)}
                />
                <DropdownMenuItem
                  icon={LogOut}
                  label="Exit Guest Mode"
                  onClick={exitGuestMode}
                  data-testid="menu-item-exit-guest"
                />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Title
          title={title}
          showTitle={showTitle}
          className="hidden sm:block px-2"
        />

        <div className="flex-1" />

        {children}
      </div>

      {isSearchExpanded && (
        <SearchInput
          value={searchVal}
          onChange={onSearchChange}
          autoFocus
          onBlur={() => !searchVal && setIsSearchExpanded(false)}
          className="mb-3 mx-1"
        />
      )}
      <SignInDialog open={showSignIn} onOpenChange={setShowSignIn} />
    </>
  )
}
