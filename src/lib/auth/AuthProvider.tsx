import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import {
  addChild as apiAddChild,
  createFamily as apiCreateFamily,
  fetchMembership,
  joinFamilyAsChild,
} from '@/lib/api/family';
import { resolveAppState, type AppState } from '@/lib/authState';
import { supabase } from '@/lib/supabase';
import type { Membership, RewardType } from '@/types/domain';

interface AuthContextValue {
  appState: AppState;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (joinCode: string, childId: string) => Promise<void>;
  addChild: (name: string, rewardType: RewardType) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadMembership(userId: string) {
      const membership = await fetchMembership(userId);
      if (isMounted) setMemberships(membership ? [membership] : []);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (data.session) await loadMembership(data.session.user.id);
      if (isMounted) setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession) {
        await loadMembership(newSession.user.id);
      } else {
        setMemberships([]);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const appState = resolveAppState(session !== null, memberships);

  async function refreshMembership() {
    if (!session) return;
    const membership = await fetchMembership(session.user.id);
    setMemberships(membership ? [membership] : []);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) {
      throw new Error('Sign up succeeded but returned no user — please try signing in.');
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, display_name: displayName });
    if (profileError) throw profileError;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Sends a 6-digit recovery code to the given email — never reveals
   * whether the address actually has an account (matches Supabase's own
   * behaviour of always "succeeding" here regardless, to avoid leaking
   * which emails are registered). The email itself is customized
   * (supabase/templates/recovery.html) to show the raw code, since the
   * app has the user type it in manually rather than follow a link —
   * the same pattern as the existing join-code flow, and one that avoids
   * needing deep-link/universal-link setup this app doesn't otherwise need.
   */
  async function requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  /**
   * Verifying the code signs the user in with a short-lived recovery
   * session (a `PASSWORD_RECOVERY`-flavoured sign-in, per Supabase's own
   * verifyOtp docs) — updateUser() then sets the real new password while
   * still in that session. No manual navigation afterwards: this sign-in
   * flips appState the same way any other one does, and the root layout's
   * Stack.Protected guards react on their own.
   */
  async function confirmPasswordReset(email: string, code: string, newPassword: string) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (verifyError) throw verifyError;

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;
  }

  async function createFamily(name: string) {
    if (!session) throw new Error('Not signed in.');
    await apiCreateFamily(name, session.user.id);
    await refreshMembership();
  }

  async function joinFamily(joinCode: string, childId: string) {
    if (!session) throw new Error('Not signed in.');
    await joinFamilyAsChild(joinCode, childId);
    await refreshMembership();
  }

  async function addChild(name: string, rewardType: RewardType) {
    if (appState.status !== 'active') {
      throw new Error('Create a family before adding children.');
    }
    await apiAddChild(appState.membership.familyId, name, rewardType);
  }

  return (
    <AuthContext.Provider
      value={{
        appState,
        isLoading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        confirmPasswordReset,
        createFamily,
        joinFamily,
        addChild,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
