import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useAuth() {
  const [hasToken, setHasToken] = useState(false);

  // Check localStorage for token on mount and storage changes
  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem('accessToken');
      setHasToken(!!token);
    };
    
    checkToken();
    
    // Listen for storage changes
    window.addEventListener('storage', checkToken);
    
    // Custom event for manual token updates
    window.addEventListener('authChange', checkToken);
    
    return () => {
      window.removeEventListener('storage', checkToken);
      window.removeEventListener('authChange', checkToken);
    };
  }, []);

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: hasToken, // Only run query if we have a token
  });

  return {
    user,
    isLoading: hasToken ? isLoading : false,
    isAuthenticated: hasToken && !!user,
  };
}
