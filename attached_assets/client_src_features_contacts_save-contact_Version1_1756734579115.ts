import { emitContactChanged } from "./events";
// ... after successful POST/PUT to /api/contacts/:id
emitContactChanged({ id: savedContact.id, summary: savedContact });