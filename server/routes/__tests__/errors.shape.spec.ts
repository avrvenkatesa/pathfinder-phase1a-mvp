// server/routes/__tests__/errors.shape.spec.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../../app'; // or wherever you export an express app

const expectEnvelope = (b: any) => {
  expect(b).toHaveProperty('error');
  expect(typeof b.error.code).toBe('string');
  expect(typeof b.error.message).toBe('string');
};

describe('Error envelope', () => {
  it('401 responses use the canonical envelope', async () => {
    const res = await request(app).get('/api/instances'); // gated route
    expect(res.status).toBe(401);
    expectEnvelope(res.body);
  });

  it('404 responses use the canonical envelope', async () => {
    const res = await request(app).get('/definitely/not-here');
    expect(res.status).toBe(404);
    expectEnvelope(res.body);
  });
});
