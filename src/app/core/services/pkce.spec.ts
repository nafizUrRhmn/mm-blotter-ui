import { createCodeChallenge, createCodeVerifier } from './pkce';

describe('pkce', () => {
  it('creates a URL-safe verifier of RFC 7636 length', () => {
    const verifier = createCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it('derives the RFC 7636 appendix B S256 challenge', async () => {
    const challenge = await createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
