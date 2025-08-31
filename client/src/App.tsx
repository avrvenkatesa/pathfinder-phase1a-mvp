import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { onAuthBroadcast, broadcastLogout } from "@/lib/authChannel";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import ContactDetail from "@/pages/contact-detail";
import ContactsPage from "@/pages/contacts";
import WorkflowPage from "@/pages/workflow";
import { WorkflowDashboard } from "@/components/workflow-dashboard";
import { NewWorkflow } from "@/components/new-workflow";
import ContactTest from "@/pages/ContactTest";
import TestContactIntegration from "@/pages/TestContactIntegration";
import AssignmentEnginePage from "@/pages/AssignmentEnginePage";
import DataQualityDashboardPage from "@/pages/data-quality-dashboard";
import { WebSocketTestComponent } from "@/components/WebSocketTestComponent";
import { CrossTabValidationTest } from "@/components/CrossTabValidationTest";
import { CrossTabTestInterface } from "@/components/CrossTabTestInterface";
import CrossTabAlerts from "@/components/CrossTabAlerts";

/** Router stays under the provider (it uses useAuth inside) */
function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Testing routes - available without authentication */}
      <Route path="/websocket-test" component={WebSocketTestComponent} />
      <Route path="/cross-tab-test" component={CrossTabValidationTest} />
      <Route path="/test-validation" component={CrossTabTestInterface} />

      <Route path="/contacts" component={Home} />
      <Route path="/workflows" component={WorkflowDashboard} />
      <Route path="/workflows/new" component={NewWorkflow} />
      <Route path="/workflows/:id" component={WorkflowPage} />
      <Route path="/contacts/:id" component={ContactDetail} />
      <Route path="/contact-test" component={ContactTest} />
      <Route path="/test-contacts" component={TestContactIntegration} />
      <Route path="/assignment-engine" component={AssignmentEnginePage} />
      <Route path="/data-quality" component={DataQualityDashboardPage} />

      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
        </>
      )}

      <Route component={NotFound} />
    </Switch>
  );
}

/** AppShell runs under QueryClientProvider, so hooks are safe here */
function AppShell() {
  const { isAuthenticated } = useAuth();

  // Instantly react to logout in another tab
  useEffect(() => onAuthBroadcast(() => window.location.reload()), []);

  return (
    <>
      {/* Simple global header with Logout */}
      <header className="flex items-center gap-3 p-3 border-b">
        <h1 className="text-lg font-semibold">Pathfinder</h1>
        {isAuthenticated && (
          <div className="ml-auto">
            <button
              type="button"
              className="px-3 py-1 rounded border"
              onClick={() => {
                try {
                  broadcastLogout();
                } finally {
                  window.location.href = "/api/logout";
                }
              }}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <Router />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppShell />
        <CrossTabAlerts />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
