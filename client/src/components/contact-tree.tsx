import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Contact } from "@shared/schema";
import { Building, User, Mail, Phone, Eye, Edit, Trash2, ChevronRight, ChevronDown } from "lucide-react";

interface ContactNodeProps {
  contact: Contact;
  level: number;
}

function ContactNode({ contact, level }: ContactNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${contact.name}?`)) {
      deleteMutation.mutate(contact.id);
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/contacts/${contact.id}`);
  };

  const toggleExpanded = () => {
    if (contact.children && contact.children.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleContactClick = () => {
    setLocation(`/contacts/${contact.id}`);
  };

  const getBgColor = () => {
    switch (contact.type) {
      case 'company':
        return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
      case 'division':
        return 'bg-orange-50 border-orange-200 hover:bg-orange-100';
      case 'person':
        return 'bg-white border-gray-200 hover:bg-gray-50';
      default:
        return 'bg-white border-gray-200 hover:bg-gray-50';
    }
  };

  const getIcon = () => {
    switch (contact.type) {
      case 'company':
        return 'fas fa-building';
      case 'division':
        return 'fas fa-layer-group';
      case 'person':
        return 'fas fa-user';
      default:
        return 'fas fa-circle';
    }
  };

  const getIconBg = () => {
    switch (contact.type) {
      case 'company':
        return 'bg-blue-600';
      case 'division':
        return 'bg-orange-600';
      case 'person':
        return 'bg-gray-600';
      default:
        return 'bg-gray-600';
    }
  };

  const hasChildren = contact.children && contact.children.length > 0;
  const marginLeftClass = level > 0 ? `ml-${level * 8}` : '';

  return (
    <div className={`mb-4 ${marginLeftClass}`}>
      <div
        className={`flex items-center p-4 rounded-lg border transition-colors cursor-pointer ${getBgColor()}`}
        onClick={handleContactClick}
      >
        <div className="flex items-center flex-1">
          {hasChildren ? (
            <i
              className={`fas ${
                isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'
              } text-gray-400 mr-3 text-sm transition-transform cursor-pointer hover:text-gray-600`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded();
              }}
            />
          ) : (
            <div className="w-4 mr-3" />
          )}
          <div className={`w-${contact.type === 'company' ? '10 h-10' : '8 h-8'} ${getIconBg()} rounded-lg flex items-center justify-center mr-4`}>
            <i className={`${getIcon()} text-white ${contact.type === 'person' ? 'text-sm' : ''}`}></i>
          </div>
          <div className="flex-1">
            <h4 className={`${contact.type === 'company' ? 'text-lg' : 'text-base'} font-semibold text-gray-900`}>
              {contact.name}
            </h4>
            {contact.description && (
              <p className="text-sm text-gray-600">{contact.description}</p>
            )}
            {contact.title && (
              <p className="text-sm text-gray-600">{contact.title}</p>
            )}
            {contact.email && (
              <p className="text-xs text-gray-500">{contact.email}</p>
            )}
            {contact.type !== 'person' && hasChildren && (
              <div className="flex items-center mt-1">
                {contact.type === 'company' && (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {contact.children?.filter(c => c.type === 'division').length || 0} divisions
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 ml-2">
                      {contact.children?.filter(c => c.type === 'person').length || 0} people
                    </span>
                  </>
                )}
                {contact.type === 'division' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                    {contact.children?.length || 0} people
                  </span>
                )}
              </div>
            )}
            {contact.type === 'person' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">
                Active
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-md"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Implement edit functionality
            }}
          >
            <i className="fas fa-edit"></i>
          </button>
          <button
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-md"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <i className="fas fa-trash"></i>
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="mt-4 space-y-3">
          {contact.children?.map((child) => (
            <ContactNode key={child.id} contact={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContactTree() {
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree');
  const { toast } = useToast();

  const { data: contacts, isLoading, error } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/hierarchy"],
    retry: false,
  });

  if (error && isUnauthorizedError(error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Contact Hierarchy</h3>
          <div className="flex rounded-md shadow-sm" role="group">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('tree')}
              className="rounded-r-none"
            >
              <i className="fas fa-sitemap mr-2"></i>Tree
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="rounded-l-none"
            >
              <i className="fas fa-th-large mr-2"></i>Cards
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : contacts && contacts.length > 0 ? (
          <div className="space-y-6">
            {contacts.map((contact) => (
              <ContactNode key={contact.id} contact={contact} level={0} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-address-book text-gray-400 text-xl"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
            <p className="text-gray-500">Get started by adding your first contact.</p>
          </div>
        )}
      </div>
    </div>
  );
}