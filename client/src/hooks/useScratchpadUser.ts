import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import useSWR from "swr";
import { UserResource } from "@clerk/types";
import { User } from "@/types/server-entities/users";
import { usersApi } from "@/lib/api/users";
import { SWR_KEYS } from "@/lib/api/keys";

export interface ScratchPadUser {
  isLoading: boolean;
  user: User | null;
  clerkUser: UserResource | null;
  signOut: () => void;
  isSignedIn?: boolean;
}

export const useScratchPadUser = (): ScratchPadUser => {
  const { signOut } = useAuth();
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { data: user, isLoading } = useSWR(
    SWR_KEYS.users.activeUser(),
    usersApi.activeUser,
    {
      revalidateOnFocus: true,
      revalidateIfStale: false,
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

  return {
    isLoading: isLoading || !isLoaded,
    user: user || null,
    clerkUser: clerkUser || null,
    signOut: signOutClerk,
    isSignedIn,
  };
};
