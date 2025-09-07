import React, { useEffect, useState } from 'react';
import { Clock, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  AvailabilityStatus, 
  Contact, 
  ContactAvailabilityUpdate 
} from '@/types/contact';
import { useContactAvailability } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

interface ContactAvailabilityIndicatorProps {
  contact: Contact;
  showDetails?: boolean;
  showWorkload?: boolean;
  showLastActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ContactAvailabilityIndicator({
  contact,
  showDetails = false,
  showWorkload = false,
  showLastActive = false,
  size = 'md',
  className
}: ContactAvailabilityIndicatorProps) {
  const [currentAvailability, setCurrentAvailability] = useState<ContactAvailabilityUpdate | null>(null);
  
  const { 
    availability, 
    isConnected, 
    subscribe 
  } = useContactAvailability([contact.contactId]);

  // Subscribe to real-time updates for this contact
  useEffect(() => {
    const unsubscribe = subscribe(contact.contactId);
    return unsubscribe;
  }, [contact.contactId, subscribe]);

  // Update local state when real-time data changes
  useEffect(() => {
    const update = availability.get(contact.contactId);
    if (update) {
      setCurrentAvailability(update);
    }
  }, [availability, contact.contactId]);

  // Use real-time data if available, otherwise fall back to contact data
  const displayAvailability = currentAvailability?.availability || contact.availability;
  const displayWorkload = currentAvailability?.workload || contact.workload;
  const displayLastActive = currentAvailability?.lastActive || contact.lastActive;

  const getAvailabilityColor = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE: return 'bg-green-500';
      case AvailabilityStatus.BUSY: return 'bg-yellow-500';
      case AvailabilityStatus.OFFLINE: return 'bg-gray-500';
      case AvailabilityStatus.ON_LEAVE: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getAvailabilityVariant = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE: return 'default';
      case AvailabilityStatus.BUSY: return 'secondary';
      case AvailabilityStatus.OFFLINE: return 'secondary';
      case AvailabilityStatus.ON_LEAVE: return 'destructive';
      default: return 'secondary';
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload < 50) return 'text-green-600';
    if (workload < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatLastActive = (lastActive: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(lastActive).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const avatarSize = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  }[size];

  const dotSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }[size];

  if (!showDetails) {
    // Simple indicator mode
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("relative inline-block", className)}>
              <Avatar className={avatarSize}>
                <AvatarImage src={contact.profileImage} />
                <AvatarFallback>
                  {contact.firstName[0]}{contact.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div 
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white",
                  dotSize,
                  getAvailabilityColor(displayAvailability)
                )}
              />
              {!isConnected && (
                <div className="absolute -top-1 -right-1">
                  <WifiOff className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-medium">
                {contact.firstName} {contact.lastName}
              </div>
              <div className="text-sm text-muted-foreground">
                {contact.title} • {contact.department}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getAvailabilityVariant(displayAvailability)}>
                  {displayAvailability}
                </Badge>
                <span className="text-xs">
                  {displayWorkload.currentWorkload}% workload
                </span>
              </div>
              {showLastActive && (
                <div className="text-xs text-muted-foreground">
                  Last active: {formatLastActive(displayLastActive)}
                </div>
              )}
              {!isConnected && (
                <div className="text-xs text-yellow-600 flex items-center gap-1">
                  <WifiOff className="h-3 w-3" />
                  Real-time updates unavailable
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed display mode
  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg border", className)}>
      <div className="relative">
        <Avatar className={avatarSize}>
          <AvatarImage src={contact.profileImage} />
          <AvatarFallback>
            {contact.firstName[0]}{contact.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div 
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white",
            dotSize,
            getAvailabilityColor(displayAvailability)
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {contact.firstName} {contact.lastName}
          </p>
          {!isConnected && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <WifiOff className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Real-time updates unavailable
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground truncate">
          {contact.title} • {contact.department}
        </p>

        {contact.company && (
          <p className="text-xs text-muted-foreground truncate">
            {contact.company.name}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <Badge variant={getAvailabilityVariant(displayAvailability)}>
            {displayAvailability}
          </Badge>

          {showWorkload && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className={cn("text-xs font-medium", getWorkloadColor(displayWorkload.currentWorkload))}>
                {displayWorkload.currentWorkload}% workload
              </span>
            </div>
          )}

          {showLastActive && (
            <span className="text-xs text-muted-foreground">
              {formatLastActive(displayLastActive)}
            </span>
          )}
        </div>

        {showWorkload && displayWorkload.activeProjects > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {displayWorkload.activeProjects} active projects
          </div>
        )}
      </div>

      {currentAvailability && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Wifi className="h-3 w-3 text-green-500" />
            Live
          </div>
        </div>
      )}
    </div>
  );
}