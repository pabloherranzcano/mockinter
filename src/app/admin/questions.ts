import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { Question, Topic, TYPE_LABELS } from '../core/models';

@Component({
  selector: 'app-admin-questions',
  imports: [FormsModule, RouterLink],
  template: `
  <div class="row" style="margin-top:18px">
    <h2 style="font-size:1.5rem">Preguntas</h2>
    <span class="badge soft">{{ filtered().length }} de {{ all().length }}</span>
    <span class="spacer"></span>
    <a class="btn sm" routerLink="/admin/preguntas/nueva">Nueva pregunta</a>
  </div>

  <div class="filters">
    <label class="field">Buscar <input id="q-search" type="search" [(ngModel)]="search" placeholder="Texto o ID" /></label>
    <label class="field">Puesto
      <select id="q-role" [(ngModel)]="role">
        <option value="">Todos</option>
        @for (r of roles(); track r.code) { <option [value]="r.code">{{ r.name }}</option> }
      </select>
    </label>
    <label class="field">Tema
      <select id="q-topic" [(ngModel)]="topicId">
        <option value="">Todos</option>
        @for (t of topicsForRole(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
      </select>
    </label>
    <label class="field">Nivel
      <select id="q-level" [(ngModel)]="level"><option value="">Todos</option><option>Junior</option><option>Mid</option><option>Senior</option></select>
    </label>
    <label class="field">Estado
      <select id="q-state" [(ngModel)]="state">
        <option value="">Todas</option><option value="active">Visibles</option><option value="hidden">Ocultas</option>
        <option value="pending">Pendientes de revisar</option><option value="reviewed">Revisadas</option><option value="reported">Con reportes abiertos</option>
      </select>
    </label>
  </div>

  @if (error()) { <div class="error">{{ error() }}</div> }
  @if (loading()) { <p class="muted">Cargando…</p> }

  <div class="table-wrap">
    <table>
      <thead><tr><th>Visible</th><th>ID</th><th>Pregunta</th><th>Tipo</th><th>Nivel</th><th>Revisión</th><th>Reportes</th></tr></thead>
      <tbody>
        @for (q of filtered(); track q.id) {
          <tr [class.hidden-row]="!q.active">
            <td>
              <label class="switch" [attr.aria-label]="(q.active ? 'Ocultar ' : 'Mostrar ') + q.id">
                <input type="checkbox" [checked]="q.active" (change)="toggle(q, $any($event.target).checked)" /><span></span>
              </label>
            </td>
            <td class="id">{{ q.id }}</td>
            <td><a [routerLink]="['/admin/preguntas', q.id]">{{ q.prompt }}</a></td>
            <td class="small">{{ typeLabel(q.type) }}</td>
            <td class="small">{{ q.level }}</td>
            <td class="small">{{ q.status === 'reviewed' ? 'Revisada' : q.status === 'discarded' ? 'Descartada' : 'Pendiente' }}</td>
            <td>@if (reports().get(q.id); as n) { <span class="badge">{{ n }}</span> }</td>
          </tr>
        } @empty {
          @if (!loading()) { <tr><td colspan="7" class="muted">Ninguna pregunta coincide con los filtros.</td></tr> }
        }
      </tbody>
    </table>
  </div>`,
})
export class AdminQuestions implements OnInit {
  private content = inject(ContentService);
  readonly all = signal<Question[]>([]);
  readonly topics = signal<Topic[]>([]);
  readonly reports = signal<Map<string, number>>(new Map());
  readonly loading = signal(true);
  readonly error = signal('');

  // filtros (signals para que la tabla se recalcule)
  private readonly f = signal({ search: '', role: '', topicId: '', level: '', state: '' });
  get search() { return this.f().search; } set search(v: string) { this.f.update((x) => ({ ...x, search: v })); }
  get role() { return this.f().role; } set role(v: string) { this.f.update((x) => ({ ...x, role: v, topicId: '' })); }
  get topicId() { return this.f().topicId; } set topicId(v: string) { this.f.update((x) => ({ ...x, topicId: v })); }
  get level() { return this.f().level; } set level(v: string) { this.f.update((x) => ({ ...x, level: v })); }
  get state() { return this.f().state; } set state(v: string) { this.f.update((x) => ({ ...x, state: v })); }

  readonly roles = computed(() => {
    const m = new Map<string, string>();
    for (const t of this.topics()) m.set(t.role, t.role_name);
    return [...m].map(([code, name]) => ({ code, name }));
  });
  readonly topicsForRole = computed(() => this.topics().filter((t) => !this.f().role || t.role === this.f().role));
  readonly filtered = computed(() => {
    const { search, role, topicId, level, state } = this.f();
    const s = search.trim().toLowerCase();
    const rep = this.reports();
    return this.all().filter((q) =>
      (!role || q.topic_id.startsWith(role + '-')) &&
      (!topicId || q.topic_id === topicId) &&
      (!level || q.level === level) &&
      (!state || (state === 'active' ? q.active : state === 'hidden' ? !q.active : state === 'reported' ? rep.has(q.id) : q.status === state)) &&
      (!s || q.id.toLowerCase().includes(s) || q.prompt.toLowerCase().includes(s) || (q.correct ?? '').toLowerCase().includes(s)));
  });

  async ngOnInit() {
    try {
      const [qs, ts, rep] = await Promise.all([this.content.adminQuestions(), this.content.allTopics(), this.content.openReportCounts()]);
      this.all.set(qs); this.topics.set(ts); this.reports.set(rep);
    } catch { this.error.set('No se pudieron cargar las preguntas.'); }
    finally { this.loading.set(false); }
  }

  typeLabel(t: Question['type']) { return TYPE_LABELS[t]; }

  async toggle(q: Question, active: boolean) {
    try {
      await this.content.setActive(q.id, active);
      this.all.update((list) => list.map((x) => (x.id === q.id ? { ...x, active } : x)));
    } catch { this.error.set('No se pudo cambiar la visibilidad.'); }
  }
}
