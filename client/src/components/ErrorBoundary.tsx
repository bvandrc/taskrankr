import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { EmptyObject } from 'type-fest'

import { debugLog } from '@/lib/debug-logger'
import { ContactCardStandalone } from './appInfo/ContactCard'
import { Button } from './primitives/Button'

const IGNORED_ERRORS = [/ResizeObserver loop/]

const ErrorDialog = ({ errorText }: { errorText: string }) => (
  <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4">
    <div
      className="w-full max-w-lg rounded-lg border border-red-500/30 bg-red-950 p-6 shadow-2xl"
      data-testid="dialog-error-boundary"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
          <AlertTriangle className="size-5 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-red-100">
            Something went wrong
          </h2>
          <p className="text-sm text-red-300/80">
            An unexpected error occurred
          </p>
        </div>
      </div>

      <div
        className="mb-4 max-h-48 overflow-y-auto rounded-md bg-red-900/50 border border-red-500/20 p-3"
        data-testid="text-error-details"
      >
        <pre className="whitespace-pre-wrap break-words text-xs text-red-200 font-mono">
          {errorText}
        </pre>
      </div>

      <ContactCardStandalone
        showDebugDownload
        className="mb-4 bg-red-900/30 border-red-500/20"
      />

      <Button
        variant="outline"
        className="w-full gap-2 border-red-500/30 text-red-200 hover:text-red-100"
        onClick={() => window.location.reload()}
        data-testid="button-error-reload"
      >
        <RefreshCw className="size-4" />
        Reload App
      </Button>
    </div>
  </div>
)

type Props = React.PropsWithChildren<EmptyObject>

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidMount() {
    window.addEventListener('error', this.handleGlobalError)
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError)
    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection,
    )
  }

  private isIgnored(message: string): boolean {
    return IGNORED_ERRORS.some((pattern) => pattern.test(message))
  }

  private surfaceError(error: Error, action: string) {
    if (this.isIgnored(error.message)) return
    debugLog.log('ErrorBoundary', action, {
      message: error.message,
      stack: error.stack,
    })
    this.setState({ hasError: true, error })
  }

  handleGlobalError = (event: ErrorEvent) => {
    const error =
      event.error instanceof Error
        ? event.error
        : new Error(event.message || 'Unknown error')
    if (this.isIgnored(error.message)) return
    event.preventDefault()
    this.surfaceError(error, 'uncaught_error')
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))
    if (this.isIgnored(error.message)) return
    event.preventDefault()
    this.surfaceError(error, 'unhandled_rejection')
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    debugLog.log('ErrorBoundary', 'component_error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children
    }

    const errorText = [this.state.error.message, this.state.error.stack]
      .filter(Boolean)
      .join('\n\n')

    return <ErrorDialog errorText={errorText} />
  }
}
