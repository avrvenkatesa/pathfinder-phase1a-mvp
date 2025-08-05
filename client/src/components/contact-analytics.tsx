import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Target, MapPin, Clock, TrendingUp, Building, Briefcase } from 'lucide-react';
import type { Contact } from '@shared/schema';

interface ContactAnalyticsProps {
  contacts: Contact[];
  className?: string;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d0743c', '#82d982'];

export function ContactAnalytics({ contacts, className = "" }: ContactAnalyticsProps) {
  
  // Analytics data computation
  const analytics = useMemo(() => {
    // Basic counts
    const totalContacts = contacts.length;
    const companies = contacts.filter(c => c.type === 'company').length;
    const divisions = contacts.filter(c => c.type === 'division').length;
    const people = contacts.filter(c => c.type === 'person').length;
    
    // Availability breakdown
    const availabilityData = ['available', 'busy', 'partially_available', 'unavailable'].map(status => {
      const count = contacts.filter(c => c.availabilityStatus === status).length;
      return {
        name: status.replace('_', ' ').toUpperCase(),
        value: count,
        percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0
      };
    });
    
    // Department distribution
    const departmentCounts = contacts.reduce((acc, contact) => {
      if (contact.department) {
        acc[contact.department] = (acc[contact.department] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const departmentData = Object.entries(departmentCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    // Location distribution (from notes)
    const locationCounts = contacts.reduce((acc, contact) => {
      if (contact.notes?.includes('Location:')) {
        const locationMatch = contact.notes.match(/Location:\s*([^,\n]+)/);
        if (locationMatch) {
          const location = locationMatch[1].trim();
          acc[location] = (acc[location] || 0) + 1;
        }
      }
      return acc;
    }, {} as Record<string, number>);
    
    const locationData = Object.entries(locationCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 locations
    
    // Skills analysis
    const skillCounts = contacts.reduce((acc, contact) => {
      contact.skills?.forEach(skill => {
        acc[skill] = (acc[skill] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    const topSkills = Object.entries(skillCounts)
      .map(([name, value]) => ({ 
        name, 
        value, 
        percentage: people > 0 ? Math.round((value / people) * 100) : 0 // Percentage of people with this skill
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    
    // Skills gap analysis (skills with low coverage)
    const skillsGap = topSkills.filter(skill => skill.percentage < 30);
    
    // Contact type distribution for pie chart
    const typeData = [
      { 
        name: 'Companies', 
        value: companies, 
        color: '#8884d8',
        percentage: totalContacts > 0 ? Math.round((companies / totalContacts) * 100) : 0
      },
      { 
        name: 'Divisions', 
        value: divisions, 
        color: '#82ca9d',
        percentage: totalContacts > 0 ? Math.round((divisions / totalContacts) * 100) : 0
      },
      { 
        name: 'People', 
        value: people, 
        color: '#ffc658',
        percentage: totalContacts > 0 ? Math.round((people / totalContacts) * 100) : 0
      }
    ];
    
    // Capacity analysis
    const availableCapacity = contacts.filter(c => 
      c.availabilityStatus === 'available' || c.availabilityStatus === 'partially_available'
    ).length;
    
    const capacityUtilization = people > 0 ? Math.round(((people - availableCapacity) / people) * 100) : 0;
    
    // Most connected contacts (those with the most skills or in multiple workflows)
    const mostConnected = contacts
      .filter(c => c.type === 'person')
      .map(contact => ({
        ...contact,
        connectionScore: (contact.skills?.length || 0) + (contact.department ? 1 : 0) + (contact.parentId ? 1 : 0)
      }))
      .sort((a, b) => b.connectionScore - a.connectionScore)
      .slice(0, 10);
    
    return {
      totalContacts,
      companies,
      divisions,
      people,
      availabilityData,
      departmentData,
      locationData,
      topSkills,
      skillsGap,
      typeData,
      availableCapacity,
      capacityUtilization,
      mostConnected
    };
  }, [contacts]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{analytics.totalContacts}</p>
                <p className="text-sm text-gray-600">Total Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Building className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{analytics.companies}</p>
                <p className="text-sm text-gray-600">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Briefcase className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{analytics.divisions}</p>
                <p className="text-sm text-gray-600">Divisions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{analytics.availableCapacity}</p>
                <p className="text-sm text-gray-600">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Contact Type Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Availability Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Availability Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.availabilityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Briefcase className="h-5 w-5" />
              <span>Department Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Location Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Top Locations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.locationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8dd1e1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Top Skills</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.topSkills.slice(0, 8).map((skill, index) => (
              <div key={skill.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{skill.name}</span>
                  <Badge variant="secondary">{skill.value} people</Badge>
                </div>
                <Progress value={skill.percentage} className="h-2" />
                <div className="text-xs text-gray-500">{skill.percentage}% coverage</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Skills Gap Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Skills Gap Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.skillsGap.length > 0 ? (
              analytics.skillsGap.map((skill) => (
                <div key={skill.name} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-yellow-800">{skill.name}</span>
                    <Badge variant="outline" className="border-yellow-300 text-yellow-700">
                      {skill.percentage}%
                    </Badge>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Low coverage - consider training or hiring
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No significant skills gaps identified</p>
                <p className="text-sm">All key skills have good coverage</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Capacity Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Capacity Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-3xl font-bold mb-2">{analytics.capacityUtilization}%</div>
              <div className="text-sm text-gray-600">Capacity Utilization</div>
              <Progress value={analytics.capacityUtilization} className="mt-4" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Available</span>
                <Badge className="bg-green-100 text-green-800">
                  {analytics.availableCapacity}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total People</span>
                <Badge variant="outline">{analytics.people}</Badge>
              </div>
            </div>
            
            {analytics.capacityUtilization > 80 && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800 font-medium">High Utilization Alert</p>
                <p className="text-xs text-red-700 mt-1">
                  Consider expanding team or redistributing workload
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Most Connected Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Most Connected Contacts</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.mostConnected.slice(0, 9).map((contact) => (
              <div key={contact.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{contact.name}</h4>
                  <Badge variant="secondary">{contact.connectionScore}</Badge>
                </div>
                <p className="text-sm text-gray-600">{contact.jobTitle}</p>
                <p className="text-xs text-gray-500">{contact.department}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {contact.skills?.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {(contact.skills?.length || 0) > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{(contact.skills?.length || 0) - 3}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}