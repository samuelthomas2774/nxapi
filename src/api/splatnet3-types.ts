/** /bullet_tokens */
export interface BulletToken {
    bulletToken: string;
    lang: string;
    is_noe_country: 'true' | unknown;
    // ...
}

/** /graphql */
export interface GraphQLRequest<Variables extends unknown> {
    variables: Variables;
    extensions: {
        persistedQuery: {
            version: 1;
            sha256Hash: RequestParameters['id'];
        };
    };
}

export interface RequestParameters {
    id: string;
    // ...
}

export interface GraphQLResponse<T = unknown> {
    // ...
}
