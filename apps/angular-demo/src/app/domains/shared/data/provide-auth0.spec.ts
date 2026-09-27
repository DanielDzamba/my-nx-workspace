import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OpenIdConfiguration, StsConfigLoader } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { AuthClient } from './auth-client';
import { OidcAuthClient } from './oidc-auth-client';
import { provideAuth0 } from './provide-auth0';

describe('provideAuth0', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAuth0({
          domain: 'tenant.eu.auth0.com',
          clientId: 'client-123',
          audience: 'https://todo-api',
          apiUrl: 'https://api.example.com',
        }),
      ],
    });
  });

  async function loadConfig(): Promise<OpenIdConfiguration> {
    const configs = await firstValueFrom(
      TestBed.inject(StsConfigLoader).loadConfigs()
    );
    return configs[0] ?? {};
  }

  it('binds AuthClient to the OIDC implementation', () => {
    expect(TestBed.inject(AuthClient)).toBeInstanceOf(OidcAuthClient);
  });

  it('configures Authorization Code + PKCE against Auth0', async () => {
    const config = await loadConfig();

    expect(config.authority).toBe('https://tenant.eu.auth0.com');
    expect(config.clientId).toBe('client-123');
    expect(config.responseType).toBe('code');
    expect(config.redirectUrl).toBe(document.baseURI);
    expect(config.postLogoutRedirectUri).toBe(document.baseURI);
    expect(config.customParamsAuthRequest).toEqual({
      audience: 'https://todo-api',
    });
  });

  it('renews with refresh tokens and sends the token to the API only', async () => {
    const config = await loadConfig();

    expect(config.scope).toContain('offline_access');
    expect(config.useRefreshToken).toBe(true);
    expect(config.secureRoutes).toEqual(['https://api.example.com/api/']);
  });
});
