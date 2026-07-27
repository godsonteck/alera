interface RouteLoaderProps {
  label?: string;
  compact?: boolean;
}

const RouteLoader = ({ label = 'Loading ALERA...', compact = false }: RouteLoaderProps) => {
  if (compact) {
    return (
      <div className="flex min-h-[280px] items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/15" />
            <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sidebar px-6 text-sidebar-foreground">
      <div className="relative z-10 flex max-w-md flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-sidebar-foreground/10" />
          <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-acuity-3" />
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-sidebar-foreground/60">Alera</p>
          <h2 className="font-display text-2xl font-bold text-sidebar-foreground">{label}</h2>
          <p className="text-xs text-sidebar-foreground/70 font-light">
            Preparing secure healthcare workflows and syncing your workspace.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RouteLoader;
