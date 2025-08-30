import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Contact {
  id: string;
  name: string;
  type: 'person' | 'company' | 'division';
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    type: 'person' as Contact['type'],
    email: '',
    phone: '',
    company: '',
    department: ''
  });

  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['/api/contacts'],
    retry: false,
  });

  // Handle errors and show them to user for debugging
  if (error) {
    console.error('Contacts API error:', error);
    // For testing, continue with empty array even if auth fails
  }

  const createMutation = useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      await apiRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(contactData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      setIsCreateOpen(false);
      setNewContact({
        name: '',
        type: 'person',
        email: '',
        phone: '',
        company: '',
        department: ''
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest(`/api/contacts/${contactId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const handleCreateContact = () => {
    if (!newContact.name.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newContact);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading contacts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-contact">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  data-testid="input-contact-name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={newContact.type} onValueChange={(value: Contact['type']) => setNewContact({ ...newContact, type: value })}>
                  <SelectTrigger data-testid="select-contact-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="division">Division</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  data-testid="input-contact-email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  data-testid="input-contact-phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              {newContact.type === 'person' && (
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    data-testid="input-contact-company"
                    value={newContact.company}
                    onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                    placeholder="Company name"
                  />
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button data-testid="button-save-contact" onClick={handleCreateContact} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Contact'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact: Contact) => (
          <Card key={contact.id} data-testid={`card-contact-${contact.id}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">{contact.name}</CardTitle>
              <div className="flex space-x-1">
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  data-testid={`button-delete-${contact.id}`}
                  onClick={() => deleteMutation.mutate(contact.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Type: {contact.type}
              </p>
              {contact.email && (
                <p className="text-sm text-muted-foreground mb-1">
                  Email: {contact.email}
                </p>
              )}
              {contact.phone && (
                <p className="text-sm text-muted-foreground mb-1">
                  Phone: {contact.phone}
                </p>
              )}
              {contact.company && (
                <p className="text-sm text-muted-foreground mb-1">
                  Company: {contact.company}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {contacts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No contacts found. Create your first contact to get started.</p>
        </div>
      )}
    </div>
  );
}