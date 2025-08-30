import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Eye, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { contactWebSocketService } from "@/services/contact-websocket.service";

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string;
}

interface WebSocketMessage {
  type: string;
  contactId: string;
  timestamp: string;
  data?: any;
  affectedWorkflows?: string[];
}

export function CrossTabTestInterface() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [workflowId] = useState("test-workflow-cross-tab");

  // WebSocket event handler
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    console.log("Received WebSocket message:", message);
    setWsMessages(prev => [message, ...prev.slice(0, 9)]); // Keep last 10 messages
    
    if (message.type === 'CONTACT_DELETED') {
      toast({
        title: "🚨 Cross-Tab Validation Alert",
        description: `Contact "${message.data?.name || message.contactId}" was deleted in another tab! This contact was assigned to workflow: ${message.affectedWorkflows?.join(', ') || 'Unknown'}`,
        variant: "destructive",
        duration: 5000,
      });
    } else if (message.type === 'CONTACT_MODIFIED') {
      toast({
        title: "⚠️ Cross-Tab Validation Alert", 
        description: `Contact "${message.data?.contactName || message.contactId}" was modified in another tab! This may affect workflow assignments.`,
        variant: "default",
        duration: 5000,
      });
    }
  };

  // Subscribe to workflow events
  useEffect(() => {
    if (isSubscribed) {
      const unsubscribe = contactWebSocketService.subscribeToWorkflow(workflowId, handleWebSocketMessage);
      
      toast({
        title: "✅ Subscribed to Workflow Events",
        description: `Now listening for contact changes affecting workflow: ${workflowId}`,
        duration: 3000,
      });

      return () => {
        unsubscribe();
        toast({
          title: "🔌 Unsubscribed from Workflow Events", 
          description: "No longer listening for cross-tab events",
          duration: 2000,
        });
      };
    }
  }, [isSubscribed, workflowId, toast]);

  // Load contacts
  const loadContacts = async () => {
    try {
      const response = await fetch('/api/contacts', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // Create contact
  const createContact = async () => {
    if (!newContactName.trim()) return;

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContactName,
          type: 'person',
          email: `${newContactName.toLowerCase().replace(/\s+/g, '.')}@example.com`
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const newContact = await response.json();
        setContacts(prev => [...prev, newContact]);
        setNewContactName("");
        toast({
          title: "✅ Contact Created",
          description: `Created contact: ${newContact.name}`,
          duration: 2000,
        });
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to create contact",
        variant: "destructive",
      });
    }
  };

  // Delete contact  
  const deleteContact = async (contact: Contact) => {
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setContacts(prev => prev.filter(c => c.id !== contact.id));
        toast({
          title: "🗑️ Contact Deleted",
          description: `Deleted contact: ${contact.name}. WebSocket event broadcasted to other tabs!`,
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Cross-Tab Validation Test Interface</h1>
        <p className="text-muted-foreground">
          Test real-time contact validation across browser tabs with WebSocket integration
        </p>
      </div>

      {/* Workflow Subscription Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Workflow Event Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setIsSubscribed(!isSubscribed)}
              variant={isSubscribed ? "destructive" : "default"}
              data-testid="button-toggle-subscription"
            >
              {isSubscribed ? "Unsubscribe" : "Subscribe"} to {workflowId}
            </Button>
            <Badge variant={isSubscribed ? "default" : "secondary"}>
              {isSubscribed ? "🟢 Listening" : "🔴 Not Listening"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isSubscribed 
              ? "You will receive alerts when contacts assigned to this workflow are modified in other tabs"
              : "Click subscribe to start receiving cross-tab validation alerts"
            }
          </p>
        </CardContent>
      </Card>

      {/* Contact Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Contact Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter contact name"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createContact()}
              data-testid="input-contact-name"
            />
            <Button onClick={createContact} data-testid="button-create-contact">
              Create Contact
            </Button>
          </div>

          <div className="grid gap-2">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{contact.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">({contact.type})</span>
                  {contact.email && (
                    <span className="text-sm text-muted-foreground ml-2">{contact.email}</span>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteContact(contact)}
                  data-testid={`button-delete-${contact.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {contacts.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No contacts yet. Create one to test cross-tab validation!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* WebSocket Event Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Live Event Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {wsMessages.map((message, index) => (
              <div key={index} className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={message.type === 'CONTACT_DELETED' ? 'destructive' : 'default'}>
                    {message.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <strong>Contact:</strong> {message.data?.name || message.contactId}
                </div>
                {message.affectedWorkflows && (
                  <div>
                    <strong>Affected Workflows:</strong> {message.affectedWorkflows.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {wsMessages.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No events yet. Create/delete contacts to see real-time events!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>🧪 How to Test Cross-Tab Validation</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li><strong>Subscribe to workflow events</strong> using the button above</li>
            <li><strong>Create a contact</strong> using the form</li>
            <li><strong>Open another tab</strong> to this same page (or /contacts)</li>
            <li><strong>Delete the contact</strong> from the other tab</li>
            <li><strong>Watch for validation alerts</strong> in this tab!</li>
          </ol>
          <p className="text-muted-foreground mt-4">
            The system broadcasts targeted events with <code>affectedWorkflows: ['{workflowId}']</code> 
            and routes them only to subscribed workflow tabs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}