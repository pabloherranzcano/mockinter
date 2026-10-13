import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-logo',
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="mockinter.dev, inicio">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect x="3" y="6" width="28" height="22" rx="5" fill="var(--navy)" />
        <rect x="12" y="2" width="10" height="8" rx="2" fill="var(--accent)" />
        <circle cx="12" cy="17" r="3.5" fill="var(--accent)" />
        <rect x="18" y="14" width="9" height="2.6" rx="1.3" fill="var(--navy-ink)" opacity=".85" />
        <rect x="18" y="19" width="6" height="2.6" rx="1.3" fill="var(--navy-ink)" opacity=".55" />
      </svg>
      <h1>mockinter<span class="tld">.dev</span></h1>
    </a>`,
})
export class Logo {}
