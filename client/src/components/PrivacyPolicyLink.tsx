import { Link } from 'wouter'

import { Routes } from '@/lib/constants'
import { cn } from '@/lib/utils'

export const PrivacyPolicyLink = ({ className }: { className?: string }) => (
  <Link
    href={Routes.PRIVACY_POLICY}
    className={cn(
      'text-xs text-muted-foreground underline hover:text-foreground',
      className,
    )}
  >
    Privacy Policy
  </Link>
)
