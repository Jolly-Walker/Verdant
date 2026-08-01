export function PositionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Chain/Section header skeleton */}
      <div className="h-7 bg-verdant-surface-accent/70 rounded w-40 mb-2"></div>

      {/* Table skeleton */}
      <div className="bg-verdant-surface border border-verdant-rule rounded-xl p-5 shadow-organic space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-5 bg-verdant-surface-accent rounded w-28"></div>
          <div className="h-4 bg-verdant-surface-accent rounded w-16"></div>
        </div>

        {/* Mobile: two stacked card shapes */}
        <div className="space-y-3 md:hidden">
          {[1, 2].map((card) => (
            <div key={card} className="rounded-xl border border-verdant-rule/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-verdant-surface-accent"></div>
                <div className="h-4 bg-verdant-surface-accent rounded w-24"></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-4 bg-verdant-surface-accent rounded"></div>
                <div className="h-4 bg-verdant-surface-accent rounded"></div>
              </div>
              <div className="h-10 bg-verdant-surface-accent rounded"></div>
            </div>
          ))}
        </div>

        <div className="hidden space-y-4 md:block">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between py-3 border-b border-verdant-canvas last:border-b-0"
            >
              {/* Asset column */}
              <div className="flex items-center gap-3 w-1/4">
                <div className="h-8 w-8 rounded-full bg-verdant-surface-accent"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-verdant-surface-accent rounded w-16"></div>
                  <div className="h-3 bg-verdant-surface-accent rounded w-24"></div>
                </div>
              </div>

              {/* Price column */}
              <div className="h-4 bg-verdant-surface-accent rounded w-14"></div>

              {/* Balance column */}
              <div className="space-y-2 w-20">
                <div className="h-4 bg-verdant-surface-accent rounded"></div>
                <div className="h-3 bg-verdant-surface-accent rounded w-3/4"></div>
              </div>

              {/* APY column */}
              <div className="h-4 bg-verdant-surface-accent rounded w-12"></div>

              {/* Action column */}
              <div className="h-8 bg-verdant-surface-accent rounded w-20"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
