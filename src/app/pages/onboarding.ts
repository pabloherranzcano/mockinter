import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ENGLISH_OPTIONS, English, LEVELS, Level, ROLES } from '../core/models';
import { Logo } from '../shared/logo';

/** Tres preguntas: puesto, nivel e idioma de la entrevista. También sirve para cambiarlas desde Ajustes. */
@Component({
  selector: 'app-onboarding',
  imports: [Logo],
  template: `
  <main class="wrap" style="max-width:520px">
    <app-logo />
    <div class="steps" style="margin-top:24px" aria-hidden="true">
      @for (s of [0,1,2]; track s) { <i [class.on]="s <= step()"></i> }
    </div>

    @switch (step()) {
      @case (0) {
        <p class="eyebrow" style="margin-top:20px">Paso 1 de 3</p>
        <h2 style="font-size:1.7rem">¿Qué puesto buscas?</h2>
        <div class="choices" style="margin-top:18px">
          @for (r of roles; track r.code) {
            <button type="button" class="choice" [class.sel]="role() === r.code" (click)="role.set(r.code)">
              <strong>{{ r.name }}</strong><span>{{ r.desc }}</span>
            </button>
          }
        </div>
      }
      @case (1) {
        <p class="eyebrow" style="margin-top:20px">Paso 2 de 3</p>
        <h2 style="font-size:1.7rem">¿Qué nivel tiene el puesto?</h2>
        <div class="choices" style="margin-top:18px">
          @for (l of levels; track l.code) {
            <button type="button" class="choice" [class.sel]="level() === l.code" (click)="level.set(l.code)">
              <strong>{{ l.code }}</strong><span>{{ l.desc }}</span>
            </button>
          }
        </div>
      }
      @case (2) {
        <p class="eyebrow" style="margin-top:20px">Paso 3 de 3</p>
        <h2 style="font-size:1.7rem">¿La entrevista será en inglés?</h2>
        <div class="choices" style="margin-top:18px">
          @for (e of englishOptions; track e.code) {
            <button type="button" class="choice" [class.sel]="english() === e.code" (click)="english.set(e.code)">
              <strong>{{ e.label }}</strong><span>{{ e.desc }}</span>
            </button>
          }
        </div>
      }
    }

    @if (error()) { <div class="error" style="margin-top:16px">{{ error() }}</div> }
    <div class="row" style="margin-top:24px">
      @if (step() > 0) { <button type="button" class="btn ghost" (click)="step.set(step() - 1)">Atrás</button> }
      <span class="spacer"></span>
      <button type="button" class="btn" [disabled]="!canNext() || busy()" (click)="next()">
        {{ step() < 2 ? 'Siguiente' : (editing ? 'Guardar' : 'Empezar') }}
      </button>
    </div>
  </main>`,
})
export class OnboardingPage implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly roles = ROLES;
  readonly levels = LEVELS;
  readonly englishOptions = ENGLISH_OPTIONS;
  readonly step = signal(0);
  readonly role = signal<string | null>(null);
  readonly level = signal<Level | null>(null);
  readonly english = signal<English | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  editing = false;

  ngOnInit() {
    const p = this.auth.profile();
    if (p?.onboarded) {
      this.editing = true;
      this.role.set(p.target_role); this.level.set(p.level); this.english.set(p.english);
    }
  }

  canNext() {
    return [this.role(), this.level(), this.english()][this.step()] != null;
  }

  async next() {
    if (this.step() < 2) { this.step.set(this.step() + 1); return; }
    this.busy.set(true); this.error.set('');
    try {
      await this.auth.updateProfile({
        target_role: this.role(), level: this.level(), english: this.english(), onboarded: true,
      });
      await this.router.navigateByUrl('/');
    } catch {
      this.error.set('No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
    } finally { this.busy.set(false); }
  }
}
