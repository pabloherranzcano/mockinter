import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContentService } from '../core/content.service';
import { REASONS, ReportReason } from '../core/models';

@Component({
  selector: 'app-report-dialog',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="close.emit()">
      <form class="dialog" (click)="$event.stopPropagation()" (ngSubmit)="send()" role="dialog" aria-labelledby="rep-title">
        @if (!sent()) {
          <h2 id="rep-title">Reportar esta pregunta</h2>
          <p class="muted small" style="margin:0">Lo revisamos a mano y corregimos la pregunta. Gracias por ayudar a mejorarla.</p>
          <div class="stack" role="radiogroup" aria-label="Motivo">
            @for (r of reasons; track r.code) {
              <label class="radio"><input type="radio" name="reason" [value]="r.code" [(ngModel)]="reason" /> {{ r.label }}</label>
            }
          </div>
          <label class="field">Comentario (opcional)
            <textarea id="report-comment" name="comment" [(ngModel)]="comment" maxlength="1000"
              placeholder="Por ejemplo: la opción B también es correcta porque…"></textarea>
          </label>
          @if (error()) { <div class="error">{{ error() }}</div> }
          <div class="row">
            <button type="button" class="btn ghost sm" (click)="close.emit()">Cancelar</button>
            <span class="spacer"></span>
            <button type="submit" class="btn sm" [disabled]="!reason || sending()">{{ sending() ? 'Enviando…' : 'Enviar' }}</button>
          </div>
        } @else {
          <h2 id="rep-title">Gracias</h2>
          <p style="margin:0">Hemos recibido tu reporte. Si hace falta, corregiremos la pregunta en los próximos días.</p>
          <button type="button" class="btn full" (click)="close.emit()">Seguir</button>
        }
      </form>
    </div>`,
})
export class ReportDialog {
  private content = inject(ContentService);
  readonly questionId = input.required<string>();
  readonly close = output<void>();
  readonly reasons = REASONS;
  reason: ReportReason | null = null;
  comment = '';
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  async send() {
    if (!this.reason) return;
    this.sending.set(true); this.error.set('');
    try {
      await this.content.report(this.questionId(), this.reason, this.comment);
      this.sent.set(true);
    } catch (e: any) {
      this.error.set(e?.message?.includes('muchos reportes') ? e.message : 'No se pudo enviar. Inténtalo de nuevo en un momento.');
    } finally { this.sending.set(false); }
  }
}
