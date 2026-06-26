/**
 * @fileoverview Main application component with routing and provider setup
 */

import { lazy, Suspense, useEffect, useRef } from 'react'
import { Route, Switch, useLocation } from 'wouter'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from '@/components/primitives/overlays/Toaster'
import { TooltipProvider } from '@/components/primitives/overlays/Tooltip'
import { Spinner } from '@/components/primitives/Spinner'
import { TaskFormDialogProvider } from '@/components/TaskForm/TaskFormDialogProvider'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { toastInfo } from '@/hooks/useToasts'
import {
  clearGuestStorage,
  migrateGuestTasksToAuth,
} from '@/lib/migrate-guest-tasks'
import { StorageMode } from '@/lib/storage'
import Home from '@/pages/Home'
import Landing from '@/pages/Landing'
import { BannersProvider } from '@/providers/BannersProvider'
import { ExpandedTasksProvider } from '@/providers/ExpandedTasksProvider'
import { GuestModeProvider, useGuestMode } from '@/providers/GuestModeProvider'
import { SettingsProvider } from '@/providers/SettingsProvider'
import { SyncProvider } from '@/providers/SyncProvider'
import { TaskSyncQueueProvider } from '@/providers/TaskSyncQueueProvider'
import { TasksProvider } from '@/providers/TasksProvider'
import { StatusBanner } from './components/appInfo/StatusBanner'
import { WhatsNewDialog } from './components/appInfo/WhatsNewDialog'
import { Routes } from './lib/constants'

const Completed = lazy(() => import('@/pages/Completed'))
const Settings = lazy(() => import('@/pages/Settings'))
const HowToUse = lazy(() => import('@/pages/HowToUse'))
const HowToInstall = lazy(() => import('@/pages/HowToInstall'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const Router = () => (
  <div className="flex-1 flex flex-col min-h-0">
    <Suspense fallback={<Spinner centered />}>
      <Switch>
        <Route path={Routes.HOME} component={Home} />
        <Route path={Routes.COMPLETED} component={Completed} />
        <Route path={Routes.SETTINGS} component={Settings} />
        <Route path={Routes.HOW_TO_USE} component={HowToUse} />
        <Route path={Routes.HOW_TO_INSTALL} component={HowToInstall} />
        <Route path={Routes.PRIVACY_POLICY} component={PrivacyPolicy} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  </div>
)

const GuestRedirect = () => {
  const { enterGuestMode } = useGuestMode()
  const [, setLocation] = useLocation()

  useEffect(() => {
    enterGuestMode()
    setLocation(Routes.HOME)
  }, [enterGuestMode, setLocation])

  return null
}

const AuthenticatedApp = () => {
  const { isLoading, isAuthenticated } = useAuth()
  const { isGuestMode } = useGuestMode()
  const hasMigrated = useRef(false)
  const [location] = useLocation()

  useEffect(() => {
    if (isAuthenticated && !isGuestMode && !hasMigrated.current) {
      hasMigrated.current = true
      const result = migrateGuestTasksToAuth()
      if (result.migratedCount > 0) {
        clearGuestStorage()
        toastInfo({
          title: 'Tasks imported',
          description: `${result.migratedCount} tasks from guest mode have been added to your account.`,
        })
      }
    }
  }, [isAuthenticated, isGuestMode])

  if (isLoading && !isGuestMode) {
    return <Spinner fullScreen />
  }

  if (!isAuthenticated && !isGuestMode) {
    if (location === Routes.HOW_TO_INSTALL) {
      return (
        <Suspense fallback={<Spinner fullScreen />}>
          <HowToInstall />
        </Suspense>
      )
    }
    if (location === Routes.GUEST) {
      return <GuestRedirect />
    }
    return <Landing />
  }

  const shouldSync = isAuthenticated && !isGuestMode
  const storageMode = isGuestMode ? StorageMode.GUEST : StorageMode.AUTH

  return (
    <SettingsProvider shouldSync={shouldSync} storageMode={storageMode}>
      <TaskSyncQueueProvider
        key={storageMode} // necessary to reset the queue when switching between guest/auth modes
        shouldSync={shouldSync}
        storageMode={storageMode}
      >
        <TasksProvider shouldSync={shouldSync} storageMode={storageMode}>
          <SyncProvider isAuthenticated={shouldSync}>
            <ExpandedTasksProvider>
              <TaskFormDialogProvider>
                <div className="h-dvh flex flex-col overflow-hidden">
                  <StatusBanner />
                  <Router />
                  <WhatsNewDialog />
                </div>
              </TaskFormDialogProvider>
            </ExpandedTasksProvider>
          </SyncProvider>
        </TasksProvider>
      </TaskSyncQueueProvider>
    </SettingsProvider>
  )
}

const App = () => {
  const [location] = useLocation()

  useEffect(() => {
    const loader = document.getElementById('app-loader')
    if (loader) {
      loader.remove()
    }
  }, [])

  if (location === Routes.PRIVACY_POLICY) {
    return (
      <Suspense fallback={<Spinner fullScreen />}>
        <PrivacyPolicy />
      </Suspense>
    )
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <TooltipProvider>
          <BannersProvider>
            <GuestModeProvider>
              <Toaster />
              <AuthenticatedApp />
            </GuestModeProvider>
          </BannersProvider>
        </TooltipProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
