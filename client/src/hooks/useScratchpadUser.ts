import { API_CONFIG } from "@/lib/api/config";
import { SWR_KEYS } from "@/lib/api/keys";
import { usersApi } from "@/lib/api/users";
import { User } from "@/types/server-entities/users";
import { useAuth, useUser } from "@clerk/nextjs";
import { UserResource } from "@clerk/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import useSWR from "swr";



export interface ScratchPadUser {
  isLoading: boolean;
  user: User | null;
  clerkUser: UserResource | null;
  signOut: () => void;
  isSignedIn?: boolean; 
  isAdmin?: boolean;
}

export const useScratchPadUser = (): ScratchPadUser => {
  const { signOut } = useAuth();
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { data: user, isLoading } = useSWR(
    SWR_KEYS.users.activeUser(),
    usersApi.activeUser,
    {
      revalidateOnFocus: true,
      refreshInterval: 1000 * 60 * 5, // 5 minutes - want to get updated agent JWT tokens
    }
  );

  const router = useRouter();

  const signOutClerk = useCallback(() => {
    /*
     * Clerk handles signouts with an async function and needs special treatment to call it
     */
    if (signOut) {
      // The Clerk singOut function is async
      const asyncSignOut = async (): Promise<void> => {
        await signOut();
      };
      asyncSignOut()
        .catch(console.error)
        .finally(() => router.push("/sign-in"));
    }
  }, [router, signOut]);

  useEffect(() => {
    if (user) {
      API_CONFIG.setAgentJwt(user.agentJwt || '');
    } 
  }, [user]);

  return {
    isLoading: isLoading || !isLoaded,
    user: user || null,
    clerkUser: clerkUser || null,
    signOut: signOutClerk,
    isSignedIn,
    isAdmin: user?.isAdmin
  };
};
