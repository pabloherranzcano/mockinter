# Racha

Lecciones de 5 minutos para preparar entrevistas técnicas (Angular, React, Cloud/DevOps y Backend Java/Spring), con rachas, XP, vidas, corrección de respuestas abiertas con IA y un panel de admin para mantener las preguntas.

**Stack:** Angular 21 (standalone, signals, zoneless) · Supabase (Postgres, Auth, Edge Functions) · API de Claude · Vercel.

---

## Cómo funciona

```
Usuario ──► App Angular (Vercel) ──► Supabase
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
2. Abre **SQL Editor** y ejecuta el contenido de `supabase/migrations/20261013000000_init.sql`.
3. Genera la carga de preguntas desde el Excel y ejecútala también en el SQL Editor:
   ```bash
   pip install openpyxl
   npm run import -- ruta/a/Temario_Racha.xlsx      # crea supabase/seed.sql
   ```
   Copia el contenido de `supabase/seed.sql` en el SQL Editor y ejecútalo.

### 2. Autenticación

En **Authentication → URL Configuration**:
- **Site URL:** la URL de tu web, por ejemplo `https://racha.vercel.app` (o tu dominio).
- **Redirect URLs:** añade esa misma URL y `http://localhost:4200` para desarrollar.

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

Edita `src/environments/environment.ts` con los datos de **Project Settings → API**:

```ts
supabaseUrl: 'https://xxxx.supabase.co',
supabaseAnonKey: 'eyJ...',            // la clave "anon" / "publishable": es pública por diseño
contactEmail: 'tu-email@ejemplo.com', // aparece en la política de privacidad
```

Pruébala en local:

```bash
npm install
npm start          # http://localhost:4200
```

### 6. Publica en internet

1. Sube el proyecto a GitHub:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/racha.git
   git push -u origin main
   ```
2. En Vercel: **Add New → Project**, importa el repositorio y pulsa **Deploy**. `vercel.json` ya indica el comando de build y la carpeta de salida.
3. Copia la URL que te da Vercel en **Site URL** y **Redirect URLs** de Supabase (paso 2).
4. **Dominio propio** (opcional): cómpralo en cualquier registrador y añádelo en Vercel → Settings → Domains. Recuerda actualizar también las URLs en Supabase.

A partir de aquí, cada `git push` a `main` despliega solo, y cada pull request genera una URL de prueba.

> **Netlify o Cloudflare Pages** también sirven: comando `npm run build`, carpeta `dist/racha/browser`. El archivo `public/_redirects` ya está incluido para Netlify.

---

## Día a día: mantener las preguntas

1. Un usuario pulsa **"Reportar un problema con esta pregunta"** tras responder y elige el motivo (respuesta incorrecta, no se entiende, errata, sugerencia u otro), con un comentario opcional.
2. Tú entras en **Admin → Reportes**: los reportes salen agrupados por pregunta, con las más reportadas primero.
3. Pulsas **Editar pregunta**, corriges el texto o las opciones y guardas. El cambio está en vivo al momento.
4. Marcas los reportes como **resueltos** (o **descartados** si no tenían razón).

En **Admin → Preguntas** puedes filtrar por puesto, tema, nivel o estado, **ocultar o mostrar** cualquier pregunta con un interruptor, y crear preguntas nuevas. El ID se asigna solo.

**Cambios masivos desde el Excel:** edita el Excel, ejecuta `npm run import -- Temario_Racha.xlsx` y ejecuta el `seed.sql` resultante. Por defecto **no** sobrescribe las preguntas que ya existen, para no pisar lo que hayas cambiado desde el panel. Con `--overwrite`, el Excel manda.

---

## Antes de lanzar: lista de comprobación

- [ ] Completa los `[CORCHETES]` de `src/app/pages/privacy.ts` (tu nombre, fecha, proveedores y regiones).
- [ ] SMTP propio configurado en Supabase.
- [ ] Límite de gasto en la consola de Anthropic y `DAILY_GRADING_LIMIT` ajustado.
- [ ] Rellena la columna **Respuesta modelo (ES)** del Excel para quien tenga la entrevista en español. Si está vacía, se le muestra la inglesa.
- [ ] Revisa las preguntas (Estado = Revisada) o, como mínimo, las de los temas que vayas a anunciar primero.
- [ ] Prueba el flujo completo con una cuenta normal: registro, onboarding, lección, reporte y borrar cuenta.

---

## Desarrollo

```bash
npm start          # servidor de desarrollo
npm test           # tests unitarios (Vitest)
npm run test:db    # esquema y reglas de seguridad en un Postgres en memoria
npm run build      # build de producción en dist/racha/browser
```

### Estructura

```
src/app/
  core/        servicios (auth, contenido), modelos y guards
  pages/       login, onboarding, inicio, lección, ajustes, privacidad
  admin/       panel: reportes, lista de preguntas, editor
  shared/      logo, diálogo de reporte, texto con `código`
supabase/
  migrations/  esquema, reglas de acceso (RLS) y funciones SQL
  functions/   grade: corrección con la API de Claude
  seed.sql     preguntas generadas desde el Excel
scripts/
  import_xlsx.py  Excel → seed.sql
  test-db.mjs     pruebas de la base de datos
```

### Cómo se decide qué ve cada usuario

- **Onboarding:** puesto (Angular, React, Cloud/DevOps, Backend), nivel (Junior, Mid, Senior) e idioma de la entrevista. Se puede cambiar desde Ajustes.
- **Camino de lecciones:** "Presentación y STAR", luego los 6 temas del puesto, después "Preguntas difíciles" e "Inglés de entrevista". Este último se oculta si la entrevista es en español.
- **Cada lección:** las preguntas activas de ese tema y nivel. Primero las cerradas, barajadas, y la abierta al final. Cada fallo cuesta una vida y la pregunta vuelve al final de la cola.
- **XP y racha:** se guardan en el servidor al terminar la lección, con la fecha de Madrid y un tope por lección.
