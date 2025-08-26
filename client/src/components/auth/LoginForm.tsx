import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';

// Form validation schemas
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

const mfaSchema = z.object({
  mfaCode: z.string()
    .length(6, 'MFA code must be 6 digits')
    .regex(/^\d{6}$/, 'MFA code must contain only numbers'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type MfaFormData = z.infer<typeof mfaSchema>;

// API response types
interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    mfaEnabled: boolean;
    emailVerified: boolean;
  };
  accessToken?: string;
  message: string;
  requiresMfa?: boolean;
  error?: string;
}

interface LoginFormProps {
  onSuccess?: (user: LoginResponse['user'], token: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function LoginForm({ onSuccess, onError, className }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'login' | 'mfa'>('login');
  const [loginData, setLoginData] = useState<LoginFormData | null>(null);

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // MFA form
  const mfaForm = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      mfaCode: '',
    },
  });

  const clearError = () => setError(null);

  const handleLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('POST', '/api/auth/login', data);
      const result: LoginResponse = await response.json();

      if (result.success && result.user && result.accessToken) {
        // Successful login without MFA
        localStorage.setItem('accessToken', result.accessToken);
        localStorage.setItem('user', JSON.stringify(result.user));
        onSuccess?.(result.user, result.accessToken);
      } else if (result.requiresMfa) {
        // MFA required - move to MFA step
        setLoginData(data);
        setStep('mfa');
      } else {
        // Login failed
        setError(result.message || 'Login failed');
        onError?.(result.message || 'Login failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (data: MfaFormData) => {
    if (!loginData) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('POST', '/api/auth/login', {
        ...loginData,
        mfaCode: data.mfaCode,
      });
      const result: LoginResponse = await response.json();

      if (result.success && result.user && result.accessToken) {
        // Successful login with MFA
        localStorage.setItem('accessToken', result.accessToken);
        localStorage.setItem('user', JSON.stringify(result.user));
        onSuccess?.(result.user, result.accessToken);
      } else {
        // MFA verification failed
        setError(result.message || 'Invalid MFA code');
        onError?.(result.message || 'Invalid MFA code');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('login');
    setLoginData(null);
    setError(null);
    mfaForm.reset();
  };

  const formatMfaCode = (value: string) => {
    // Remove non-digits and limit to 6 characters
    return value.replace(/\D/g, '').slice(0, 6);
  };

  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          {step === 'login' ? 'Sign in' : 'Two-Factor Authentication'}
        </CardTitle>
        <CardDescription>
          {step === 'login' 
            ? 'Enter your email and password to access your account'
            : 'Enter the 6-digit code from your authenticator app'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'login' ? (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Enter your email"
                        autoComplete="email"
                        onChange={(e) => {
                          field.onChange(e);
                          clearError();
                        }}
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          onChange={(e) => {
                            field.onChange(e);
                            clearError();
                          }}
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        data-testid="checkbox-remember-me"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <Label>Remember me</Label>
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-sign-in"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBackToLogin}
              className="mb-4"
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Button>

            <Form {...mfaForm}>
              <form onSubmit={mfaForm.handleSubmit(handleMfaSubmit)} className="space-y-4">
                <FormField
                  control={mfaForm.control}
                  name="mfaCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder="000000"
                          maxLength={6}
                          className="text-center text-lg tracking-widest font-mono"
                          onChange={(e) => {
                            const formatted = formatMfaCode(e.target.value);
                            field.onChange(formatted);
                            clearError();
                          }}
                          autoComplete="one-time-code"
                          data-testid="input-mfa-code"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-verify-mfa"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-sm text-muted-foreground text-center">
              <p>Enter the 6-digit code from your authenticator app.</p>
              <p className="mt-1">You can also use a backup code if available.</p>
            </div>
          </div>
        )}

        {step === 'login' && (
          <div className="space-y-2 text-center text-sm">
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto text-sm"
              data-testid="link-forgot-password"
            >
              Forgot your password?
            </Button>
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
        )}
      </CardContent>
    </Card>
  );
}