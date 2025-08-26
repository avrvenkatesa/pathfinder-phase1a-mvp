import React, { useState } from 'react';
import { useContacts, useContactSearch, useContactAvailability, useContactServiceStatus } from '../hooks/useContacts';
import ContactSearch from '../components/ContactSearch';
import ContactSelector from '../components/ContactSelector';
import ContactAvailabilityIndicator from '../components/ContactAvailabilityIndicator';
import ContactErrorBoundary from '../components/ContactErrorBoundary';
import ContactServiceStatus from '../components/ContactServiceStatus';

const TestContactIntegration = () => {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const { contacts, loading, error, refetch } = useContacts();
  const { search, results, loading: searching } = useContactSearch();
  const { availability } = useContactAvailability(selectedContacts);
  const serviceStatus = useContactServiceStatus();

  return (
    <ContactErrorBoundary>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Contact Integration Test Page</h1>
          <ContactServiceStatus />
        </div>
        
        {/* API Status Alert */}
        <ContactServiceStatus showFullAlert={true} className="mb-6" />
        
        {/* Test 1: Basic Contact List */}
        <section className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">1. Contact List (useContacts hook)</h2>
          {loading && <div className="text-blue-600">Loading contacts...</div>}
          {error && <div className="text-red-500 p-3 bg-red-50 rounded">Error: {error.message}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts?.slice(0, 4).map(contact => (
              <div key={contact.contactId} className="p-4 border rounded hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                    <p className="text-sm text-gray-600">{contact.title} • {contact.department}</p>
                  </div>
                </div>
                <ContactAvailabilityIndicator 
                  contactId={contact.contactId} 
                  showDetails={true}
                />
              </div>
            ))}
          </div>
          <button 
            onClick={() => refetch()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Contacts'}
          </button>
          <div className="mt-2 text-sm text-gray-600">
            Total contacts: {contacts?.length || 0}
          </div>
        </section>

        {/* Test 2: Contact Search */}
        <section className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">2. Contact Search Component</h2>
          <p className="text-gray-600 mb-4">Search for contacts by name, title, or department</p>
          <ContactSearch 
            onSelect={(contact) => {
              console.log('Selected contact:', contact);
              // Visual feedback
              const notification = document.createElement('div');
              notification.textContent = `✓ Selected: ${contact.firstName} ${contact.lastName}`;
              notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
              document.body.appendChild(notification);
              setTimeout(() => notification.remove(), 3000);
            }}
            multiple={true}
            requiredSkills={['Editing', 'Design']}
            placeholder="Try searching for 'John', 'Design', or 'Editor'..."
          />
        </section>

        {/* Test 3: Contact Selector */}
        <section className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">3. Contact Selector Dropdown</h2>
          <p className="text-gray-600 mb-4">Multi-select dropdown with maximum selection limit</p>
          <ContactSelector
            value={selectedContacts}
            onChange={setSelectedContacts}
            multiple={true}
            maxSelections={3}
            requiredSkills={['Project Management']}
          />
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <p className="text-sm font-medium text-gray-700">
              Selected ({selectedContacts.length}/3): {selectedContacts.join(', ') || 'None'}
            </p>
            {selectedContacts.length >= 3 && (
              <p className="text-xs text-orange-600 mt-1">Maximum selection reached</p>
            )}
          </div>
        </section>

        {/* Test 4: Real-time Availability */}
        <section className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">4. Real-time Availability (WebSocket Simulation)</h2>
          <p className="text-gray-600 mb-4">Live contact availability updates</p>
          
          {selectedContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedContacts.map(contactId => {
                const contact = contacts?.find(c => c.contactId === contactId);
                if (!contact) return null;
                
                const currentAvailability = availability.get(contactId);
                
                return (
                  <div key={contactId} className="p-4 border rounded bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{contact.firstName} {contact.lastName}</p>
                        <p className="text-xs text-gray-600">{contact.title}</p>
                      </div>
                    </div>
                    
                    <ContactAvailabilityIndicator 
                      contactId={contactId} 
                      showDetails={true}
                    />
                    
                    <div className="mt-3 text-xs space-y-1">
                      <div><strong>Base Status:</strong> {contact.availability}</div>
                      {currentAvailability && (
                        <div><strong>Live Status:</strong> {currentAvailability.availability}</div>
                      )}
                      <div><strong>Workload:</strong> {contact.workload.currentWorkload}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded">
              <p>👆 Select contacts above to see their real-time availability</p>
              <p className="text-sm mt-1">Updates will simulate every few seconds</p>
            </div>
          )}
        </section>

        {/* Test 5: Hook Testing */}
        <section className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">5. React Hooks Testing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Search Hook Test */}
            <div className="p-4 bg-blue-50 rounded">
              <h3 className="font-medium mb-3">useContactSearch Hook</h3>
              <input
                type="text"
                placeholder="Type to search..."
                onChange={(e) => {
                  if (e.target.value.length >= 2) {
                    search(e.target.value);
                  }
                }}
                className="w-full p-2 border rounded mb-2"
              />
              {searching && <p className="text-blue-600 text-sm">Searching...</p>}
              <div className="text-sm">
                <strong>Results:</strong> {results.length} found
                {results.slice(0, 3).map(result => (
                  <div key={result.contactId} className="text-xs text-gray-600 ml-4">
                    • {result.firstName} {result.lastName} ({Math.round(result.relevanceScore * 100)}% match)
                  </div>
                ))}
              </div>
            </div>

            {/* Availability Hook Test */}
            <div className="p-4 bg-green-50 rounded">
              <h3 className="font-medium mb-3">useContactAvailability Hook</h3>
              <div className="text-sm space-y-2">
                <div><strong>Monitoring:</strong> {selectedContacts.length} contacts</div>
                <div><strong>Live Updates:</strong> {availability.size} received</div>
                <div><strong>Connection:</strong> 
                  <span className="ml-1 px-2 py-1 bg-green-600 text-white rounded text-xs">
                    Simulated
                  </span>
                </div>
                {availability.size > 0 && (
                  <div className="mt-2">
                    <strong>Latest Updates:</strong>
                    {Array.from(availability.entries()).map(([id, update]) => (
                      <div key={id} className="text-xs text-gray-600 ml-4">
                        • Contact {id}: {update.availability}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Test 6: Error Boundary Test */}
        <section className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">6. Error Handling Test</h2>
          <p className="text-gray-600 mb-4">Test error boundary and error handling mechanisms</p>
          
          <div className="flex gap-4">
            <button
              onClick={() => {
                throw new Error('Test error boundary - component crash simulation');
              }}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              🚫 Trigger Component Error
            </button>
            
            <button
              onClick={() => {
                console.error('Test console error');
                alert('Check the browser console for error logs');
              }}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              📋 Test Console Logging
            </button>
            
            <button
              onClick={() => {
                // Simulate network error
                setSelectedContacts(['invalid-id']);
              }}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              🌐 Test Invalid Data
            </button>
          </div>
        </section>

        {/* Debug Info */}
        <section className="p-4 bg-gray-100 rounded text-xs font-mono">
          <details>
            <summary className="cursor-pointer font-bold mb-2">🐛 Debug Information</summary>
            <div className="space-y-2">
              <div><strong>Contacts loaded:</strong> {contacts?.length || 0}</div>
              <div><strong>Loading state:</strong> {loading.toString()}</div>
              <div><strong>Error state:</strong> {error?.message || 'None'}</div>
              <div><strong>Selected contacts:</strong> [{selectedContacts.join(', ')}]</div>
              <div><strong>Search results:</strong> {results.length}</div>
              <div><strong>Availability updates:</strong> {availability.size}</div>
              <div><strong>Component status:</strong> All components rendered successfully</div>
            </div>
          </details>
        </section>
      </div>
    </ContactErrorBoundary>
  );
};

export default TestContactIntegration;