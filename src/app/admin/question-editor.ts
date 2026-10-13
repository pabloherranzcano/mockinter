import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { Level, QType, Question, REASONS, Report, Topic, TYPE_LABELS } from '../core/models';

const blank = (): Question => ({
  id: '', topic_id: '', level: 'Mid', type: 'mc', prompt: '', prompt_en: null, correct: '', wrong: ['', '', ''],
  explanation: '', say_en: null, say_es: null, keys: null, model_en: null, model_es: null, status: 'reviewed', active: true,
});

@Component({
  selector: 'app-question-editor',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
  <div class="row" style="margin-top:18px">
    <a class="link small" routerLink="/admin/preguntas">← Preguntas</a>
  </div>
  @if (loading()) { <p class="muted">Cargando…</p> }
  @else if (notFound()) { <div class="error" style="margin-top:12px">No existe la pregunta {{ id() }}.</div> }
  @else {
    <div class="row" style="margin-top:8px">
      <h2 style="font-size:1.5rem">{{ isNew() ? 'Nueva pregunta' : 'Editar pregunta' }}</h2>
      @if (!isNew()) { <code>{{ q.id }}</code> }
      <span class="spacer"></span>
      <label class="row small" style="gap:8px;font-weight:600">Visible
        <span class="switch"><input id="q-active" type="checkbox" [(ngModel)]="q.active" /><span></span></span>
      </label>
    </div>

    <form class="editor" style="margin-top:16px" (ngSubmit)="save()">
      <div class="card stack">
        <div class="grid2">
          <label class="field">Tema
            <select id="ed-topic" name="topic" [(ngModel)]="q.topic_id" required>
              <option value="" disabled>Elige un tema</option>
              @for (t of topics(); track t.id) { <option [value]="t.id">{{ t.role_name }} · {{ t.name }}</option> }
            </select>
          </label>
          <label class="field">Nivel
            <select id="ed-level" name="level" [(ngModel)]="q.level"><option>Junior</option><option>Mid</option><option>Senior</option></select>
          </label>
          <label class="field">Tipo
            <select id="ed-type" name="type" [(ngModel)]="q.type" [disabled]="!isNew()">
              @for (t of types; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }
            </select>
          </label>
          <label class="field">Revisión
            <select id="ed-status" name="status" [(ngModel)]="q.status">
              <option value="pending">Pendiente de revisar</option><option value="reviewed">Revisada</option><option value="discarded">Descartada</option>
            </select>
          </label>
        </div>

        <label class="field">{{ q.type === 'fill' ? 'Frase (pon ___ donde va el hueco)' : 'Pregunta (en español)' }}
          <textarea id="ed-prompt" name="prompt" [(ngModel)]="q.prompt" required style="min-height:80px"></textarea>
        </label>

        @switch (q.type) {
          @case ('order') {
            <label class="field">Piezas en el orden correcto (una por línea)
              <textarea id="ed-items" name="items" [(ngModel)]="orderText" style="min-height:140px"></textarea>
            </label>
          }
          @case ('open') {
            <label class="field">Pregunta original en inglés
              <input id="ed-prompt-en" name="prompt_en" type="text" [(ngModel)]="q.prompt_en" />
            </label>
            <label class="field">Puntos clave (guían la corrección automática)
              <textarea id="ed-keys" name="keys" [(ngModel)]="q.keys"></textarea>
            </label>
            <label class="field">Respuesta modelo en inglés
              <textarea id="ed-model-en" name="model_en" [(ngModel)]="q.model_en" style="min-height:140px"></textarea>
            </label>
            <label class="field">Respuesta modelo en español (para entrevistas en español)
              <textarea id="ed-model-es" name="model_es" [(ngModel)]="q.model_es" style="min-height:140px"></textarea>
            </label>
          }
          @default {
            <label class="field">Respuesta correcta
              <input id="ed-correct" name="correct" type="text" [(ngModel)]="q.correct" required />
            </label>
            @for (w of q.wrong; track $index; let i = $index) {
              <div class="row" style="align-items:end">
                <label class="field" style="flex:1">Incorrecta {{ i + 1 }}
                  <input [id]="'ed-wrong-' + i" [name]="'wrong' + i" type="text" [(ngModel)]="q.wrong[i]" />
                </label>
                @if (q.wrong.length > 1) { <button type="button" class="btn ghost sm" (click)="q.wrong.splice(i, 1)" [attr.aria-label]="'Quitar incorrecta ' + (i + 1)">Quitar</button> }
              </div>
            }
            @if (q.wrong.length < 5) { <button type="button" class="link small" style="justify-self:start" (click)="q.wrong.push('')">+ Añadir opción incorrecta</button> }
          }
        }

        @if (q.type !== 'open') {
          <label class="field">Explicación (se muestra tras responder)
            <textarea id="ed-expl" name="explanation" [(ngModel)]="q.explanation"></textarea>
          </label>
          <div class="grid2">
            <label class="field">Frase ejemplo para decir (inglés, opcional)
              <textarea id="ed-say-en" name="say_en" [(ngModel)]="q.say_en" style="min-height:80px"></textarea>
            </label>
            <label class="field">Traducción del ejemplo
              <textarea id="ed-say-es" name="say_es" [(ngModel)]="q.say_es" style="min-height:80px"></textarea>
            </label>
          </div>
        }

        @if (error()) { <div class="error">{{ error() }}</div> }
        @if (saved()) { <div class="notice">Guardada. Los usuarios ya ven la nueva versión.</div> }
        <div class="row">
          <a class="btn ghost" routerLink="/admin/preguntas">Cancelar</a>
          <span class="spacer"></span>
          <button type="submit" class="btn" [disabled]="busy()">{{ busy() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>

      <aside class="stack">
        <div class="card stack">
          <p class="eyebrow" style="margin:0">Reportes de esta pregunta</p>
          @for (r of reports(); track r.id) {
            <div class="report-item">
              <div class="small"><strong>{{ reasonLabel(r.reason) }}</strong> · <span class="muted">{{ r.created_at | date: 'd MMM' }}</span>
                @if (r.status !== 'open') { · <span class="muted">{{ r.status === 'resolved' ? 'resuelto' : 'descartado' }}</span> }</div>
              @if (r.comment) { <p style="margin:4px 0 0" class="small">{{ r.comment }}</p> }
            </div>
          } @empty { <p class="muted small" style="margin:0">Sin reportes.</p> }
          @if (openReports().length) {
            <button type="button" class="btn ok sm" (click)="resolveAll()">Marcar {{ openReports().length }} como resueltos</button>
          }
        </div>
        @if (q.updated_at) { <p class="muted small">Última edición: {{ q.updated_at | date: 'd MMM y, HH:mm' }}</p> }
      </aside>
    </form>
  }`,
})
export class QuestionEditor implements OnInit {
  private content = inject(ContentService);
  private router = inject(Router);
  /** :id de la ruta, o 'nueva'. */
  readonly id = input.required<string>();
  readonly isNew = computed(() => this.id() === 'nueva');
  readonly types = Object.entries(TYPE_LABELS) as [QType, string][];
  readonly topics = signal<Topic[]>([]);
  readonly reports = signal<Report[]>([]);
  readonly openReports = computed(() => this.reports().filter((r) => r.status === 'open'));
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  q: Question = blank();
  orderText = '';

  async ngOnInit() {
    try {
      this.topics.set(await this.content.allTopics());
      if (!this.isNew()) {
        const q = await this.content.question(this.id());
        if (!q) { this.notFound.set(true); return; }
        this.q = { ...q, wrong: q.wrong.length ? [...q.wrong] : [''] };
        if (q.type === 'order') this.orderText = (q.correct ?? '').split(' | ').join('\n');
        const all = await this.content.reports('all');
        this.reports.set(all.filter((r) => r.question_id === q.id));
      }
    } finally { this.loading.set(false); }
  }

  reasonLabel(r: string) { return REASONS.find((x) => x.code === r)?.label ?? r; }

  private validate(): string | null {
    const q = this.q;
    if (!q.topic_id) return 'Elige un tema.';
    if (!q.prompt.trim()) return 'Escribe la pregunta.';
    if (q.type === 'fill' && !q.prompt.includes('___')) return 'La frase necesita ___ donde va el hueco.';
    if (q.type === 'mc' || q.type === 'fill') {
      if (!q.correct?.trim()) return 'Falta la respuesta correcta.';
      if (!q.wrong.some((w) => w.trim())) return 'Añade al menos una opción incorrecta.';
    }
    if (q.type === 'order' && this.orderText.split('\n').filter((l) => l.trim()).length < 2) return 'Pon al menos dos piezas, una por línea.';
    if (q.type === 'open' && !q.keys?.trim() && !q.model_en?.trim()) return 'Añade puntos clave o una respuesta modelo.';
    return null;
  }

  async save() {
    this.error.set(''); this.saved.set(false);
    const problem = this.validate();
    if (problem) { this.error.set(problem); return; }
    const q: Question = {
      ...this.q,
      wrong: this.q.type === 'mc' || this.q.type === 'fill' ? this.q.wrong.map((w) => w.trim()).filter(Boolean) : [],
      correct: this.q.type === 'order'
        ? this.orderText.split('\n').map((l) => l.trim()).filter(Boolean).join(' | ')
        : this.q.type === 'open' ? null : this.q.correct?.trim() ?? null,
    };
    this.busy.set(true);
    try {
      if (this.isNew()) q.id = await this.content.nextQuestionId(q.topic_id, q.level as Level);
      const saved = await this.content.saveQuestion(q, this.isNew());
      this.saved.set(true);
      if (this.isNew()) await this.router.navigate(['/admin/preguntas', saved.id]);
      else this.q = { ...saved, wrong: saved.wrong.length ? [...saved.wrong] : [''] };
    } catch (e: any) {
      this.error.set('No se pudo guardar: ' + (e?.message ?? 'error desconocido'));
    } finally { this.busy.set(false); }
  }

  async resolveAll() {
    await this.content.setReportStatus(this.openReports().map((r) => r.id), 'resolved');
    const all = await this.content.reports('all');
    this.reports.set(all.filter((r) => r.question_id === this.q.id));
  }
}
