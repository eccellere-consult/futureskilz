'use client';

import { SAMPLE_NOTICE } from '@/lib/demo/marker';
import { btnOutline } from '@/components/cost-reduction/spend/ui';

/**
 * The strip shown on every screen that displays demo data. It says, in the same words everywhere, that the data is
 * fictional and is never saved or mixed into the visitor's own analysis, and offers the way back to their own data.
 */
export default function DemoBanner({ company, onExit, exitLabel = 'Exit the sample', exitHref, className = '' }: {
  company?: string;
  onExit?: () => void;
  exitLabel?: string;
  exitHref?: string;
  className?: string;
}) {
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-3 border border-eccellere-gold bg-eccellere-gold-pale px-4 py-3 ${className}`}>
      <p className="m-0 max-w-3xl text-[12.5px] leading-relaxed text-eccellere-ink">
        {company && <><strong className="font-semibold">{company}.</strong>{' '}</>}{SAMPLE_NOTICE}
      </p>
      {exitHref
        ? <a href={exitHref} className={`${btnOutline} bg-white`}>{exitLabel}</a>
        : onExit && <button type="button" onClick={onExit} className={`${btnOutline} bg-white`}>{exitLabel}</button>}
    </div>
  );
}
