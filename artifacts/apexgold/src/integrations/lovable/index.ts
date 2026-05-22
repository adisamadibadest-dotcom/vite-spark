import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

type OAuthProvider = "google" | "apple" | "microsoft" | "lovable";

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
      if (provider === "lovable") {
        return { error: new Error("Lovable OAuth is not supported in this environment") };
      }
      const result = await supabase.auth.signInWithOAuth({
        provider: provider as "google" | "apple" | "azure",
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin,
          queryParams: opts?.extraParams,
        },
      });
      if (result.error) return { error: result.error };
      return { redirected: true };
    },
  },
};
