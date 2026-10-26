import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthClient, AuthUser } from '../data';
import { AccountBlockedPage } from './account-blocked-page';

describe('AccountBlockedPage', () => {
  const client = {
    isAuthenticated: signal(true),
    user: signal<AuthUser | null>({ name: 'Bob', roles: [] }),
    login: vi.fn(),
    logout: vi.fn(),
  };

  beforeEach(async () => {
    client.logout.mockReset();
    await TestBed.configureTestingModule({
      imports: [AccountBlockedPage],
      providers: [{ provide: AuthClient, useValue: client }],
    }).compileComponents();
  });

  it('tells the user that the account is blocked and lets them sign out', () => {
    const fixture = TestBed.createComponent(AccountBlockedPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain(
      'Účet je zablokovaný'
    );
    element.querySelector('button')?.click();
    expect(client.logout).toHaveBeenCalledOnce();
  });
});
