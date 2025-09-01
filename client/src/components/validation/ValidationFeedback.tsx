import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  value: any;
}

export interface ValidationFeedbackProps {
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  isValid?: boolean;
  isValidating?: boolean;
  className?: string;
}

export function ValidationFeedback({
  errors = [],
  warnings = [],
  isValid = true,
  isValidating = false,
  className = ""
}: ValidationFeedbackProps) {
  if (isValidating) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Validating data...
        </AlertDescription>
      </Alert>
    );
  }

  if (errors.length === 0 && warnings.length === 0) {
    if (isValid) {
      return (
        <Alert className={`${className} border-green-200 bg-green-50`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            All validations passed
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Validation Errors:</div>
              {errors.map((error, index) => (
                <div key={index} className="text-sm">
                  <strong>{error.field}:</strong> {error.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {warnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="space-y-1">
              <div className="font-medium">Validation Warnings:</div>
              {warnings.map((warning, index) => (
                <div key={index} className="text-sm">
                  <strong>{warning.field}:</strong> {warning.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export interface ValidationSummaryProps {
  totalValidations: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: number;
  className?: string;
}

export function ValidationSummary({
  totalValidations,
  passed,
  failed,
  warnings,
  errors,
  className = ""
}: ValidationSummaryProps) {
  const successRate = totalValidations > 0 ? (passed / totalValidations) * 100 : 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Validation Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalValidations}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{passed}</div>
            <div className="text-sm text-gray-600">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{warnings}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{errors}</div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Success Rate</span>
            <span>{successRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${successRate}%` }}
            ></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}