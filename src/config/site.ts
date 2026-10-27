import { withBase } from '@/lib/base'

// Editable content for the public site. Prices here are only used to show an estimate;
// the backend must recalculate them and is the source of truth.

export const site = {
  name: 'Rincón Scout Cura Carlos',
  place: 'Villaluenga del Rosario',
  province: 'Cádiz',
  area: 'Parque Natural Sierra de Grazalema',
  contactEmail: 'secretaria@mscjerez.es',
  contactPhone: '+34 669 83 89 53',
  maxGuests: 80,
  mapsUrl: 'https://maps.app.goo.gl/WECyS4ijwwfRUB8s7',
  owner: 'Delegación Diocesana del Movimiento Scout Católico de Jerez',
  ownerWeb: 'https://www.mscjerez.es',
  bankAccount: {
    holder: 'Delegación Diocesana del MSC Jerez',
    bank: 'Santander',
    iban: 'ES22 0049 7323 2623 1001 2993',
  },
  dataController: {
    name: 'Delegación Diocesana del MSC Jerez',
    taxId: 'G11611613',
    address: 'Plaza del Arroyo, 50, 11403 Jerez de la Frontera (Cádiz)',
    email: 'secretaria@mscjerez.es',
  },
} as const

/** Transfer concept: booking reference plus the group name, as the house rules require. */
export const transferConcept = (reference: string, organization: string) => `${reference} ${organization}`.slice(0, 140)

export const prices = {
  deposit: 150,
  dayVisit: 3,
  night: 5,
  weekend: 10,
} as const

export const documents = [
  {
    id: 'rules',
    title: 'Normas de la casa',
    description: 'Convivencia, horarios, limpieza y uso de las instalaciones y cuenta bancaria',
    href: withBase('/docs/normas-de-la-casa.pdf'),
  },
  {
    id: 'incident',
    title: 'Parte de incidencias',
    description: 'Rellénalo a la llegada y salida',
    href: withBase('/docs/parte-de-incidencias.pdf'),
  },
] as const

export interface Photo {
  src: string
  alt: string
  caption: string
  /** Size in the gallery grid: `big` takes 2×2 cells, `wide` 2×1. */
  span?: 'big' | 'wide'
  /** CSS object-position, to keep the important part visible when cropped. */
  position?: string
}

// Files live in /public/photos. Gallery order is the order below.
export const photos: Photo[] = [
  { src: withBase('/photos/entorno.webp'), alt: 'Calle encalada junto a la casa con la sierra al fondo', caption: 'El entorno', span: 'big', position: '50% 60%' },
  { src: withBase('/photos/comedor-chimenea.webp'), alt: 'Comedor con chimenea, bancos corridos y pañoletas scout en la pared', caption: 'Comedor con chimenea', span: 'wide' },
  { src: withBase('/photos/comedor.webp'), alt: 'Comedor con mesa y bancos junto a la barra de la cocina', caption: 'Comedor' },
  { src: withBase('/photos/cocina.webp'), alt: 'Cocina con fogones de gas, campana extractora y encimera de granito', caption: 'Cocina' },
  { src: withBase('/photos/sala-mural.webp'), alt: 'Sala con un mural scout pintado y una oración escrita en la pared', caption: 'Sala del mural' },
  { src: withBase('/photos/sala-chimenea.webp'), alt: 'Sala amplia con suelo de barro y chimenea', caption: 'Sala con chimenea' },
  { src: withBase('/photos/rincon-oracion.webp'), alt: 'Rincón de oración con cruz de madera, Biblia y farol', caption: 'Rincón de oración' },
  { src: withBase('/photos/planta-alta.webp'), alt: 'Estancia de la planta alta con balcones hacia la sierra', caption: 'Planta alta' },
  { src: withBase('/photos/buhardilla.webp'), alt: 'Estancia abuhardillada con balcón', caption: 'Buhardilla' },
  { src: withBase('/photos/terraza.webp'), alt: 'Terraza con pérgola y mesas plegables sobre los tejados del pueblo', caption: 'Terraza', span: 'wide' },
  { src: withBase('/photos/vistas-terraza.webp'), alt: 'Tejados del pueblo y la sierra vistos desde la terraza', caption: 'Vistas desde la terraza' },
]

const byFile = (name: string) => photos.find((p) => p.src.endsWith(name))!

export const heroPhotos = {
  main: byFile('cocina.webp'),
  top: byFile('comedor-chimenea.webp'),
  bottom: byFile('terraza.webp'),
}

export const faq = [
  {
    q: '¿Quién puede reservar la casa?',
    a: 'Grupos scout, parroquias, o feligreses. Siempre debe haber una persona adulta responsable del grupo.',
  },
  {
    q: '¿Cuándo queda confirmada mi reserva?',
    a: 'Cuando enviamos la aceptación de la solicitud te indicamos el importe a pagar. La reserva queda confirmada al recibir el justificante de transferencia, que puedes subir desde el enlace de seguimiento de tu reserva.',
  },
  {
    q: '¿Qué significa "pendiente de confirmar" en el calendario?',
    a: 'Hay otra solicitud para esas fechas que aún no hemos aceptado. Puedes pedirlas igualmente: si la otra solicitud no sigue adelante, la tuya pasa a ser la siguiente. Te informaremos del estado en todo momento,',
  },
  {
    q: '¿Para qué es la fianza y cuándo se devuelve?',
    a: `La fianza de ${prices.deposit} € cubre posibles desperfectos. Se devuelve por transferencia después de la estancia, una vez revisada la casa y el parte de incidencias.`,
  },
  {
    q: '¿Cómo se calcula el precio?',
    a: `Visita de día sin pernoctar: ${prices.dayVisit} € por persona. Cada noche: ${prices.night} € por persona. Fin de semana de viernes a domingo: ${prices.weekend} € por persona. A esto se suma la fianza.`,
  },
  {
    q: '¿Cómo recojo y devuelvo las llaves?',
    a: 'Acordamos contigo el día y la hora de entrega antes de la llegada. Las llaves se devuelven al salir, junto con el parte de incidencias firmado. Contactaremos contigo mediante el teléfono o correo indicado',
  },
  {
    q: '¿Puedo cancelar?',
    a: 'Sí. Escríbenos cuanto antes. Si ya has pagado, te indicaremos el importe que se devuelve según la antelación con la que avises.',
  },
  {
    q: '¿Qué hay que traer?',
    a: 'Saco de dormir, toallas, productos de higiene y bolsas de basura. La casa cuenta con cocina equipada, menaje y botiquín básico. Hay cocina completa con plancha, varios fuegos y menaje de cocina. No garantizamos consumibles de limpieza o baño, tampoco la leña para la chimenea.',
  },
] as const
