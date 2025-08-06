import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import type { Contact } from '@shared/schema';

export function SimpleAssignmentTest() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch contacts to work with
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    retry: false,
  });

  // Filter to Editorial department contacts
  const editorialContacts = contacts.filter(contact => 
    contact.department === 'Editorial' && contact.type === 'person'
  );

  const handleSimpleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Simple mock assignment logic
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing

      if (editorialContacts.length === 0) {
        setResult('No Editorial contacts found in your system');
        return;
      }

      // Find the best match for proofreading task
      const proofreadingTask = {
        requiredSkill: 'Proofreading',
        taskType: 'Rush Proofreading Project'
      };

      let bestMatch = null;
      let bestScore = 0;

      editorialContacts.forEach(contact => {
        if (contact.skills && contact.skills.includes('Proofreading')) {
          // Simple scoring based on job title and skills
          let score = 0;
          if (contact.jobTitle?.includes('Copy Editor')) score += 3;
          if (contact.skills.includes('Grammar Check')) score += 2;
          if (contact.skills.includes('Fact Checking')) score += 1;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = contact;
          }
        }
      });

      if (bestMatch) {
        const contact = bestMatch as any;
        setResult(`✅ Best match found: ${contact.firstName} ${contact.lastName} (${contact.jobTitle})
Score: ${bestScore}/6
Skills: ${contact.skills?.join(', ')}
Department: ${contact.department}`);
      } else {
        setResult('No suitable match found for proofreading task');
      }

    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Simple Assignment Test</CardTitle>
        <p className="text-sm text-gray-600">
          Test basic assignment logic with your S4 Editorial team
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Editorial Team Found:</h4>
          <div className="flex flex-wrap gap-2">
            {editorialContacts.map(contact => {
              const c = contact as any;
              return (
                <Badge key={contact.id} variant="outline">
                  {c.firstName} {c.lastName} - {c.jobTitle}
                </Badge>
              );
            })}
          </div>
          {editorialContacts.length === 0 && (
            <p className="text-sm text-gray-500">No Editorial department contacts found</p>
          )}
        </div>

        <Button 
          onClick={handleSimpleTest}
          disabled={loading || editorialContacts.length === 0}
          className="w-full"
        >
          {loading ? 'Running Simple Assignment Test...' : 'Test Assignment Logic'}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">Assignment Result:</h4>
            <pre className="text-sm whitespace-pre-wrap">{result}</pre>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p><strong>Test Task:</strong> Rush Proofreading Project</p>
          <p><strong>Required Skill:</strong> Proofreading</p>
          <p><strong>Logic:</strong> Score based on job title match and related skills</p>
        </div>
      </CardContent>
    </Card>
  );
}