import React from 'react';
import { AlertTriangle, CheckCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContactServiceStatus } from '@/hooks/useContacts';

interface ContactServiceStatusProps {
  showFullAlert?: boolean;
  className?: string;
}

export function ContactServiceStatus({ showFullAlert = false, className }: ContactServiceStatusProps) {
  const { status, isChecking, isUsingMock, isUsingApi, refresh } = useContactServiceStatus();

  if (showFullAlert && isUsingMock) {
    return (
      <Alert className={`border-orange-200 bg-orange-50 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <strong>Using Mock Data</strong>
            <p className="text-sm mt-1">
              API is unavailable. Displaying sample data for development/demo purposes.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isChecking}
            className="ml-4"
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              'Retry API'
            )}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Compact badge version
  return (
    <Badge 
      variant={isUsingApi ? 'default' : isUsingMock ? 'secondary' : 'outline'}
      className={`text-xs ${className}`}
    >
      {isChecking ? (
        <>
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Checking...
        </>
      ) : isUsingApi ? (
        <>
          <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
          Live API
        </>
      ) : isUsingMock ? (
        <>
          <AlertTriangle className="h-3 w-3 mr-1 text-orange-600" />
          Mock Data
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 mr-1" />
          Unknown
        </>
      )}
    </Badge>
  );
}

export default ContactServiceStatus;