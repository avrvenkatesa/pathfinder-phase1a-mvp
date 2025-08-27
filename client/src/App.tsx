import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import ContactDetail from "@/pages/contact-detail";
import WorkflowPage from "@/pages/workflow";
import { WorkflowDashboard } from "@/components/workflow-dashboard";
import { NewWorkflow } from "@/components/new-workflow";
import ContactTest from "@/pages/ContactTest";
import TestContactIntegration from "@/pages/TestContactIntegration";
import AssignmentEnginePage from "@/pages/AssignmentEnginePage";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Handle OAuth redirects
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    console.log('Checking OAuth params:', { token: !!token, userParam: !!userParam, url: window.location.href });
    
    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('OAuth login successful, redirecting to dashboard:', user);
        
        // Clear URL params and redirect
        window.history.replaceState({}, document.title, '/');
        
        // Trigger auth refresh by reloading
        setTimeout(() => {
          window.location.reload();
        }, 50);
      } catch (error) {
        console.error('Error parsing OAuth redirect:', error);
      }
    } else {
      // Debug: log current auth state
      const existingToken = localStorage.getItem('accessToken');
      const existingUser = localStorage.getItem('user');
      console.log('Current auth state:', { 
        hasToken: !!existingToken, 
        hasUser: !!existingUser,
        isAuthenticated,
        isLoading 
      });
    }
  }, [isAuthenticated, isLoading]);

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/contacts/:id" component={ContactDetail} />
          <Route path="/workflows" component={WorkflowDashboard} />
          <Route path="/workflows/new" component={NewWorkflow} />
          <Route path="/workflows/:id" component={WorkflowPage} />
          <Route path="/contact-test" component={ContactTest} />
          <Route path="/test-contacts" component={TestContactIntegration} />
          <Route path="/assignment-engine" component={AssignmentEnginePage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
