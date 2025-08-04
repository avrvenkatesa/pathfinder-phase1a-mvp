import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
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
              <Button 
                onClick={handleLogin}
                className="w-full bg-primary hover:bg-primary-600"
              >
                Sign In to Get Started
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
