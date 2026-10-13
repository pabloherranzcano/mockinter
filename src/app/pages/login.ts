import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Logo } from '../shared/logo';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Logo],
  template: `
  <main class="wrap" style="max-width:440px">
    <app-logo />
    <h2 style="font-size:2rem;margin-top:28px">Prepara tus entrevistas técnicas, 5 minutos al día</h2>
    <p class="muted">Lecciones cortas de Angular, React, Cloud/DevOps y Backend, con práctica de inglés y corrección de tus respuestas.</p>

    <div class="card stack" style="margin-top:20px">
      <div class="row">
        <button type="button" class="btn sm" [class.ghost]="mode() !== 'in'" (click)="mode.set('in')">Entrar</button>
        <button type="button" class="btn sm" [class.ghost]="mode() !== 'up'" (click)="mode.set('up')">Crear cuenta</button>
      </div>

      <form class="stack" (ngSubmit)="submit()">
        <label class="field">Email
          <input id="email" name="email" type="email" autocomplete="email" required [(ngModel)]="email" />
        </label>
        @if (mode() !== 'reset') {
          <label class="field">Contraseña
            <input id="password" name="password" type="password" minlength="8" required
              [attr.autocomplete]="mode() === 'up' ? 'new-password' : 'current-password'" [(ngModel)]="password" />
          </label>
        }
        @if (mode() === 'up') {
          <p class="small muted" style="margin:0">Al crear la cuenta aceptas la <a routerLink="/privacidad">política de privacidad</a>.</p>
        }
        @if (error()) { <div class="error">{{ error() }}</div> }
        @if (notice()) { <div class="notice">{{ notice() }}</div> }
        <button class="btn full" type="submit" [disabled]="busy()">
          {{ mode() === 'in' ? 'Entrar' : mode() === 'up' ? 'Crear cuenta' : 'Enviar enlace' }}
        </button>
      </form>

      @if (mode() === 'in') {
        <button type="button" class="link small" (click)="mode.set('reset')">He olvidado mi contraseña</button>
      } @else if (mode() === 'reset') {
        <button type="button" class="link small" (click)="mode.set('in')">Volver</button>
      }

      <div class="row muted small" style="justify-content:center">o</div>
      <button type="button" class="btn ghost full" (click)="google()">Continuar con Google</button>
    </div>
    <p class="small muted" style="margin-top:24px"><a routerLink="/privacidad">Privacidad</a></p>
  </main>`,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly mode = signal<'in' | 'up' | 'reset'>('in');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  email = '';
  password = '';

  async submit() {
    this.error.set(''); this.notice.set(''); this.busy.set(true);
    try {
      if (this.mode() === 'in') {
        await this.auth.signIn(this.email, this.password);
        await this.router.navigateByUrl(this.auth.profile()?.onboarded ? '/' : '/empezar');
      } else if (this.mode() === 'up') {
        if (this.password.length < 8) throw new Error('La contraseña necesita al menos 8 caracteres.');
        const { needsConfirmation } = await this.auth.signUp(this.email, this.password);
        if (needsConfirmation) this.notice.set('Te hemos enviado un email. Confirma tu cuenta desde el enlace y vuelve a entrar.');
        else await this.router.navigateByUrl('/empezar');
      } else {
        await this.auth.resetPassword(this.email);
        this.notice.set('Si el email existe, te llegará un enlace para cambiar la contraseña.');
      }
    } catch (e: any) {
      this.error.set(translate(e?.message));
    } finally { this.busy.set(false); }
  }

  async google() {
    try { await this.auth.signInWithGoogle(); } catch (e: any) { this.error.set(translate(e?.message)); }
  }
}

function translate(msg?: string): string {
  if (!msg) return 'Algo ha fallado. Inténtalo de nuevo.';
  if (/invalid login/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/already registered/i.test(msg)) return 'Ya existe una cuenta con ese email. Prueba a entrar.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu email desde el enlace que te enviamos.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';
  if (/provider is not enabled/i.test(msg)) return 'El acceso con Google no está activado todavía.';
  return msg;
}
