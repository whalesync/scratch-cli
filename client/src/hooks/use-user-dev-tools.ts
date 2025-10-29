import { devToolsApi } from "@/lib/api/dev-tools";
import { UserDetails } from "@/types/server-entities/dev-tools";
import { User } from "@/types/server-entities/users";
import { useState } from "react";

/**
 * @returns A hook with dev tools for user management
 */
export const useUserDevTools = () => {
    const [results, setResults] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [currentUserDetails, setCurrentUserDetails] = useState<UserDetails | undefined>(undefined);

  const search = async(query: string) => {
    if(!query.trim()) {
        setError(new Error("Query is empty"));
        return;
    }
    try {
        setResults([]);
        setCurrentUserDetails(undefined);
        setIsLoading(true);
        const response = await devToolsApi.searchUsers(query);
        setResults(response);
    } catch (error) {
        setError(error as Error);
    } finally {
        setIsLoading(false);
    }
  };

  const retrieveUserDetails = async(userId: string) => {
    try {
        setIsLoading(true);
        const response = await devToolsApi.getUserDetails(userId);
        setCurrentUserDetails(response);
    } catch (error) {
        setError(error as Error);
    } finally {
        setIsLoading(false);
    }
  };


  return {
    users: results,
    isLoading,
    error,
    search,
    retrieveUserDetails,
    currentUserDetails,
    clearCurrentUserDetails: () => setCurrentUserDetails(undefined),
  };
}