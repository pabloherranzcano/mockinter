import { Component, computed, input } from '@angular/core';

/** Muestra texto convirtiendo `código` entre comillas invertidas en <code>, sin usar innerHTML. */
@Component({
  selector: 'app-rich',
  template: `@for (p of parts(); track $index) {@if (p.code) {<code>{{ p.t }}</code>} @else {<span>{{ p.t }}</span>}}`,
})
export class Rich {
  readonly text = input<string | null | undefined>('');
  readonly parts = computed(() =>
    String(this.text() ?? '')
      .split(/(`[^`]+`)/)
      .filter(Boolean)
      .map((t) => (/^`[^`]+`$/.test(t) ? { code: true, t: t.slice(1, -1) } : { code: false, t })),
  );
}
