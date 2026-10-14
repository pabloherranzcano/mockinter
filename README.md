# mockinter.dev

Lecciones tipo test de 5 minutos para preparar entrevistas técnicas (Angular, React, Cloud/DevOps y Backend Java/Spring), con preguntas de código, rachas, XP, vidas y un panel de admin para mantener las preguntas. Sin coste por uso: no hay IA ni APIs de pago.

**Stack:** React 19 + TypeScript · Vite · React Router · TanStack Query · Supabase (Postgres y Auth) · Vercel.

> La primera versión del frontend se hizo en Angular; sigue en el historial de git (primeros commits).

---

## Cómo funciona

```
Usuario ──► App React (Vercel) ──► Supabase
                                      ├─ Auth (email/contraseña, Google)
                                      ├─ Postgres con Row Level Security
                                           topics, questions, profiles, progress,
                                           wrong_answers, reports
```

- **Las preguntas viven en la base de datos.** Si corriges una desde el panel de admin, los usuarios ven el cambio al instante, sin volver a desplegar.
- **Solo despliegas cuando cambias el código.** Cada `git push` a `main` publica la web automáticamente.
- **La seguridad está en la base de datos**, no en la pantalla. Un usuario normal no puede editar preguntas, ver reportes de otros, cambiarse el rol ni inventarse XP, aunque llame a la API directamente. `npm run test:db` lo comprueba.

---

## Puesta en marcha (una sola vez)

Necesitas: Node 22.12 o superior, Python 3, y cuentas en GitHub, [Supabase](https://supabase.com) y [Vercel](https://vercel.com).

### 1. Base de datos en Supabase

1. Crea un proyecto en Supabase. Elige una **región de la UE** (Frankfurt o París), porque tus usuarios están en España.
2. Abre **SQL Editor** y ejecuta, en orden de nombre, cada archivo de `supabase/migrations/`.
3. Genera la carga de preguntas desde el Excel y ejecútala también en el SQL Editor:
   ```bash
   pip install openpyxl
   npm run import -- ruta/a/Temario_mockinter.xlsx      # crea supabase/seed.sql
   ```
   Copia el contenido de `supabase/seed.sql` en el SQL Editor y ejecútalo.
   Puedes volver a ejecutar `seed.sql` cuando quieras: no duplica preguntas ni pisa lo que hayas editado desde el panel.

### 2. Autenticación

En **Authentication → URL Configuration**:
- **Site URL:** la URL de tu web, por ejemplo `https://mockinter.dev` (o tu dominio).
- **Redirect URLs:** añade esa misma URL y `http://localhost:5173` para desarrollar.

En **Authentication → Providers**:
- **Email** viene activado. Deja activada la confirmación de email.
- **Google** (opcional): sigue la guía de Supabase para crear las credenciales OAuth en Google Cloud. Si no lo activas, el botón "Continuar con Google" mostrará un aviso.

> Los emails que manda Supabase por defecto tienen un límite muy bajo por hora. Antes de lanzar, configura tu propio SMTP en **Project Settings → Authentication → SMTP** (Brevo, Resend, Amazon SES…).

### 3. Hazte admin

Regístrate en la app con tu email y después ejecuta en el SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'TU-EMAIL@ejemplo.com');
```

Al recargar la app verás un escudo junto a tu perfil que lleva al panel de admin (`/admin`).

### 4. Conecta la app con Supabase

Copia `.env.example` como `.env` y rellénalo con los datos de **Project Settings → API**:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...            # la clave "anon" / "publishable": es pública por diseño
VITE_CONTACT_EMAIL=tu-email@ejemplo.com  # aparece en la política de privacidad
```

`.env` no se sube a git. Pruébala en local:

```bash
npm install
npm run dev        # http://localhost:5173
```

### 5. Publica en internet

1. Sube el proyecto a GitHub:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/mockinter.git
   git push -u origin main
   ```
2. En Vercel: **Add New → Project** e importa el repositorio. Antes de pulsar **Deploy**, añade en **Environment Variables** las tres variables de tu `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CONTACT_EMAIL`). `vercel.json` ya indica el comando de build y la carpeta de salida.
3. Copia la URL que te da Vercel en **Site URL** y **Redirect URLs** de Supabase (paso 2).
4. **Dominio propio** (opcional): cómpralo en cualquier registrador y añádelo en Vercel → Settings → Domains. Recuerda actualizar también las URLs en Supabase.

A partir de aquí, cada `git push` a `main` despliega solo, y cada pull request genera una URL de prueba.

> **Netlify o Cloudflare Pages** también sirven: comando `npm run build`, carpeta `dist`, y las mismas variables de entorno. El archivo `public/_redirects` ya está incluido para Netlify.

---

## Día a día: mantener las preguntas

1. Un usuario pulsa **"Reportar un problema con esta pregunta"** tras responder y elige el motivo (respuesta incorrecta, no se entiende, errata, sugerencia u otro), con un comentario opcional.
2. Tú entras en **Admin → Reportes**: los reportes salen agrupados por pregunta, con las más reportadas primero.
3. Pulsas **Editar pregunta**, corriges el texto o las opciones y guardas. El cambio está en vivo al momento.
4. Marcas los reportes como **resueltos** (o **descartados** si no tenían razón).

En **Admin → Preguntas** puedes filtrar por puesto, tema, nivel o estado, **ocultar o mostrar** cualquier pregunta con un interruptor, y crear preguntas nuevas. El ID se asigna solo.

**Cambios masivos desde el Excel:** edita el Excel, ejecuta `npm run import -- Temario_mockinter.xlsx` y ejecuta el `seed.sql` resultante. Por defecto **no** sobrescribe las preguntas que ya existen, para no pisar lo que hayas cambiado desde el panel. Con `--overwrite`, el Excel manda. Con `--prune`, además se borran los temas y preguntas que ya no estén en el Excel (útil al reorganizar el temario).

---

## Antes de lanzar: lista de comprobación

- [ ] Completa los `[CORCHETES]` de `src/pages/Privacy.tsx` (tu nombre, fecha, proveedores y regiones).
- [ ] SMTP propio configurado en Supabase.
- [ ] Revisa las preguntas (Estado = Revisada) o, como mínimo, las de los temas que vayas a anunciar primero.
- [ ] Prueba el flujo completo con una cuenta normal: registro, onboarding, lección, reporte y borrar cuenta.

---

## Desarrollo

```bash
npm run dev        # servidor de desarrollo
npm test           # tests unitarios (Vitest + Testing Library)
npm run test:db    # esquema y reglas de seguridad en un Postgres en memoria
npm run build      # comprobación de tipos y build de producción en dist/
```

### Estructura

```
src/
  App.tsx      rutas (React Router) con carga diferida
  auth/        AuthProvider (contexto de sesión y perfil) y rutas protegidas
  lib/         cliente de Supabase, funciones de la API, modelos y utilidades
               progress.ts: escalones Junior/Mid/Senior de cada tema (lógica pura, con tests)
  pages/       login, onboarding, inicio, lección, ajustes, privacidad
               lessonReducer.ts: la lógica de la lección como reducer puro, con sus tests
  admin/       panel: reportes, lista de preguntas, editor
  components/  logo, diálogo de reporte, texto con `código`, bloque de código con resaltado
supabase/
  migrations/  esquema, reglas de acceso (RLS) y funciones SQL
  seed.sql     preguntas generadas desde el Excel
scripts/
  import_xlsx.py  Excel → seed.sql
  test-db.mjs     pruebas de la base de datos
```

#### Decisiones técnicas (útiles para explicarlas en una entrevista)

- **TanStack Query** gestiona los datos del servidor: caché, estados de carga y error, e invalidación tras guardar. El interruptor de visible/oculta usa una actualización optimista.
- **La lógica de la lección es un reducer puro** (`lessonReducer.ts`), sin React ni red. La pantalla solo despacha acciones, y la lógica se testea aislada.
- **El estado de sesión vive en un contexto** (`AuthProvider`), y las rutas protegidas son componentes que redirigen (`RequireAuth`, `RequireAdmin`…).
- **Las pantallas se cargan bajo demanda** con `React.lazy`, y las librerías grandes van en chunks separados.
- **La seguridad está en la base de datos** (RLS), no en el frontend. El panel de admin oculto es solo comodidad.

## Cómo se decide qué ve cada usuario

- **Onboarding:** puesto (Angular, React, Cloud/DevOps, Backend), nivel por el que empieza (Junior, Mid, Senior) e idioma de la entrevista. Se puede cambiar desde Ajustes.
- **Camino de lecciones:** "Presentación y STAR", los temas del puesto, los bloques compartidos y, al final, "Preguntas difíciles" e "Inglés de entrevista" (este último se oculta si la entrevista es en español).
  - Angular y React suman el bloque **Frontend** (CSS/BEM/Flex/Grid, TypeScript, arquitectura con EventBus y CommandBus, patrones y clean code).
  - Todos los puestos técnicos suman el bloque **Desarrollo** (Git y Docker).
- **Escalones dentro de cada tema:** Junior → Mid → Senior. El nivel del onboarding marca el escalón de inicio; ese y los anteriores están abiertos, y los superiores se desbloquean al completar el anterior. La lógica está en `src/lib/progress.ts`.
- **Cada lección:** las preguntas activas de ese tema y escalón, barajadas. Muchas llevan un fragmento de código (¿qué imprime?, ¿dónde está el bug?, ¿qué hace?). Cada fallo cuesta una vida y la pregunta vuelve al final de la cola.
- **Entrevista en español:** se oculta el bloque de inglés y las preguntas con frases en inglés usan su variante española (columnas *Variante ES* del Excel o sección plegable del editor).
- **XP y racha:** se guardan en el servidor al terminar la lección, con la fecha de Madrid y un tope por lección.
