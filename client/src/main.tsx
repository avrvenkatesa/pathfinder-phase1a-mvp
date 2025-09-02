// client/src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerWorkflowCrossTabHandlers } from "./workflow/bootstrapCrossTab";

// Register cross-tab handlers BEFORE rendering so we don't miss early events
registerWorkflowCrossTabHandlers();

createRoot(document.getElementById("root")!).render(<App />);
