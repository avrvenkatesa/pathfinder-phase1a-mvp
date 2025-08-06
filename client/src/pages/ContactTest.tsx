import React from 'react';
import ContactSearch from '../components/ContactSearch';
import ContactSelector from '../components/ContactSelector';
import ContactErrorBoundary from '../components/ContactErrorBoundary';

const ContactTest = () => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  return (
    <ContactErrorBoundary>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Contact Integration Test</h1>
        
        <section className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Contact Search</h2>
          <ContactSearch 
            onSelect={(contact) => console.log('Selected:', contact)}
            multiple={true}
          />
        </section>

        <section className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Contact Selector</h2>
          <ContactSelector
            value={selectedIds}
            onChange={setSelectedIds}
            multiple={true}
            maxSelections={3}
          />
          <p className="mt-2 text-sm text-gray-600">
            Selected: {selectedIds.join(', ') || 'None'}
          </p>
        </section>
      </div>
    </ContactErrorBoundary>
  );
};

export default ContactTest;