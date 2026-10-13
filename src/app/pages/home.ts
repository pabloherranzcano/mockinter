import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ContentService, PathTopic, todayMadrid, yesterdayMadrid } from '../core/content.service';
import { ROLES } from '../core/models';
import { Logo } from '../shared/logo';

const GOAL = 50;

@Component({
  selector: 'app-home',
  imports: [RouterLink, Logo],
  template: `
  <main class="wrap">
    <header class="top">
      <app-logo />
      <div class="stats">
        <div class="stat" title="Días seguidos practicando">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.3-4.8.2 1.6.9 2.6 1.9 3C10.6 7.4 11.3 4.6 12 2z" fill="var(--accent)"/><path d="M12 13c.6 1.6 2.4 2.2 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1.5.9-2.6 2.4-4.2z" fill="var(--accent-deep)"/></svg>
          <span>{{ streak() }}</span>
        </div>
        <div class="stat" title="Experiencia total">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="var(--navy)"/></svg>
          <span>{{ p()?.xp ?? 0 }} XP</span>
        </div>
        @if (auth.isAdmin()) {
          <a class="icon-btn" routerLink="/admin" aria-label="Panel de admin" title="Panel de admin">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/></svg>
          </a>
        }
        <a class="icon-btn" routerLink="/ajustes" aria-label="Ajustes" title="Ajustes">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
        </a>
      </div>
    </header>

    <section class="goal">
      <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="8"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="163.4" [attr.stroke-dashoffset]="ringOffset()" transform="rotate(-90 32 32)"/>
        <text x="32" y="37" text-anchor="middle" font-family="Figtree, sans-serif" font-weight="700" font-size="14" fill="currentColor">{{ todayXp() }}</text>
      </svg>
      <div>
        <h2>{{ goalTitle() }}</h2>
        <p>{{ goalSub() }}</p>
      </div>
      <div class="actions">
        @if (nextTopic(); as t) { <a class="btn" [routerLink]="['/leccion', t.id]">{{ startLabel() }}</a> }
      </div>
    </section>

    <p class="eyebrow" style="margin-top:24px">{{ roleName() }} · {{ p()?.level }} · {{ englishLabel() }}
      · <a routerLink="/ajustes">cambiar</a></p>

    @if (error()) { <div class="error" style="margin-top:16px">{{ error() }}</div> }
    @if (loading()) { <p class="muted" style="margin-top:24px">Cargando tu camino…</p> }

    <div class="path">
      @for (t of topics(); track t.id; let i = $index) {
        <div class="stop">
          <a class="node" [class.done]="t.stars > 0" [class.next]="t.id === nextTopic()?.id && !t.stars"
             [routerLink]="['/leccion', t.id]" [attr.aria-label]="'Lección ' + (i + 1) + ': ' + t.name">
            @if (t.stars > 0) {
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            } @else { {{ i + 1 }} }
          </a>
          <div class="info">
            <div class="eyebrow">Lección {{ i + 1 }} · {{ t.role === 'COM' ? 'Para cualquier puesto' : t.role_name }}
              @if (t.stars > 0) {
                <span class="stars" [attr.aria-label]="t.stars + ' de 3 estrellas'">
                  @for (n of [1,2,3]; track n) { <i [class.on]="n <= t.stars"></i> }
                </span>
              }
            </div>
            <h3>{{ t.name }}</h3>
            @if (t.id === nextTopic()?.id && !t.stars) { <span class="tag">Siguiente</span> }
          </div>
        </div>
      }
    </div>

    @if (wrong() > 0) {
      <a class="btn ghost full" style="margin-top:24px" routerLink="/repaso">Repasar mis fallos ({{ wrong() }})</a>
    }
  </main>`,
})
export class HomePage implements OnInit {
  readonly auth = inject(AuthService);
  private content = inject(ContentService);
  readonly p = this.auth.profile;
  readonly topics = signal<PathTopic[]>([]);
  readonly wrong = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly streak = computed(() => {
    const p = this.p();
    return p && (p.last_day === todayMadrid() || p.last_day === yesterdayMadrid()) ? p.streak : 0;
  });
  readonly todayXp = computed(() => (this.p()?.day_xp_date === todayMadrid() ? this.p()!.day_xp : 0));
  readonly ringOffset = computed(() => (163.4 * (1 - Math.min(1, this.todayXp() / GOAL))).toFixed(1));
  readonly nextTopic = computed<PathTopic | undefined>(() => this.topics().find((t) => !t.stars) ?? this.topics()[0]);
  readonly roleName = computed(() => ROLES.find((r) => r.code === this.p()?.target_role)?.name ?? '');
  readonly englishLabel = computed(() => (this.p()?.english === 'no' ? 'entrevista en español' : 'entrevista en inglés'));
  readonly startLabel = computed(() => (this.topics().every((t) => t.stars) ? 'Practicar' : this.topics().some((t) => t.stars) ? 'Seguir' : 'Empezar'));
  readonly goalTitle = computed(() => {
    const p = this.p(); const tx = this.todayXp();
    if (tx >= GOAL) return 'Meta de hoy cumplida';
    if (this.streak() > 0 && p?.last_day !== todayMadrid()) return `Mantén tu racha de ${p!.streak} ${p!.streak === 1 ? 'día' : 'días'}`;
    return `Meta diaria: ${GOAL} XP`;
  });
  readonly goalSub = computed(() => {
    const tx = this.todayXp();
    if (tx >= GOAL) return `${tx} XP hoy. Mañana, otra.`;
    return tx ? `Llevas ${tx} XP hoy. Te faltan ${GOAL - tx}.` : 'Una lección son unos 5 minutos. Haz una para empezar.';
  });

  async ngOnInit() {
    const p = this.p();
    if (!p) return;
    try {
      const [topics, wrong] = await Promise.all([this.content.pathTopics(p), this.content.wrongCount()]);
      this.topics.set(topics); this.wrong.set(wrong);
    } catch {
      this.error.set('No se pudo cargar tu camino. Recarga la página.');
    } finally { this.loading.set(false); }
  }
}
