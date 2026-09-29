import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pager } from './pager';

describe('Pager', () => {
  let fixture: ComponentFixture<Pager>;
  let element: HTMLElement;
  let requested: number[];

  function render(page: number, totalPages: number) {
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('totalPages', totalPages);
    fixture.detectChanges();
  }

  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(label)
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Pager);
    element = fixture.nativeElement as HTMLElement;
    requested = [];
    fixture.componentInstance.pageChange.subscribe((page) =>
      requested.push(page)
    );
  });

  it('renders nothing for a single page', () => {
    render(0, 1);
    expect(element.querySelector('nav')).toBeNull();
    render(0, 0);
    expect(element.querySelector('nav')).toBeNull();
  });

  it('shows the one-based page and requests neighbours', () => {
    render(1, 3);
    expect(element.textContent).toContain('Strana 2 z 3');

    button('Predchádzajúca').click();
    button('Ďalšia').click();

    expect(requested).toEqual([0, 2]);
  });

  it('disables previous on the first and next on the last page', () => {
    render(0, 2);
    expect(button('Predchádzajúca').disabled).toBe(true);
    expect(button('Ďalšia').disabled).toBe(false);

    render(1, 2);
    expect(button('Predchádzajúca').disabled).toBe(false);
    expect(button('Ďalšia').disabled).toBe(true);
  });
});
