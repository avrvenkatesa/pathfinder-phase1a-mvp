import('./server/appRoutes.ts')
  .then(m => console.log({ hasDefault: !!m.default, hasRegisterRoutes: !!m.registerRoutes }))
  .catch(err => { console.error(err); process.exit(1) });
