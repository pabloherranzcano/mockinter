import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ENGLISH_OPTIONS, ROLES } from '../core/models';
import { Logo } from '../shared/logo';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink, Logo],
  template: `
  <main class="wrap">
    <header class="top"><app-logo /><a class="btn ghost sm" routerLink="/">Volver</a></header>
    <h2 style="font-size:1.8rem;margin-top:24px">Ajustes</h2>

    <section class="card stack" style="margin-top:18px">
      <p class="eyebrow" style="margin:0">Tu preparación</p>
      <p style="margin:0"><strong>{{ roleName() }}</strong> · {{ p()?.level }} · {{ englishLabel() }}</p>
      <a class="btn ghost sm" routerLink="/empezar" style="justify-self:start">Cambiar puesto, nivel o idioma</a>
    </section>

    <section class="card stack" style="margin-top:14px">
      <p class="eyebrow" style="margin:0">Cuenta</p>
      <p style="margin:0" class="muted">{{ auth.session()?.user?.email }}</p>
      <form class="stack" (ngSubmit)="saveName()">
        <label class="field">Nombre
          <input id="display-name" name="name" type="text" maxlength="60" [(ngModel)]="name" />
        </label>
        <button class="btn sm" type="submit" style="justify-self:start">Guardar nombre</button>
      </form>
      <form class="stack" (ngSubmit)="savePassword()">
        <label class="field">Nueva contraseña
          <input id="new-password" name="pw" type="password" minlength="8" autocomplete="new-password" [(ngModel)]="password" />
        </label>
        <button class="btn ghost sm" type="submit" style="justify-self:start" [disabled]="password.length < 8">Cambiar contraseña</button>
      </form>
      @if (msg()) { <div class="notice">{{ msg() }}</div> }
      @if (error()) { <div class="error">{{ error() }}</div> }
      <button class="btn ghost" (click)="logout()" style="justify-self:start">Cerrar sesión</button>
    </section>

    <section class="card stack" style="margin-top:14px">
      <p class="eyebrow" style="margin:0">Zona de peligro</p>
      @if (!confirmDelete()) {
        <button class="btn bad sm" style="justify-self:start" (click)="confirmDelete.set(true)">Borrar mi cuenta</button>
      } @else {
        <p style="margin:0">Se borrarán tu cuenta, tu progreso y tu racha. No se puede deshacer.</p>
        <div class="row">
          <button class="btn ghost sm" (click)="confirmDelete.set(false)">Cancelar</button>
          <button class="btn bad sm" (click)="deleteAccount()">Sí, borrar para siempre</button>
        </div>
      }
    </section>
    <p class="small muted" style="margin-top:20px"><a routerLink="/privacidad">Política de privacidad</a></p>
  </main>`,
})
export class SettingsPage {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  readonly p = this.auth.profile;
  readonly roleName = computed(() => ROLES.find((r) => r.code === this.p()?.target_role)?.name ?? '—');
  readonly englishLabel = computed(() => ENGLISH_OPTIONS.find((e) => e.code === this.p()?.english)?.label ?? '');
  readonly msg = signal('');
  readonly error = signal('');
  readonly confirmDelete = signal(false);
  name = this.p()?.display_name ?? '';
  password = '';

  async saveName() {
    this.flash();
    try { await this.auth.updateProfile({ display_name: this.name.trim() || null }); this.msg.set('Nombre guardado.'); }
    catch { this.error.set('No se pudo guardar el nombre.'); }
  }
  async savePassword() {
    this.flash();
    try { await this.auth.updatePassword(this.password); this.password = ''; this.msg.set('Contraseña cambiada.'); }
    catch (e: any) { this.error.set(e?.message ?? 'No se pudo cambiar la contraseña.'); }
  }
  async logout() { await this.auth.signOut(); await this.router.navigateByUrl('/entrar'); }
  async deleteAccount() {
    this.flash();
    try { await this.auth.deleteAccount(); await this.router.navigateByUrl('/entrar'); }
    catch { this.error.set('No se pudo borrar la cuenta. Escríbenos y lo hacemos a mano.'); }
  }
  private flash() { this.msg.set(''); this.error.set(''); }
}
