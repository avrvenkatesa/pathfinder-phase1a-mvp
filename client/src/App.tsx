import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
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
import EnhancedContactDemo from "@/components/enhanced-contact-demo";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

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
          <Route path="/enhanced-contacts" component={EnhancedContactDemo} />
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
