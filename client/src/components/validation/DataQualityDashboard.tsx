import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ValidationSummary } from './ValidationFeedback';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface DataQualityMetrics {
  entity_type: string;
  total_validations: number;
  successful_validations: number;
  failed_validations: number;
  warnings: number;
  success_rate: number;
}

interface ValidationFailure {
  id: number;
  entity_type: string;
  entity_id: string;
  error_message: string;
  severity: string;
  validated_at: string;
  rule_name?: string;
  rule_domain?: string;
}

export function DataQualityDashboard() {
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7d');

  const { data: dataQuality, isLoading: isLoadingQuality, refetch: refetchQuality } = useQuery({
    queryKey: ['/api/validation/reports/data-quality', selectedEntityType, timeRange],
    retry: false,
  });

  const { data: failures, isLoading: isLoadingFailures, refetch: refetchFailures } = useQuery({
    queryKey: ['/api/validation/reports/failures', selectedEntityType, timeRange],
    retry: false,
  });

  const { data: performance, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ['/api/validation/reports/performance'],
    retry: false,
  });

  const refreshAll = () => {
    refetchQuality();
    refetchFailures();
  };

  const totalMetrics = dataQuality?.summary ? {
    totalValidations: dataQuality.summary.totalValidations,
    passed: dataQuality.summary.passedValidations,
    failed: dataQuality.summary.failedValidations,
    warnings: dataQuality.summary.warningsCount,
    errors: dataQuality.summary.failedValidations
  } : {
    totalValidations: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: 0
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Data Quality Dashboard</h2>
          <p className="text-gray-600">Monitor validation metrics across your platform</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select entity type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entity Types</SelectItem>
              <SelectItem value="contact">Contacts</SelectItem>
              <SelectItem value="workflow">Workflows</SelectItem>
              <SelectItem value="cross-system">Cross-System</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={refreshAll}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Summary */}
      <ValidationSummary
        totalValidations={totalMetrics.totalValidations}
        passed={totalMetrics.passed}
        failed={totalMetrics.failed}
        warnings={totalMetrics.warnings}
        errors={totalMetrics.errors}
      />

      <Tabs defaultValue="quality" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="failures">Recent Failures</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingQuality ? (
              <div className="col-span-full flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : dataQuality?.dataQuality?.length > 0 ? (
              dataQuality.dataQuality.map((metric: DataQualityMetrics) => (
                <Card key={metric.entity_type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg capitalize">
                      {metric.entity_type.replace('-', ' ')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Success Rate</span>
                        <Badge variant={metric.success_rate >= 90 ? "default" : metric.success_rate >= 70 ? "secondary" : "destructive"}>
                          {metric.success_rate.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            metric.success_rate >= 90 ? 'bg-green-500' :
                            metric.success_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metric.success_rate}%` }}
                        ></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-green-600 font-medium">{metric.successful_validations}</div>
                          <div className="text-gray-500">Passed</div>
                        </div>
                        <div>
                          <div className="text-red-600 font-medium">{metric.failed_validations}</div>
                          <div className="text-gray-500">Failed</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No validation data available for the selected filters.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="failures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Recent Validation Failures
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFailures ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : failures?.failures?.length > 0 ? (
                <div className="space-y-3">
                  {failures.failures.map((failure: ValidationFailure) => (
                    <div key={failure.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {failure.entity_type}
                            </Badge>
                            <Badge variant={failure.severity === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                              {failure.severity}
                            </Badge>
                            {failure.rule_name && (
                              <Badge variant="outline" className="text-xs">
                                {failure.rule_name}
                              </Badge>
                            )}
                          </div>
                          <div className="font-medium">Entity ID: {failure.entity_id}</div>
                          <div className="text-sm text-gray-600">
                            {failure.error_message || 'Unknown error'}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(failure.validated_at), 'MMM dd, HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    No recent validation failures found.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Validation Volume (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPerformance ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : performance?.performance?.length > 0 ? (
                  <div className="space-y-2">
                    {performance.performance.map((perf: any, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">
                          {perf.metric}
                        </span>
                        <span className="font-medium">{perf.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    No performance data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Cache Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {performance?.cacheStats ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cache Size</span>
                      <span className="font-medium">{performance.cacheStats.size} entries</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">TTL</span>
                      <span className="font-medium">{Math.round(performance.cacheStats.ttl / 1000)}s</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    Cache statistics not available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}