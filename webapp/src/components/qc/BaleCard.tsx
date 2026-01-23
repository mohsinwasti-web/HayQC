import { Check, X, ChevronRight, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Bale, Decision, BaleGrade, colorDisplay, stemsDisplay, wetnessDisplay, gradeDisplay } from '@/types/qc';

interface BaleCardProps {
  bale: Bale;
  onClick?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function BaleCard({ bale, onClick, showDetails = false, className }: BaleCardProps) {
  const isAccepted = bale.decision === Decision.ACCEPT;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full text-left bg-card rounded-xl border p-3 transition-all',
        isAccepted ? 'border-green-200' : 'border-red-200',
        onClick && 'hover:shadow-md active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Decision indicator */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            isAccepted ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          )}
        >
          {isAccepted ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </div>

        {/* Bale info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">#{bale.baleNumber}</span>
            <span className="text-sm text-muted-foreground">{bale.weightKg} kg</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{colorDisplay[bale.color]}</span>
            <span className="w-1 h-1 bg-muted-foreground rounded-full" />
            <span>{stemsDisplay[bale.stems]}</span>
            <span className="w-1 h-1 bg-muted-foreground rounded-full" />
            <span>{wetnessDisplay[bale.wetness]}</span>
          </div>
        </div>

        {/* Photo indicator */}
        {(bale.photo1Url || bale.photo2Url) && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Image className="w-4 h-4" />
            <span className="text-xs">
              {[bale.photo1Url, bale.photo2Url].filter(Boolean).length}
            </span>
          </div>
        )}

        {onClick && <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
      </div>

      {/* Expanded details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {bale.moisturePct !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Moisture</span>
              <span className="font-medium">{bale.moisturePct}%</span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {bale.contamination && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                Contamination
              </span>
            )}
            {bale.mixedMaterial && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                Mixed Material
              </span>
            )}
            {bale.mold && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Mold</span>
            )}
          </div>
          {bale.rejectReason && (
            <div className="text-sm">
              <span className="text-muted-foreground">Reason:</span>{' '}
              <span className="text-red-600">{bale.rejectReason}</span>
            </div>
          )}
          {bale.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Notes:</span> {bale.notes}
            </div>
          )}
        </div>
      )}
    </button>
  );
}
