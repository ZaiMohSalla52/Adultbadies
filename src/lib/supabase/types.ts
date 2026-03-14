export type SupabaseRequestOptions = {
  accessToken?: string;
};

export type SupabaseClient = {
  restUrl: string;
  authHeader: (token?: string) => HeadersInit;
};
