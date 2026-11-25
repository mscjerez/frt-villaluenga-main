import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Info } from 'lucide-react'
import { publicApi } from '@/api/public'
import type { PublicBanner } from '@/domain/settings'
import { cn } from '@/lib/cn'

/** Notice set in the admin panel (Ajustes). Renders nothing when there is none or the API fails. */
export function HomeBanner() {
  const { data } = useQuery({ queryKey: ['banner'], queryFn: publicApi.banner, staleTime: 5 * 60_000, retry: 1 })
  return data?.banner ? <SiteBannerView banner={data.banner} /> : null
}

export function SiteBannerView({ banner, className }: { banner: PublicBanner; className?: string }) {
  const warning = banner.tone === 'warning'
  const Icon = warning ? AlertTriangle : Info
  return (
    <aside
      aria-label="Aviso"
      className={cn('border-b', warning ? 'border-albero-100 bg-albero-50' : 'border-encina-100 bg-encina-50', className)}
    >
      <div className="mx-auto flex max-w-6xl gap-3 px-4 py-3.5 text-sm leading-relaxed sm:px-6">
        <Icon className={cn('mt-0.5 size-4.5 shrink-0', warning ? 'text-albero-700' : 'text-encina-600')} aria-hidden />
        <p className="min-w-0 whitespace-pre-line text-ink">
          {banner.title && (
            <strong className="mr-1.5 font-semibold">
              {banner.title}
              {/[.!?:…]$/.test(banner.title) ? '' : '.'}
            </strong>
          )}
          {banner.message}
        </p>
      </div>
    </aside>
  )
}
