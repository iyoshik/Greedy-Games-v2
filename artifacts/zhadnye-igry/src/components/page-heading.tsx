import type { ReactNode } from 'react';
import type { EpistemicStatus } from '@/lib/rpg-storage';

export function PageHeading({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end md:mb-8">
      <div className="min-w-0">
        <div className="mb-1.5 text-[12px] font-medium tracking-[0.04em] text-[#b8a572]">
          {kicker}
        </div>
        <h1 className="page-title m-0 text-[34px] leading-[1.08] text-[#f2eadb] md:text-[42px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#9c9d96]">
          {description}
        </p>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function EpistemicLabel({ status }: { status: EpistemicStatus }) {
  if (status === 'confirmed') {
    return <span className="font-medium text-[#8fc1a3]">Подтверждено</span>;
  }
  if (status === 'self-assessment') {
    return <span className="font-medium text-[#d5b97a]">Самооценка</span>;
  }
  return <span className="font-medium text-[#8a8c92]">Нет данных</span>;
}
