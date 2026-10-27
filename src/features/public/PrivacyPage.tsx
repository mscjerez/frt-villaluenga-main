import { site } from '@/config/site'

// Template text: have it reviewed before publishing.
export function PrivacyPage() {
  const c = site.dataController
  return (
    <article className="mx-auto max-w-[68ch] px-4 py-16 leading-relaxed sm:px-6 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3 [&_li]:mt-1 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-4xl font-bold tracking-tight">Política de privacidad</h1>
      <p className="text-ink-soft">
        Información sobre el tratamiento de datos personales conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de
        Datos Personales y garantía de los derechos digitales (LOPDGDD).
      </p>
      <h2>Responsable del tratamiento</h2>
      <p>
        {c.name}, con NIF {c.taxId} y domicilio en {c.address}. Contacto: {c.email}.
      </p>
      <h2>Qué datos tratamos</h2>
      <ul>
        <li>Datos de la entidad: nombre del grupo o asociación.</li>
        <li>Datos de la persona responsable: nombre, DNI o NIE, teléfono y correo electrónico.</li>
        <li>Datos de la estancia: fechas, horarios, número de participantes y descripción de la actividad.</li>
        <li>Justificantes de pago que nos envíes.</li>
      </ul>
      <p>No pedimos datos de los menores participantes, solo su número.</p>
      <h2>Para qué los usamos</h2>
      <p>Gestionar la solicitud y la reserva, comunicarnos contigo, cobrar y devolver importes y fianzas, y cumplir obligaciones legales y contables.</p>
      <h2>Base legal</h2>
      <p>Tu consentimiento al enviar el formulario y la ejecución de la reserva que solicitas (art. 6.1.a y 6.1.b RGPD), así como el cumplimiento de obligaciones legales (art. 6.1.c RGPD).</p>
      <h2>Cuánto tiempo los guardamos</h2>
      <p>Mientras dure la reserva y, después, durante los plazos exigidos por la normativa fiscal y contable. Las solicitudes que no llegan a confirmarse se eliminan al cabo de un año.</p>
      <h2>Con quién los compartimos</h2>
      <p>No cedemos tus datos a terceros salvo obligación legal. Nuestros proveedores de alojamiento web y correo actúan como encargados del tratamiento con las garantías del RGPD.</p>
      <h2>Protección anti-spam</h2>
      <p>El formulario usa Cloudflare Turnstile para distinguir personas de programas automáticos. Cloudflare procesa datos técnicos de tu navegador únicamente con este fin.</p>
      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento, escribiendo a{' '}
        {c.email}. Si no estás conforme con la respuesta, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).
      </p>
    </article>
  )
}
