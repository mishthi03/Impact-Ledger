import type { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  description: string;
  action?: ReactNode;
  imageUrl?: string;
}

export default function PageHero({ title, description, action, imageUrl }: PageHeroProps) {
  const bgImage = imageUrl ?? 'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&h=300&w=1200';

  return (
    <div className="hero-banner relative">
      <div className="absolute inset-0">
        <img src={bgImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d4f4f]/95 via-[#115e63]/90 to-[#14919b]/80" />
      </div>
      <div className="relative px-6 py-7 sm:px-8 sm:py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{title}</h1>
          <p className="text-teal-100 mt-1.5 text-sm sm:text-base max-w-xl">{description}</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
