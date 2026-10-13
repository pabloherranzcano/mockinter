import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { REASONS, Report, ReportStatus, TYPE_LABELS } from '../core/models';

interface Group { questionId: string; prompt: string; meta: string; active: boolean; reports: Report[]; }

@Component({
  selector: 'app-admin-reports',
  imports: [RouterLink, DatePipe],
  template: `
  <div class="row" style="margin-top:18px">
    <h2 style="font-size:1.5rem">Bandeja de reportes</h2>
    <span class="spacer"></span>
    <label class="field" style="grid-auto-flow:column;align-items:center">Mostrar
      <select id="report-status" [value]="status()" (change)="setStatus($any($event.target).value)">
        <option value="open">Abiertos</option>
        <option value="resolved">Resueltos</option>
        <option value="dismissed">Descartados</option>
        <option value="all">Todos</option>
      </select>
    </label>
  </div>
  <p class="muted small">Agrupados por pregunta: arriba las que tienen más reportes. Corrige la pregunta y marca los reportes como resueltos.</p>

  @if (loading()) { <p class="muted">Cargando…</p> }
  @if (error()) { <div class="error">{{ error() }}</div> }
  @if (!loading() && !groups().length) {
    <div class="card" style="margin-top:16px"><strong>No hay reportes {{ status() === 'open' ? 'abiertos' : '' }}.</strong>
      <p class="muted" style="margin:4px 0 0">Cuando alguien reporte una pregunta desde la app, aparecerá aquí.</p></div>
  }

  <div class="stack" style="margin-top:16px">
    @for (g of groups(); track g.questionId) {
      <article class="card report-group">
        <div class="row">
          <span class="badge">{{ g.reports.length }}</span>
          <code>{{ g.questionId }}</code>
          <span class="muted small">{{ g.meta }}</span>
          @if (!g.active) { <span class="badge soft">Oculta</span> }
          <span class="spacer"></span>
          <a class="btn navy sm" [routerLink]="['/admin/preguntas', g.questionId]">Editar pregunta</a>
        </div>
        <strong>{{ g.prompt }}</strong>
        @for (r of g.reports; track r.id) {
          <div class="report-item">
            <div class="row small"><strong>{{ reasonLabel(r.reason) }}</strong><span class="muted">{{ r.created_at | date: 'd MMM y, HH:mm' }}</span>
              @if (r.status !== 'open') { <span class="badge soft">{{ r.status === 'resolved' ? 'Resuelto' : 'Descartado' }}</span> }</div>
            @if (r.comment) { <p style="margin:4px 0 0">{{ r.comment }}</p> }
          </div>
        }
        @if (status() === 'open') {
          <div class="row">
            <button class="btn ok sm" (click)="mark(g, 'resolved')">Marcar resueltos</button>
            <button class="btn ghost sm" (click)="mark(g, 'dismissed')">Descartar</button>
          </div>
        } @else {
          <div class="row"><button class="btn ghost sm" (click)="mark(g, 'open')">Reabrir</button></div>
        }
      </article>
    }
  </div>`,
})
export class AdminReports implements OnInit {
  private content = inject(ContentService);
  readonly status = signal<ReportStatus | 'all'>('open');
  readonly reports = signal<Report[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly groups = computed<Group[]>(() => {
    const m = new Map<string, Group>();
    for (const r of this.reports()) {
      const q = r.questions;
      const g = m.get(r.question_id) ?? {
        questionId: r.question_id, prompt: q?.prompt ?? '(pregunta borrada)',
        meta: q ? `${q.level} · ${TYPE_LABELS[q.type]}` : '', active: q?.active ?? false, reports: [],
      };
      g.reports.push(r);
      m.set(r.question_id, g);
    }
    return [...m.values()].sort((a, b) => b.reports.length - a.reports.length);
  });

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true); this.error.set('');
    try { this.reports.set(await this.content.reports(this.status())); }
    catch { this.error.set('No se pudieron cargar los reportes.'); }
    finally { this.loading.set(false); }
  }

  setStatus(s: ReportStatus | 'all') { this.status.set(s); void this.load(); }
  reasonLabel(r: string) { return REASONS.find((x) => x.code === r)?.label ?? r; }

  async mark(g: Group, status: ReportStatus) {
    try {
      await this.content.setReportStatus(g.reports.map((r) => r.id), status);
      await this.load();
    } catch { this.error.set('No se pudo actualizar el reporte.'); }
  }
}
