import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TodoAddForm } from './todo-add-form';

describe('TodoAddForm', () => {
  let fixture: ComponentFixture<TodoAddForm>;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TodoAddForm);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  function type(value: string) {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('disables submit for a blank title', () => {
    type('   ');
    expect(element.querySelector('button')?.disabled).toBe(true);
  });

  it('emits the trimmed title on submit', () => {
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((title) => added.push(title));

    type('  Read  ');
    element.querySelector('button')?.click();

    expect(added).toEqual(['Read']);
    expect(fixture.componentInstance.title()).toBe('  Read  ');
  });
});
