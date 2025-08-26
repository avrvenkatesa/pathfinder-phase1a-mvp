import React, { useEffect } from 'react';
import ContactSearch from '../components/ContactSearch';
import ContactSelector from '../components/ContactSelector';
import ContactAvailabilityIndicator from '../components/ContactAvailabilityIndicator';
import ContactErrorBoundary from '../components/ContactErrorBoundary';
import { contactMockHelpers, MockContactService } from '../mocks/mockIntegration';
import { Contact } from '../types/contact';

const ContactTest = () => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [mockStats, setMockStats] = React.useState<any>(null);
  const [recentContacts, setRecentContacts] = React.useState<Contact[]>([]);

  useEffect(() => {
    // Enable mock mode for testing
    contactMockHelpers.enableMockMode();
    
    // Get mock statistics
    setMockStats(contactMockHelpers.getMockStats());
    
    // Load some recent contacts
    MockContactService.getContacts({ limit: 3 }).then(result => {
      setRecentContacts(result.contacts);
    });

    // Test real-time updates after 1 second
    setTimeout(() => {
      contactMockHelpers.testRealTimeUpdates();
    }, 1000);
  }, []);

  return (
    <ContactErrorBoundary>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Contact Integration Test</h1>
          <p className="text-gray-600">Testing contact components with mock data</p>
        </div>

        {/* Mock Statistics */}
        {mockStats && (
          <section className="p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-lg font-semibold mb-4 text-blue-800">Mock Data Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-2xl text-blue-600">{mockStats.totalContacts}</div>
                <div className="text-gray-600">Total Contacts</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl text-green-600">{mockStats.availableContacts}</div>
                <div className="text-gray-600">Available</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl text-purple-600">{mockStats.workflowCompatible}</div>
                <div className="text-gray-600">Workflow Ready</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl text-orange-600">{mockStats.departments.length}</div>
                <div className="text-gray-600">Departments</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-2xl text-red-600">{mockStats.skills.length}</div>
                <div className="text-gray-600">Skills</div>
              </div>
            </div>
          </section>
        )}

        {/* Contact Search */}
        <section className="p-6 bg-white rounded-lg shadow-lg border">
          <h2 className="text-xl font-semibold mb-4">🔍 Contact Search</h2>
          <p className="text-gray-600 mb-4">Search through mock contacts with real-time results</p>
          <ContactSearch 
            onSelect={(contact) => {
              console.log('Selected contact:', contact);
              // Show selection in UI
              const notification = document.createElement('div');
              notification.textContent = `Selected: ${contact.firstName} ${contact.lastName}`;
              notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
              document.body.appendChild(notification);
              setTimeout(() => notification.remove(), 3000);
            }}
            multiple={true}
          />
        </section>

        {/* Contact Selector */}
        <section className="p-6 bg-white rounded-lg shadow-lg border">
          <h2 className="text-xl font-semibold mb-4">👥 Contact Selector</h2>
          <p className="text-gray-600 mb-4">Multi-select contact dropdown with limits</p>
          <ContactSelector
            value={selectedIds}
            onChange={setSelectedIds}
            multiple={true}
            maxSelections={3}
          />
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <p className="text-sm font-medium text-gray-700">
              Selected ({selectedIds.length}/3): {selectedIds.join(', ') || 'None'}
            </p>
          </div>
        </section>

        {/* Availability Indicators */}
        <section className="p-6 bg-white rounded-lg shadow-lg border">
          <h2 className="text-xl font-semibold mb-4">🔄 Real-time Availability</h2>
          <p className="text-gray-600 mb-4">Live contact availability indicators (watch for updates after 2-4 seconds)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentContacts.map((contact) => (
              <div key={contact.contactId} className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                    <p className="text-sm text-gray-600">{contact.title}</p>
                  </div>
                </div>
                <ContactAvailabilityIndicator
                  contactId={contact.contactId}
                  showDetails={true}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Test Controls */}
        <section className="p-6 bg-gray-50 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">🧪 Test Controls</h2>
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => contactMockHelpers.testRealTimeUpdates()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Trigger Availability Updates
            </button>
            <button
              onClick={() => {
                const stats = contactMockHelpers.getMockStats();
                console.log('Mock Statistics:', stats);
                alert(`Mock Stats:\n• ${stats.totalContacts} total contacts\n• ${stats.availableContacts} available\n• ${stats.workflowCompatible} workflow-ready`);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Show Mock Stats
            </button>
            <button
              onClick={() => {
                setSelectedIds([]);
                console.log('Reset selections');
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Reset Selections
            </button>
          </div>
        </section>

        {/* Debug Information */}
        <section className="p-4 bg-gray-100 rounded text-xs font-mono">
          <details>
            <summary className="cursor-pointer font-bold mb-2">Debug Information</summary>
            <div className="space-y-2">
              <div><strong>Selected IDs:</strong> {JSON.stringify(selectedIds)}</div>
              <div><strong>Mock Stats:</strong> {JSON.stringify(mockStats, null, 2)}</div>
              <div><strong>Recent Contacts:</strong> {recentContacts.length} loaded</div>
            </div>
          </details>
        </section>
      </div>
    </ContactErrorBoundary>
  );
};

export default ContactTest;