import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ContentService } from '../core/content.service';
import { Logo } from '../shared/logo';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  template: `
  <div class="wide">
    <header class="top">
      <div class="row"><app-logo /><span class="badge soft">Admin</span></div>
      <a class="btn ghost sm" routerLink="/">Ir a la app</a>
    </header>
    <nav class="tabs">
      <a routerLink="/admin/reportes" routerLinkActive="active">Reportes @if (open() > 0) { <span class="badge">{{ open() }}</span> }</a>
      <a routerLink="/admin/preguntas" routerLinkActive="active">Preguntas</a>
    </nav>
    <router-outlet (activate)="refresh()" />
  </div>`,
})
export class AdminLayout implements OnInit {
  private content = inject(ContentService);
  readonly open = signal(0);
  ngOnInit() { void this.refresh(); }
  async refresh() {
    const m = await this.content.openReportCounts();
    this.open.set([...m.values()].reduce((a, b) => a + b, 0));
  }
}
