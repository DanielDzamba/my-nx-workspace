import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthClient, AuthUser } from '../data';
import { HomePage } from './home-page';

describe('HomePage', () => {
  const authenticated = signal(false);
  const user = signal<AuthUser | null>(null);
  const client = {
    isAuthenticated: authenticated,
    user,
    login: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    authenticated.set(false);
    user.set(null);
    client.login.mockReset();
    client.logout.mockReset();
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [provideRouter([]), { provide: AuthClient, useValue: client }],
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function button(element: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label
    );
    if (!found) throw new Error(`No button "${label}"`);
    return found;
  }

  it('offers the login to anonymous users', () => {
    const element = render();

    expect(element.querySelector('a')).toBeNull();
    button(element, 'Prihlásiť sa').click();
    expect(client.login).toHaveBeenCalledOnce();
  });

  it('greets a signed-in user and links to the todo list', () => {
    authenticated.set(true);
    user.set({ name: 'Jana' });
    const element = render();

    expect(element.textContent).toContain('Prihlásený ako Jana');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/todos');
    button(element, 'Odhlásiť sa').click();
    expect(client.logout).toHaveBeenCalledOnce();
  });
});
