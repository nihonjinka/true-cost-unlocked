export function Footer() {
  return (
    <footer className="border-t border-border px-4 sm:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-bold text-foreground">TRUE COST</span>
          <span className="font-mono text-[10px] text-muted-foreground">© 2026, Created by Mythos</span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground tracking-wider">
          FINANCIAL TRANSPARENCY PROTOCOL • BUILDING INFORMED DECISIONS
        </p>
      </div>
    </footer>
  );
}
