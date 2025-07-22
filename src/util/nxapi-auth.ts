export const NXAPI_AUTH_CLI_CLIENT_ID = 'CKtknJ6HiH2AZIMw-x8ljw';
export const NXAPI_AUTH_APP_CLIENT_ID = 'GlR_qsPZpNcxqMwnbsSjMA';

export let client_assertion_provider: ClientAssertionProviderInterface | null = null;

export function setClientAssertionProvider(provider: ClientAssertionProviderInterface) {
    client_assertion_provider = provider;
}

export interface ClientAssertionProviderInterface {
    create(aud: string, exp?: number): Promise<OAuthClientAssertion>;
}
export interface OAuthClientAssertion {
    assertion: string;
    type: string;
}
