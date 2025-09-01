import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export default function Landing() {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleMicrosoftLogin = () => {
    window.location.href = "/api/login";
  };

  const handleEmailLogin = () => {
    // Redirect to Replit Auth for email/password login as well
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center">
            <i className="fas fa-route text-primary text-4xl mr-3"></i>
            <h1 className="text-3xl font-bold text-gray-900">PathFinder</h1>
          </div>
          <p className="mt-4 text-lg text-gray-600">
            Your hierarchical contact management system
          </p>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Welcome to PathFinder
              </h2>
              <p className="text-gray-600">
                Organize and manage your contacts with powerful hierarchical relationships. 
                Track companies, divisions, and people all in one place.
              </p>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <i className="fas fa-building text-primary mr-3"></i>
                  Manage companies and organizations
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <i className="fas fa-layer-group text-secondary-500 mr-3"></i>
                  Organize divisions and departments
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <i className="fas fa-users text-green-600 mr-3"></i>
                  Track people and their relationships
                </div>
              </div>
              {!showEmailLogin ? (
                <div className="space-y-3">
                  <Button 
                    onClick={handleGoogleLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <i className="fab fa-google mr-2"></i>
                    Continue with Google
                  </Button>
                  <Button 
                    onClick={handleMicrosoftLogin}
                    className="w-full bg-gray-800 hover:bg-gray-900 text-white"
                  >
                    <i className="fab fa-microsoft mr-2"></i>
                    Continue with Microsoft
                  </Button>
                  <Button 
                    onClick={() => setShowEmailLogin(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <i className="fas fa-envelope mr-2"></i>
                    Continue with Email
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Button 
                      onClick={handleEmailLogin}
                      className="w-full bg-primary hover:bg-primary-600"
                    >
                      Sign In
                    </Button>
                    <Button 
                      onClick={() => setShowEmailLogin(false)}
                      variant="outline"
                      className="w-full"
                    >
                      Back to Login Options
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
