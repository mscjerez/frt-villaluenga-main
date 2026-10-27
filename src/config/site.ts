// Editable content for the public site. Prices here are only used to show an estimate;
// the backend must recalculate them and is the source of truth.

export const site = {
  name: 'Rincón Cura Carlos',
  place: 'Villaluenga del Rosario',
  province: 'Cádiz',
  area: 'Parque Natural Sierra de Grazalema',
  contactEmail: 'reservas@rinconcuracarlos.es',
  contactPhone: '+34 600 000 000',
  maxGuests: 40,
  bankAccount: {
    holder: 'Asociación Rincón Cura Carlos',
    iban: 'ES00 0000 0000 0000 0000 0000',
  },
  dataController: {
    name: 'Asociación Rincón Cura Carlos',
    taxId: 'G00000000',
    address: 'Calle Real s/n, 11611 Villaluenga del Rosario (Cádiz)',
    email: 'privacidad@rinconcuracarlos.es',
  },
} as const

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
    description: 'Convivencia, horarios, limpieza y uso de las instalaciones.',
    href: '/docs/normas-de-la-casa.pdf',
  },
  {
    id: 'incident',
    title: 'Parte de incidencias',
    description: 'Rellénalo si algo se rompe o falta durante la estancia y entrégalo con las llaves.',
    href: '/docs/parte-de-incidencias.pdf',
  },
] as const

// Drop real photos in /public/photos with these names (JPG, ~1600px wide).
export const photos = [
  { src: '/photos/fachada.jpg', alt: 'Fachada encalada de la casa', caption: 'Fachada' },
  { src: '/photos/salon.jpg', alt: 'Salón comedor con mesas largas', caption: 'Salón comedor' },
  { src: '/photos/dormitorio.jpg', alt: 'Dormitorio con literas', caption: 'Dormitorios con literas' },
  { src: '/photos/cocina.jpg', alt: 'Cocina equipada', caption: 'Cocina' },
  { src: '/photos/patio.jpg', alt: 'Patio exterior', caption: 'Patio' },
  { src: '/photos/vistas.jpg', alt: 'Vistas a la sierra desde el pueblo', caption: 'Vistas a la sierra' },
] as const

export const faq = [
  {
    q: '¿Quién puede reservar la casa?',
    a: 'Grupos scout, parroquias, asociaciones juveniles y entidades sin ánimo de lucro que organicen actividades educativas o de tiempo libre. Siempre debe haber una persona adulta responsable del grupo.',
  },
  {
    q: '¿Cuándo queda confirmada mi reserva?',
    a: 'Cuando enviamos la aceptación de la solicitud te indicamos el importe a pagar. La reserva queda confirmada al recibir el justificante de transferencia, que puedes subir desde el enlace de seguimiento de tu reserva.',
  },
  {
    q: '¿Qué significa "pendiente de confirmar" en el calendario?',
    a: 'Hay otra solicitud para esas fechas que aún no hemos aceptado. Puedes pedirlas igualmente: si la otra solicitud no sigue adelante, la tuya pasa a ser la siguiente.',
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
    a: 'Acordamos contigo el día y la hora de entrega antes de la llegada. Las llaves se devuelven al salir, junto con el parte de incidencias firmado.',
  },
  {
    q: '¿Puedo cancelar?',
    a: 'Sí. Escríbenos cuanto antes. Si ya habías pagado, te indicaremos el importe que se devuelve según la antelación con la que avises.',
  },
  {
    q: '¿Qué hay que traer?',
    a: 'Saco de dormir o ropa de cama, toallas, productos de higiene y bolsas de basura. La casa cuenta con cocina equipada, menaje y botiquín básico.',
  },
] as const
