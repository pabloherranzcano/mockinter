import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Rich } from './shared/rich';
import { shuffle } from './core/content.service';

@Component({ imports: [Rich], template: '<app-rich [text]="text" />' })
class Host { text = 'Usa `@for` con `track`.'; }

describe('Rich', () => {
  it('convierte el texto entre comillas invertidas en <code>', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const codes = Array.from(el.querySelectorAll('code')).map((c) => c.textContent);
    expect(codes).toEqual(['@for', 'track']);
    expect(el.textContent).toBe('Usa @for con track.');
  });

  it('no interpreta HTML', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.text = '<img src=x onerror=alert(1)>';
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});

describe('shuffle', () => {
  it('mantiene los mismos elementos y no muta el original', () => {
    const a = [1, 2, 3, 4, 5];
    const b = shuffle(a);
    expect(a).toEqual([1, 2, 3, 4, 5]);
    expect([...b].sort()).toEqual(a);
  });
});
