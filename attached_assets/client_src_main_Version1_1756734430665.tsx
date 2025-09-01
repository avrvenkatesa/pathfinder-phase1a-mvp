import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerWorkflowCrossTabHandlers } from "@/workflow/bootstrapCrossTab";

// Register cross-tab handlers before rendering
registerWorkflowCrossTabHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);