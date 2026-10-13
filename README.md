# mockinter.dev

Lecciones de 5 minutos para preparar entrevistas técnicas (Angular, React, Cloud/DevOps y Backend Java/Spring), con rachas, XP, vidas, corrección de respuestas abiertas con IA y un panel de admin para mantener las preguntas.

**Stack:** React 19 + TypeScript · Vite · React Router · TanStack Query · Supabase (Postgres, Auth, Edge Functions) · API de Claude · Vercel.

> La primera versión del frontend se hizo en Angular; sigue en el historial de git (primeros commits).

---

## Cómo funciona

```
Usuario ──► App React (Vercel) ──► Supabase
                                      ├─ Auth (email/contraseña, Google)
                                      ├─ Postgres con Row Level Security
                                      │    topics, questions, profiles, progress,
                                      │    wrong_answers, reports, grading_usage
                                      └─ Edge Function "grade" ──► API de Claude
```

- **Las preguntas viven en la base de datos.** Si corriges una desde el panel de admin, los usuarios ven el cambio al instante, sin volver a desplegar.
- **Solo despliegas cuando cambias el código.** Cada `git push` a `main` publica la web automáticamente.
- **La seguridad está en la base de datos**, no en la pantalla. Un usuario normal no puede editar preguntas, ver reportes de otros, cambiarse el rol ni inventarse XP, aunque llame a la API directamente. `npm run test:db` lo comprueba.

---

## Puesta en marcha (una sola vez)

Necesitas: Node 22.12 o superior, Python 3, y cuentas en GitHub, [Supabase](https://supabase.com), [Vercel](https://vercel.com) y la [consola de Anthropic](https://console.anthropic.com).

### 1. Base de datos en Supabase

1. Crea un proyecto en Supabase. Elige una **región de la UE** (Frankfurt o París), porque tus usuarios están en España.
2. Abre **SQL Editor** y ejecuta, en orden, cada archivo de `supabase/migrations/` (primero `20261013000000_init.sql`, después `20261013170000_spanish_variants.sql`).
3. Genera la carga de preguntas desde el Excel y ejecútala también en el SQL Editor:
   ```bash
   pip install openpyxl
   npm run import -- ruta/a/Temario_mockinter.xlsx      # crea supabase/seed.sql
   ```
   Copia el contenido de `supabase/seed.sql` en el SQL Editor y ejecútalo.
   Puedes volver a ejecutar `seed.sql` cuando quieras: no duplica preguntas ni pisa lo que hayas editado desde el panel; solo rellena lo que falte (por ejemplo, el contenido en español).

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

### 4. Función de corrección con IA

1. Crea una clave en la consola de Anthropic y **pon un límite de gasto mensual** en Billing.
2. Instala la [CLI de Supabase](https://supabase.com/docs/guides/cli) y despliega la función:
   ```bash
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set DAILY_GRADING_LIMIT=15          # opcional: correcciones por usuario y día
   supabase secrets set ANTHROPIC_MODEL=claude-haiku-5-5 # opcional: el modelo más barato es suficiente
   supabase functions deploy grade
   ```
La clave nunca llega al navegador. Si la función falla o el usuario agota su límite diario, la app muestra la respuesta modelo para que se autoevalúe.

### 5. Conecta la app con Supabase

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

### 6. Publica en internet

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

**Cambios masivos desde el Excel:** edita el Excel, ejecuta `npm run import -- Temario_mockinter.xlsx` y ejecuta el `seed.sql` resultante. Por defecto **no** sobrescribe las preguntas que ya existen, para no pisar lo que hayas cambiado desde el panel. Con `--overwrite`, el Excel manda.

---

## Antes de lanzar: lista de comprobación

- [ ] Completa los `[CORCHETES]` de `src/pages/Privacy.tsx` (tu nombre, fecha, proveedores y regiones).
- [ ] SMTP propio configurado en Supabase.
- [ ] Límite de gasto en la consola de Anthropic y `DAILY_GRADING_LIMIT` ajustado.
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
  pages/       login, onboarding, inicio, lección, ajustes, privacidad
               lessonReducer.ts: la lógica de la lección como reducer puro, con sus tests
  admin/       panel: reportes, lista de preguntas, editor
  components/  logo, diálogo de reporte, texto con `código`
supabase/
  migrations/  esquema, reglas de acceso (RLS) y funciones SQL
  functions/   grade: corrección con la API de Claude
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

- **Onboarding:** puesto (Angular, React, Cloud/DevOps, Backend), nivel (Junior, Mid, Senior) e idioma de la entrevista. Se puede cambiar desde Ajustes.
- **Entrevista en español:** se oculta el bloque de inglés, las respuestas abiertas se escriben y corrigen en español, y las preguntas con frases en inglés usan su variante española (columnas *Variante ES* del Excel o sección plegable del editor).
- **Camino de lecciones:** "Presentación y STAR", luego los 6 temas del puesto, después "Preguntas difíciles" e "Inglés de entrevista". Este último se oculta si la entrevista es en español.
- **Cada lección:** las preguntas activas de ese tema y nivel. Primero las cerradas, barajadas, y la abierta al final. Cada fallo cuesta una vida y la pregunta vuelve al final de la cola.
- **XP y racha:** se guardan en el servidor al terminar la lección, con la fecha de Madrid y un tope por lección.
