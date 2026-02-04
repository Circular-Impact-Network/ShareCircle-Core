# Testing

## Prerequisites
- Local dev server runs on `http://localhost:3003`.
- Ensure `.env` contains `TEST_CLEANUP_SECRET` for automated cleanup.
- Playwright will start the dev server automatically with `npm run dev` unless one is already running.

## Unit tests (Vitest)
```
npm run test:unit
```

Watch mode:
```
npm run test:unit:watch
```

## E2E tests (Playwright)
```
npm run test:e2e
```

UI runner:
```
npm run test:e2e:ui
```

Headed mode:
```
npm run test:e2e:headed
```

## Notes
- E2E tests create users via `/api/auth/signup` and clean up via `/api/test/cleanup`.
- Upload, detect, and analyze calls are mocked in tests to avoid external dependencies.
