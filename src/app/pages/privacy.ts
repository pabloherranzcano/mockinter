import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { Logo } from '../shared/logo';

/** Plantilla de política de privacidad. Revísala (y, si puedes, que la revise un profesional) antes de publicar. */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink, Logo],
  template: `
  <main class="wrap prose">
    <header class="top"><app-logo /><a class="btn ghost sm" routerLink="/">Volver</a></header>
    <h2 style="font-size:1.8rem;margin-top:24px">Política de privacidad</h2>
    <p class="muted small">Última actualización: [FECHA]</p>

    <h2>Quién es el responsable</h2>
    <p>[TU NOMBRE COMPLETO], con contacto en <strong>{{ email }}</strong>, es responsable del tratamiento de los datos de Racha.</p>

    <h2>Qué datos guardamos</h2>
    <ul>
      <li>Tu email y, si lo indicas, tu nombre.</li>
      <li>Tus preferencias: puesto, nivel e idioma de la entrevista.</li>
      <li>Tu progreso: XP, racha, lecciones completadas y preguntas falladas.</li>
      <li>Los reportes y sugerencias que envíes sobre las preguntas.</li>
    </ul>
    <p>Las respuestas abiertas que envías para corregir se mandan a un proveedor de inteligencia artificial (Anthropic) para generar la corrección y no las guardamos.</p>

    <h2>Para qué los usamos</h2>
    <p>Solo para darte el servicio: guardar tu progreso, adaptar las lecciones y mejorar las preguntas. No vendemos tus datos ni los usamos para publicidad.</p>

    <h2>Base legal</h2>
    <p>La ejecución del servicio que solicitas al crear tu cuenta (art. 6.1.b RGPD).</p>

    <h2>Con quién se comparten</h2>
    <p>Con los proveedores que hacen funcionar la app: Supabase (base de datos y autenticación), [PROVEEDOR DE HOSTING, p. ej. Vercel] y Anthropic (corrección de respuestas). [Indica las regiones donde alojas los datos y, si alguno está fuera del EEE, las garantías aplicables.]</p>

    <h2>Cuánto tiempo</h2>
    <p>Mientras tengas la cuenta. Puedes borrarla cuando quieras desde Ajustes y se eliminan tus datos.</p>

    <h2>Tus derechos</h2>
    <p>Puedes acceder, rectificar, suprimir, oponerte, limitar el tratamiento y pedir la portabilidad escribiendo a <strong>{{ email }}</strong>. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>

    <h2>Cookies</h2>
    <p>Racha solo usa almacenamiento técnico necesario para mantener tu sesión iniciada. No usamos cookies de analítica ni de publicidad.</p>
  </main>`,
})
export class PrivacyPage {
  readonly email = environment.contactEmail;
}
