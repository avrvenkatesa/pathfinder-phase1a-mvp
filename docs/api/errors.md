
Errors Catalog

All errors use the standard envelope:

{ "message": "Human-readable text", "code": "OPTIONAL_MACHINE_CODE", "details": { } }

Common Cases
HTTP	When	Example
400	Invalid query param/body	{ "message": "Invalid status 'bogus'" }
400	Invalid cursor	{ "message": "Invalid cursor" }
404	Resource not found	{ "message": "Instance not found" }
409	Conflict	{ "message": "Cannot delete contact with active workflow assignments", "code": "CONTACT_HAS_ACTIVE_ASSIGNMENTS" }
500	Server error	{ "message": "Internal Server Error" }

For endpoints with domain-specific failure modes, include a "code" that is stable for clients to branch on.
