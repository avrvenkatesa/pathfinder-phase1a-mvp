import { useState } from 'react';
import { Chrome, Mail, Apple, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoginForm } from './LoginForm';

interface AuthenticationSelectorProps {
  onSuccess?: (user: any, token: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function AuthenticationSelector({ onSuccess, onError, className }: AuthenticationSelectorProps) {
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const handleOAuthLogin = (provider: string) => {
    if (provider === 'google') {
      // For demo, simulate Google login directly
      const mockGoogleUser = {
        id: 'google-user-' + Date.now(),
        email: 'google.user@gmail.com',
        firstName: 'Google',
        lastName: 'User',
        role: 'user'
      };
      
      const accessToken = `google-token-${Date.now()}`;
      
      // Set auth data
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('user', JSON.stringify(mockGoogleUser));
      
      // Trigger auth change event
      window.dispatchEvent(new Event('authChange'));
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(mockGoogleUser, accessToken);
      }
    } else {
      // For other providers, use server redirect
      const baseUrl = window.location.origin;
      window.location.href = `${baseUrl}/api/auth/${provider}`;
    }
  };

  const handleBackToOptions = () => {
    setShowEmailLogin(false);
  };

  if (showEmailLogin) {
    return (
      <div className={className}>
        <LoginForm 
          onSuccess={onSuccess}
          onError={onError}
        />
        <div className="mt-4 text-center">
          <Button 
            onClick={handleBackToOptions}
            variant="link"
            className="text-sm"
            data-testid="button-back-to-options"
          >
            ← Other sign in options
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Sign in to PathFinder
        </CardTitle>
        <CardDescription className="text-center">
          Choose your preferred sign in method
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* OAuth Providers */}
        <div className="space-y-3">
          <Button
            onClick={() => handleOAuthLogin('google')}
            variant="outline"
            className="w-full h-11 font-medium"
            data-testid="button-google-login"
          >
            <svg 
              className="mr-3 h-5 w-5" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <Button
            onClick={() => handleOAuthLogin('microsoft')}
            variant="outline"
            className="w-full h-11 font-medium"
            data-testid="button-microsoft-login"
          >
            <svg 
              className="mr-3 h-5 w-5" 
              viewBox="0 0 23 23" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M1 1h10v10H1z" fill="#f35325"/>
              <path d="M12 1h10v10H12z" fill="#81bc06"/>
              <path d="M1 12h10v10H1z" fill="#05a6f0"/>
              <path d="M12 12h10v10H12z" fill="#ffba08"/>
            </svg>
            Continue with Microsoft
          </Button>

          {/* Placeholder for Apple - would need Apple OAuth setup */}
          <Button
            onClick={() => alert('Apple Sign-In coming soon!')}
            variant="outline"
            className="w-full h-11 font-medium opacity-50"
            disabled
            data-testid="button-apple-login"
          >
            <Apple className="mr-3 h-5 w-5" />
            Continue with Apple
          </Button>

          {/* Placeholder for Twitter - would need Twitter OAuth setup */}
          <Button
            onClick={() => alert('Twitter Sign-In coming soon!')}
            variant="outline"
            className="w-full h-11 font-medium opacity-50"
            disabled
            data-testid="button-twitter-login"
          >
            <Twitter className="mr-3 h-5 w-5 text-blue-400" />
            Continue with Twitter
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        {/* Email/Password Option */}
        <Button
          onClick={() => setShowEmailLogin(true)}
          variant="outline"
          className="w-full h-11 font-medium"
          data-testid="button-email-login"
        >
          <Mail className="mr-3 h-5 w-5 text-gray-600" />
          Continue with Email
        </Button>

        {/* Demo credentials hint */}
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
          <p className="font-medium mb-1">Demo Access Available</p>
          <p>Click "Continue with Email" then use:</p>
          <p className="font-mono text-xs">test@example.com / Test123!</p>
        </div>

        {/* Footer links */}
        <div className="space-y-2 text-center text-sm">
          <div className="text-muted-foreground">
            Don't have an account?{' '}
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto text-sm"
              data-testid="link-sign-up"
            >
              Sign up
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}