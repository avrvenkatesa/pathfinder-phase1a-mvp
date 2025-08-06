import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import type { User } from "@shared/schema";

export default function Header() {
  const { user } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const displayName = user ? `${(user as User).firstName || ''} ${(user as User).lastName || ''}`.trim() || 'User' : 'User';

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <i className="fas fa-route text-primary text-2xl mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">PathFinder</h1>
            </div>
            <nav className="ml-10 flex space-x-8">
              <Link 
                href="/" 
                className={`px-1 pb-4 text-sm font-medium ${
                  location === '/' 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Contacts
              </Link>
              <Link 
                href="/workflows" 
                className={`px-1 pb-4 text-sm font-medium ${
                  location.startsWith('/workflows') 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Workflows
              </Link>
              <Link 
                href="/assignment-engine" 
                className={`px-1 pb-4 text-sm font-medium ${
                  location.startsWith('/assignment-engine') 
                    ? 'text-primary border-b-2 border-primary' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Assignment Engine
              </Link>
              <a href="#" className="text-gray-500 hover:text-gray-700 px-1 pb-4 text-sm font-medium">
                Analytics
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 px-1 pb-4 text-sm font-medium">
                Settings
              </a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-gray-400 hover:text-gray-500">
              <i className="fas fa-bell text-lg"></i>
            </button>
            <div className="flex items-center space-x-3 cursor-pointer" onClick={handleLogout}>
              {(user as User)?.profileImageUrl ? (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  <img 
                    src={(user as User).profileImageUrl!} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {getInitials((user as User)?.firstName, (user as User)?.lastName)}
                  </span>
                </div>
              )}
              <span className="text-sm font-medium text-gray-700">{displayName}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}