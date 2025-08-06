import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowDown, 
  Target, 
  Star, 
  Users, 
  Brain,
  CheckCircle
} from 'lucide-react';

export function AssignmentOutputGuide() {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Target className="h-5 w-5" />
          Where to Find Assignment Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-bold">
            1
          </div>
          <div>
            <p className="font-medium">Click "Run Assignment Engine" on any scenario</p>
            <p className="text-sm text-gray-600">The button is at the bottom of each task card</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ArrowDown className="w-8 h-8 text-blue-600 ml-0" />
          <div>
            <p className="font-medium">Results appear below the scenario cards</p>
            <p className="text-sm text-gray-600">A green success banner will show when ready</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm font-bold">
            2
          </div>
          <div>
            <p className="font-medium">View detailed recommendations</p>
            <p className="text-sm text-gray-600">Each recommendation shows scores and reasoning</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">What You'll See:</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span><strong>Overall Match Score</strong> - How well the person fits (0-5 stars)</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-500" />
              <span><strong>Skill Breakdown</strong> - Detailed skill matching analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-500" />
              <span><strong>Workload Status</strong> - Current availability and capacity</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              <span><strong>Assign Button</strong> - Click to confirm the assignment</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Badge variant="outline" className="bg-white">
            Results display in real-time as cards with scoring details
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}