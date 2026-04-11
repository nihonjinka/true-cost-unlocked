export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="loading-spinner" />
      <p className="loading-pulse font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
        SCANNING DOCUMENT...
      </p>
    </div>
  );
}
