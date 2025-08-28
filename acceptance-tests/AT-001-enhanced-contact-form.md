# AT-001: Enhanced Contact Form with Workflow Fields

## Test Information
- **Test ID**: AT-001
- **Test Name**: Enhanced Contact Form with Workflow Fields
- **Priority**: High
- **Estimated Duration**: 15 minutes
- **Status**: IN_PROGRESS

## Test Objective
Verify that the enhanced contact form correctly displays and processes all new workflow-specific fields with appropriate contextual content based on contact type (person vs company/division), including validation and data persistence.

## Prerequisites
1. Application is running at http://localhost:5000
2. User is authenticated (use Google OAuth or test@example.com credentials)
3. Database schema has been updated with enhanced fields

## Test Steps

### Step 1: Navigate to Enhanced Contact Form
1. Open browser and navigate to http://localhost:5000
2. Authenticate using Google OAuth (recommended) or test credentials
3. Navigate to the Enhanced Contacts demo page at `/enhanced-contacts`
4. Click the "Create Enhanced Contact" button

**Expected Result**: Enhanced contact form modal opens with multiple tabs

### Step 2: Verify Basic Information Tab
1. Ensure you're on the "Basic" tab
2. Fill in the following fields:
   - Name: "John Smith"
   - Type: Select "person"
   - First Name: "John"
   - Last Name: "Smith"
   - Job Title: "Senior Developer"
   - Department: "Engineering"

**Expected Result**: All fields accept input and validate properly

### Step 3: Verify Contact Details Tab
1. Click on the "Contact" tab
2. Fill in:
   - Email: "john.smith@example.com"
   - Phone: "+1 (555) 123-4567"
   - Secondary Phone: "+1 (555) 987-6543"
   - Address: "123 Tech Street, Silicon Valley, CA"
   - Website: "https://johnsmith.dev"

**Expected Result**: Email and phone validation works, website URL validation works

### Step 4: Verify Skills Tab (Enhanced)
1. Click on the "Skills" tab
2. **For Person type**: Add skills by clicking predefined skill buttons (e.g., "JavaScript", "React")
3. **For Person type**: Verify skill badges appear with remove (X) buttons
4. **For Person type**: Test availability status dropdown (Available, Busy, etc.)
5. **For Person type**: Add preferred work hours: "9am-5pm PST"
6. **For Company/Division**: Verify contextual message "Skills Management Not Applicable" appears

**Expected Result**: 
- Person: Skills are added/removed properly, availability status saves
- Company/Division: Shows explanatory message about skills being managed at person level

### Step 5: Verify Enhanced Workflow Configuration
1. Click on "Workflow" tab
2. **For Person type**: Fill in the following workflow fields:
   - Workflow Role: Select "executor"
   - Max Concurrent Tasks: 8
   - Cost Per Hour: 75.50
   - Timezone: "America/Los_Angeles"
   - Current Workload: 3
3. **For Person type**: Add languages by typing "Spanish" and pressing Enter
4. **For Person type**: Add "French" using the plus button
5. **For Company/Division**: Verify contextual message "Workflow Configuration Not Applicable" appears

**Expected Result**: 
- Person: All workflow fields accept appropriate data types and validate correctly
- Company/Division: Shows explanatory message with tip about adding individual contacts

### Step 6: Submit Enhanced Contact
1. Click "Save Contact" button
2. Wait for success notification

**Expected Result**: 
- Success toast notification appears
- Form closes
- Contact is created with all enhanced fields

### Step 7: Verify Data Persistence
1. Check that the new contact appears in the system
2. Use browser dev tools to check API response for new workflow fields

**Expected Result**: Contact data includes all new workflow fields (workflowRole, maxConcurrentTasks, costPerHour, timezone, languages, currentWorkload)

## Acceptance Criteria
- [ ] Enhanced contact form opens with tabbed interface
- [ ] Required fields show red asterisk (*) visual indicator
- [ ] Skills and Workflow tabs show contextual content based on contact type:
  - [ ] Person: Full functionality with all fields available
  - [ ] Company/Division: Informative messages explaining why tabs aren't applicable
- [ ] All new workflow fields are present and functional (for Person type)
- [ ] Field validation works for all input types
- [ ] Data saves successfully to database with enhanced schema
- [ ] Languages can be added and removed dynamically (for Person type)
- [ ] Numeric fields (maxConcurrentTasks, costPerHour, currentWorkload) validate ranges
- [ ] Success feedback is provided to user
- [ ] No JavaScript errors in console

## Test Data
```json
{
  "testContact": {
    "name": "John Smith",
    "type": "person",
    "firstName": "John",
    "lastName": "Smith",
    "jobTitle": "Senior Developer",
    "department": "Engineering",
    "email": "john.smith@example.com",
    "phone": "+1 (555) 123-4567",
    "secondaryPhone": "+1 (555) 987-6543",
    "address": "123 Tech Street, Silicon Valley, CA",
    "website": "https://johnsmith.dev",
    "skills": ["JavaScript", "React"],
    "availabilityStatus": "available",
    "preferredWorkHours": "9am-5pm PST",
    "workflowRole": "executor",
    "maxConcurrentTasks": 8,
    "costPerHour": 75.50,
    "timezone": "America/Los_Angeles",
    "languages": ["Spanish", "French"],
    "currentWorkload": 3
  }
}
```

## Notes for Execution
- Take screenshots at each major step
- Note any UI/UX issues encountered
- Check browser console for JavaScript errors
- Verify API requests/responses in Network tab
- Document any performance issues

## Test Result Template
```
Status: [PASSED/FAILED/BLOCKED]
Duration: [X minutes]
Issues Found: [Number]
Notes: [Additional observations]
```