import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useAuth() {
  const [authState, setAuthState] = useState({
    user: null as any,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          setAuthState({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error parsing user from localStorage:', error);
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };
    
    // Check on mount
    checkAuth();
    
    // Listen for custom auth events
    const handleAuthChange = () => {
      console.log('Auth change detected, updating state');
      checkAuth();
    };
    
    window.addEventListener('authChange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    
    return () => {
      window.removeEventListener('authChange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return authState;
}
