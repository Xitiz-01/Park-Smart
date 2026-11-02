import { cn } from '@/lib/utils';

// Indian-style registration plate. Electric vehicles get a green strip
// instead of the blue IND strip. The plate is decorative styling around
// the registration text, which stays readable as plain text.
export default function NumberPlate({ plate, electric = false, className }) {
  return (
    <span className={cn('inline-flex h-9 items-stretch overflow-hidden rounded-md border-2 border-plate-text/80 bg-plate-bg text-plate-text shadow-hairline', className)}>
      <span aria-hidden="true" className={cn('flex w-5 flex-col items-center justify-center text-[0.5rem] leading-none font-bold tracking-tight text-white', electric ? 'bg-plate-ev' : 'bg-plate-ind')}>
        {electric ? 'EV' : 'IND'}
      </span>
      <span className="flex items-center px-2.5 font-mono text-base font-semibold tracking-wider uppercase">{plate}</span>
    </span>
  );
}
