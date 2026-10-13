import { Component, HostListener, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ContentService, shuffle } from '../core/content.service';
import { Grade, Question, Topic } from '../core/models';
import { Rich } from '../shared/rich';
import { ReportDialog } from '../shared/report-dialog';

const HEARTS = 5;
const PASS = 55;

interface Feedback {
  kind: 'ok' | 'bad' | 'open';
  title: string;
  solution?: string;
  why?: string | null;
  say?: { label: string; en: string; es: string | null } | null;
  xp?: number;
}

@Component({
  selector: 'app-lesson',
  imports: [FormsModule, RouterLink, Rich, ReportDialog],
  template: `
  @if (phase() === 'loading') {
    <main class="wrap"><p class="muted">Preparando la lección…</p></main>
  } @else if (phase() === 'empty') {
    <main class="result">
      <h2>{{ review() ? 'No tienes fallos que repasar' : 'Esta lección aún no tiene preguntas' }}</h2>
      <p class="muted">{{ review() ? 'Cuando falles alguna pregunta, aparecerá aquí.' : 'Estamos preparando el contenido de este tema para tu nivel.' }}</p>
      <a class="btn" routerLink="/">Volver al inicio</a>
    </main>
  } @else if (phase() === 'dead') {
    <main class="result">
      <h2>Te quedaste sin vidas</h2>
      <p class="muted">Las preguntas que fallaste quedan en tu repaso. La segunda vez entra mejor.</p>
      <div class="stack" style="margin-top:28px">
        <button class="btn" (click)="start()">Reintentar</button>
        <a class="btn ghost" routerLink="/">Volver al inicio</a>
      </div>
    </main>
  } @else if (phase() === 'result') {
    <main class="result">
      <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" style="margin:0 auto 12px;display:block">
        @for (i of rays; track i) { <rect x="57" y="4" width="6" height="18" rx="3" fill="var(--accent)" [attr.opacity]="i % 2 ? .45 : .9" [attr.transform]="'rotate(' + i * 30 + ' 60 60)'"/> }
        <circle cx="60" cy="60" r="30" fill="var(--navy)"/>
        <path d="M47 61l9 9 18-20" fill="none" stroke="var(--navy-ink)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h2>{{ review() ? '¡Repaso hecho!' : '¡Lección completada!' }}</h2>
      <p class="muted">{{ topic()?.name ?? 'Lo que acertaste sale de tu lista de fallos.' }}{{ bonus() ? ' · sin fallos, +10 XP extra' : '' }}</p>
      <div class="tiles">
        <div class="tile amber"><div class="lab">XP</div><div class="val">+{{ xp() }}</div></div>
        <div class="tile green"><div class="lab">Acierto</div><div class="val">{{ accuracy() }}%</div></div>
        <div class="tile"><div class="lab">Racha</div><div class="val">{{ auth.profile()?.streak ?? 0 }}</div></div>
      </div>
      @if (saveError()) { <div class="error" style="margin-bottom:16px">{{ saveError() }}</div> }
      <a class="btn full" routerLink="/">Continuar</a>
    </main>
  } @else if (current(); as q) {
    <main class="lesson">
      <div class="lbar">
        <a class="x" routerLink="/" aria-label="Salir de la lección">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </a>
        <div class="prog" role="progressbar" [attr.aria-valuenow]="done()" [attr.aria-valuemax]="total()"><span [style.width.%]="100 * done() / total()"></span></div>
        <div class="hearts" title="Vidas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>{{ hearts() }}</div>
      </div>

      @switch (q.type) {
        @case ('mc') {
          <div class="kind">Elige la respuesta</div>
          <div class="q"><app-rich [text]="q.prompt" /></div>
          <div class="opts">
            @for (o of options(); track o.text; let i = $index) {
              <button class="opt" [class.code]="looksLikeCode(o.text)" [class.sel]="selected() === i && !feedback()"
                [class.right]="feedback() && o.correct" [class.wrong]="feedback() && selected() === i && !o.correct"
                [disabled]="!!feedback()" (click)="selected.set(i)">
                <span class="k">{{ i + 1 }}</span><span class="t">{{ o.text }}</span>
              </button>
            }
          </div>
        }
        @case ('fill') {
          <div class="kind">Completa la frase</div>
          <div class="sentence" [class.mono]="looksLikeCode(q.prompt)">
            {{ fillParts()[0] }}<span class="blank">{{ selected() !== null ? options()[selected()!].text : ' ' }}</span>{{ fillParts()[1] }}
          </div>
          <div class="chips">
            @for (o of options(); track o.text; let i = $index) {
              <button class="chip" [class.sel]="selected() === i && !feedback()" [class.right]="feedback() && o.correct"
                [class.wrong]="feedback() && selected() === i && !o.correct" [disabled]="!!feedback()" (click)="selected.set(i)">{{ o.text }}</button>
            }
          </div>
        }
        @case ('order') {
          <div class="kind">Ordena las piezas</div>
          <div class="q">{{ q.prompt }}</div>
          <div class="answer-row">
            @for (idx of placed(); track idx; let n = $index) {
              <button class="chip" [disabled]="!!feedback()" (click)="unplace(n)"><em>{{ n + 1 }}</em><span>{{ orderItems()[idx] }}</span></button>
            } @empty { <span class="muted small" style="padding:8px">Toca las piezas en orden</span> }
          </div>
          <div class="bank">
            @for (idx of bank(); track idx) {
              <button class="chip" [class.used]="placed().includes(idx)" [disabled]="!!feedback()" (click)="place(idx)">{{ orderItems()[idx] }}</button>
            }
          </div>
        }
        @case ('open') {
          <div class="kind">Pregunta de entrevista</div>
          <div class="q">{{ q.prompt }}</div>
          @if (lang() === 'en' && q.prompt_en) { <div class="q-sub">En la entrevista: “{{ q.prompt_en }}”</div> }
          <div class="q-sub">{{ lang() === 'en' ? 'Respóndelo en inglés, como lo dirías en voz alta.' : 'Respóndelo como lo dirías en voz alta.' }}</div>
          <textarea id="open-answer" [(ngModel)]="openAnswer" [readonly]="grading() || !!grade() || selfAssess()"
            [placeholder]="lang() === 'en' ? 'Write your answer in English…' : 'Escribe tu respuesta…'" aria-label="Tu respuesta"></textarea>
          @if (grading()) {
            <div class="thinking"><span class="dots"><i></i><i></i><i></i></span>Tu entrevistador está leyendo la respuesta…</div>
          }
          @if (gradeNote()) { <p class="small muted">{{ gradeNote() }}</p> }
          @if (grade(); as g) {
            <div class="grade">
              <div class="score">
                <div class="num" [style.color]="scoreColor(g.score)">{{ g.score }}</div>
                <div class="meter"><span [style.width.%]="g.score" [style.background]="scoreColor(g.score)"></span></div>
              </div>
              @if (g.strengths.length) { <div><h4>Lo que funciona</h4><ul>@for (s of g.strengths; track $index) {<li>{{ s }}</li>}</ul></div> }
              @if (g.improve.length) { <div><h4>Para mejorar</h4><ul>@for (s of g.improve; track $index) {<li>{{ s }}</li>}</ul></div> }
              @if (g.language.length) {
                <div><h4>Inglés</h4>@for (f of g.language; track $index) {<div class="fix"><s>{{ f.wrong }}</s>→<b>{{ f.right }}</b></div>}</div>
              }
              @if (g.better) { <div><h4>Tu respuesta, mejorada</h4><div class="better">{{ g.better }}</div></div> }
            </div>
          }
          @if (selfAssess()) {
            <div class="grade">
              <div><h4>Respuesta modelo</h4><div class="better">{{ modelAnswer() }}</div></div>
              @if (q.keys) { <div><h4>Una buena respuesta incluye</h4><p style="margin:0">{{ q.keys }}</p></div> }
            </div>
          }
        }
      }
    </main>

    <div class="footer" [class.ok]="feedback()?.kind === 'ok'" [class.bad]="feedback()?.kind === 'bad'">
      <div class="in">
        @if (feedback(); as f) {
          <div class="fb">
            <h3>{{ f.title }}</h3>
            @if (f.xp) { <p>+{{ f.xp }} XP</p> }
            @if (f.solution) { <p class="sol">{{ f.solution }}</p> }
            @if (f.why) { <p><app-rich [text]="f.why" /></p> }
            @if (f.say) {
              <div class="say"><div class="say-lab">{{ f.say.label }}</div><div class="say-en">“{{ f.say.en }}”</div>
                @if (f.say.es) { <div class="say-es">{{ f.say.es }}</div> }</div>
            }
            <button type="button" class="report-link" (click)="reporting.set(true)">Reportar un problema con esta pregunta</button>
          </div>
          <button class="btn" [class.ok]="f.kind === 'ok'" [class.bad]="f.kind === 'bad'" (click)="next()" id="continue-btn">Continuar</button>
        } @else if (q.type === 'open' && selfAssess()) {
          <div class="fb"><h3>¿Cómo te salió?</h3><p>Sé sincero: esto solo lo ves tú.</p></div>
          <button class="btn ghost" (click)="selfGrade(false)">Me faltó</button>
          <button class="btn ok" (click)="selfGrade(true)">La tenía</button>
        } @else if (q.type === 'open') {
          <div class="fb"></div>
          <button class="btn" [disabled]="openAnswer.trim().length < 3 || grading()" (click)="evaluate()">Evaluar</button>
        } @else {
          <div class="fb"></div>
          <button class="btn" [disabled]="!canCheck()" (click)="check()">Comprobar</button>
        }
      </div>
    </div>

    @if (reporting()) { <app-report-dialog [questionId]="q.id" (close)="reporting.set(false)" /> }
  }`,
})
export class LessonPage implements OnInit {
  readonly auth = inject(AuthService);
  private content = inject(ContentService);
  private router = inject(Router);

  /** Parámetro de ruta :topicId (vacío en el repaso). */
  readonly topicId = input<string>('');
  /** Viene de la ruta /repaso. */
  readonly review = input<boolean>(false);

  readonly rays = Array.from({ length: 12 }, (_, i) => i);
  readonly phase = signal<'loading' | 'empty' | 'play' | 'dead' | 'result'>('loading');
  readonly topic = signal<Topic | null>(null);
  private all: Question[] = [];
  readonly queue = signal<Question[]>([]);
  readonly current = computed(() => this.queue()[0] ?? null);
  readonly total = signal(0);
  readonly done = signal(0);
  readonly hearts = signal(HEARTS);
  readonly xp = signal(0);
  readonly bonus = signal(false);
  readonly saveError = signal('');
  private seen = new Set<string>();
  private closedCount = 0;

  // estado de la pregunta actual
  readonly options = signal<{ text: string; correct: boolean }[]>([]);
  readonly selected = signal<number | null>(null);
  readonly orderItems = signal<string[]>([]);
  readonly bank = signal<number[]>([]);
  readonly placed = signal<number[]>([]);
  openAnswer = '';
  readonly grading = signal(false);
  readonly grade = signal<Grade | null>(null);
  readonly gradeNote = signal('');
  readonly selfAssess = signal(false);
  readonly feedback = signal<Feedback | null>(null);
  readonly reporting = signal(false);

  readonly lang = computed<'en' | 'es'>(() => (this.auth.profile()?.english === 'no' ? 'es' : 'en'));
  readonly fillParts = computed(() => {
    const parts = (this.current()?.prompt ?? '').split('___');
    return [parts[0] ?? '', parts.slice(1).join('___')];
  });
  readonly accuracy = computed(() => {
    const n = this.closedCount;
    return n ? Math.round((100 * Math.max(0, n - (HEARTS - this.hearts()))) / n) : 100;
  });
  readonly modelAnswer = computed(() => {
    const q = this.current();
    if (!q) return '';
    return this.lang() === 'es' ? (q.model_es || q.model_en || '') : (q.model_en || q.model_es || '');
  });

  async ngOnInit() { await this.start(); }

  async start() {
    this.phase.set('loading');
    const p = this.auth.profile();
    if (!p?.level) { await this.router.navigateByUrl('/empezar'); return; }
    try {
      if (this.review()) {
        this.all = await this.content.reviewQuestions();
      } else {
        const [t, qs] = await Promise.all([this.content.topic(this.topicId()), this.content.lessonQuestions(this.topicId(), p.level)]);
        this.topic.set(t);
        this.all = qs.filter((q) => !(q.type === 'open' && !q.keys && !q.model_en && !q.model_es));
      }
    } catch { this.all = []; }
    if (!this.all.length) { this.phase.set('empty'); return; }
    // cerradas primero, la abierta al final
    const closed = shuffle(this.all.filter((q) => q.type !== 'open'));
    const open = this.all.filter((q) => q.type === 'open');
    this.closedCount = closed.length;
    this.queue.set([...closed, ...open]);
    this.total.set(this.all.length);
    this.done.set(0); this.hearts.set(HEARTS); this.xp.set(0); this.bonus.set(false); this.seen.clear();
    this.prepare();
    this.phase.set('play');
  }

  private prepare() {
    const q = this.current();
    this.selected.set(null); this.placed.set([]); this.feedback.set(null);
    this.openAnswer = ''; this.grade.set(null); this.gradeNote.set(''); this.selfAssess.set(false); this.grading.set(false);
    if (!q) return;
    if (q.type === 'mc' || q.type === 'fill') {
      this.options.set(shuffle([{ text: q.correct ?? '', correct: true }, ...q.wrong.filter(Boolean).map((w) => ({ text: w, correct: false }))]));
    }
    if (q.type === 'order') {
      const items = (q.correct ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
      this.orderItems.set(items);
      let b = shuffle(items.map((_, i) => i));
      if (items.length > 1 && b.every((v, i) => v === i)) b = b.reverse();
      this.bank.set(b);
    }
    window.scrollTo(0, 0);
  }

  looksLikeCode(t: string) { return /[(){};=<>]|=>|\.\w+\(/.test(t) && !/[áéíóúñ¿]/i.test(t); }
  scoreColor(s: number) { return s >= 75 ? 'var(--ok)' : s >= PASS ? 'var(--accent)' : 'var(--bad)'; }
  place(i: number) { if (!this.placed().includes(i)) this.placed.set([...this.placed(), i]); }
  unplace(n: number) { const p = this.placed().slice(); p.splice(n, 1); this.placed.set(p); }

  canCheck() {
    const q = this.current();
    if (!q) return false;
    if (q.type === 'order') return this.placed().length === this.orderItems().length;
    return this.selected() !== null;
  }

  check() {
    const q = this.current()!;
    let ok: boolean, solution: string;
    if (q.type === 'order') {
      ok = this.placed().every((v, i) => v === i);
      solution = 'Orden correcto: ' + this.orderItems().map((t, i) => `${i + 1}. ${t}`).join('  ');
    } else {
      ok = this.options()[this.selected()!]?.correct ?? false;
      solution = q.type === 'fill' ? q.prompt.replace('___', q.correct ?? '') : (q.correct ?? '');
    }
    this.award(q, ok, ok ? 10 : 0, solution);
  }

  async evaluate() {
    const q = this.current()!;
    const answer = this.openAnswer.trim();
    this.grading.set(true);
    const r = await this.content.grade(q.id, answer, this.lang());
    this.grading.set(false);
    if ('error' in r) {
      this.gradeNote.set(r.error === 'daily_limit'
        ? 'Has usado todas las correcciones automáticas de hoy. Compara tu respuesta con la respuesta modelo.'
        : 'La corrección automática no está disponible ahora. Compara tu respuesta con la respuesta modelo.');
      this.selfAssess.set(true);
      return;
    }
    this.grade.set(r);
    const pass = r.score >= PASS;
    this.afterOpen(q, pass, pass ? Math.round(r.score / 5) : 5, pass ? '¡Buena respuesta!' : 'Hay que pulirla');
  }

  selfGrade(ok: boolean) {
    const q = this.current()!;
    this.selfAssess.set(false);
    this.afterOpen(q, ok, ok ? 15 : 5, ok ? '¡Bien!' : 'Apuntada para mejorar');
  }

  private afterOpen(q: Question, _ok: boolean, xp: number, title: string) {
    this.done.update((d) => d + 1);
    this.xp.update((x) => x + xp);
    this.feedback.set({ kind: 'open', title, xp });
  }

  private award(q: Question, ok: boolean, xp: number, solution: string) {
    const first = !this.seen.has(q.id);
    this.seen.add(q.id);
    const say = q.say_en ? { label: ok ? 'Ejemplo de lo que podrías decir' : 'Lo que deberías decir', en: q.say_en, es: q.say_es } : null;
    if (ok) {
      this.done.update((d) => d + 1);
      this.xp.update((x) => x + xp);
      if (this.review() || first) void this.content.clearWrong(q.id);
      const titles = ['¡Correcto!', '¡Eso es!', '¡Muy bien!'];
      this.feedback.set({ kind: 'ok', title: titles[Math.floor(Math.random() * titles.length)], why: q.explanation, say });
    } else {
      this.hearts.update((h) => h - 1);
      void this.content.markWrong(q.id);
      this.feedback.set({ kind: 'bad', title: 'No exactamente', solution, why: q.explanation, say });
    }
    this.lastWasWrong = !ok;
  }
  private lastWasWrong = false;

  async next() {
    const q = this.current()!;
    // la pregunta fallada vuelve al final de la cola
    this.queue.update((qs) => (this.lastWasWrong ? [...qs.slice(1), q] : qs.slice(1)));
    this.lastWasWrong = false;
    if (this.hearts() <= 0) { this.phase.set('dead'); return; }
    if (!this.queue().length) { await this.finish(); return; }
    this.prepare();
  }

  private async finish() {
    const mistakes = HEARTS - this.hearts();
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    if (!this.review() && mistakes === 0) { this.bonus.set(true); this.xp.update((x) => x + 10); }
    this.phase.set('result');
    try {
      await this.content.finishLesson(this.review() ? null : this.topicId(), this.review() ? null : this.auth.profile()?.level ?? null, stars, this.xp());
    } catch {
      this.saveError.set('No se pudo guardar el progreso. Revisa tu conexión.');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.phase() !== 'play' || this.reporting() || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    const q = this.current();
    if (e.key === 'Enter') {
      if (this.feedback()) { e.preventDefault(); void this.next(); }
      else if (q && q.type !== 'open' && this.canCheck()) { e.preventDefault(); this.check(); }
      return;
    }
    const n = Number(e.key);
    if (q && !this.feedback() && (q.type === 'mc' || q.type === 'fill') && n >= 1 && n <= this.options().length) this.selected.set(n - 1);
  }
}
