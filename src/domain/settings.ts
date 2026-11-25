export type BannerTone = 'info' | 'warning'

/** Notice at the top of the home page, edited in the admin panel (closures, news…). Plain text only. */
export interface SiteBanner {
  enabled: boolean
  tone: BannerTone
  title: string
  message: string
  /** yyyy-MM-dd, inclusive. null = no limit. */
  startsOn: string | null
  endsOn: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type SiteBannerInput = Pick<SiteBanner, 'enabled' | 'tone' | 'title' | 'message' | 'startsOn' | 'endsOn'>

/** What visitors receive: only an active banner, without who edited it. */
export type PublicBanner = Pick<SiteBanner, 'tone' | 'title' | 'message'>

export const BANNER_TITLE_MAX = 80
export const BANNER_MESSAGE_MAX = 400

export const emptyBanner: SiteBanner = {
  enabled: false,
  tone: 'info',
  title: '',
  message: '',
  startsOn: null,
  endsOn: null,
  updatedAt: null,
  updatedBy: null,
}

/** `today` is yyyy-MM-dd in the house's time zone. */
export const isBannerActive = (b: SiteBannerInput, today: string) =>
  b.enabled && b.message.trim() !== '' && (!b.startsOn || b.startsOn <= today) && (!b.endsOn || b.endsOn >= today)
