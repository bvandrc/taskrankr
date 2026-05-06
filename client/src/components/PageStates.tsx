// biome-ignore lint/style/useFilenamingConvention: is fine
/**
 * @fileoverview Shared UI components for page error and empty states.
 */

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
    <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
      {icon}
    </div>
    <h3 className="text-xl font-medium text-foreground">{title}</h3>
    <p className="text-muted-foreground max-w-sm">{description}</p>
    {action}
  </div>
)
