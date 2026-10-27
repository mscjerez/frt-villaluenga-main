// Development-only credentials for the mock backend (MSW). Never used in production builds.
// The 2FA step accepts this fixed code instead of a real TOTP.
export const MOCK_ADMIN = {
  email: 'admin@rinconcuracarlos.es',
  password: 'Villaluenga-Demo-2026',
  totp: '246810',
  name: 'Carlos',
}
