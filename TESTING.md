# Testing Guide

## E2E Tests with Playwright

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/auth-flows.spec.ts

# Run tests in UI mode (interactive)
npx playwright test --ui

# View test report
npx playwright show-report
```

### Email Handling in Tests

**Email sending is automatically disabled during E2E tests** to prevent sending emails to test accounts.

#### How it works:

1. The Playwright config sets `E2E_AUTO_VERIFY=true` environment variable
2. The `lib/email.ts` file checks for this flag and skips email sending
3. Test accounts are auto-verified during signup when this flag is enabled

#### Configuration:

The email system checks these conditions before sending emails:

- `E2E_AUTO_VERIFY=true` - Set automatically by Playwright tests
- `SKIP_EMAIL=true` - Manual flag to disable emails (useful for local development)
- Missing `GMAIL_USER` or `GMAIL_APP_PASSWORD` - Emails are skipped

#### Logs:

When emails are skipped during tests, you'll see console logs like:
```
[E2E Test Mode] Skipping OTP email to e2e+test@example.com (OTP: 123456)
[E2E Test Mode] Skipping password reset email to e2e+test@example.com (token: abc123)
```

### Test Structure

```
tests/e2e/
├── fixtures.ts                  # Test fixtures and storage state paths
├── global-setup.ts              # Creates test users before all tests
├── global-teardown.ts           # Cleans up test data after all tests
├── auth-flows.spec.ts           # Authentication flows (login, signup, etc.)
├── borrow-queue.spec.ts         # Borrow queue functionality
├── borrow-workflow.spec.ts      # Complete borrow workflow
├── circle-management.spec.ts    # Circle CRUD and management
├── circles-items.spec.ts        # Circle and item integration
├── item-management.spec.ts      # Item lifecycle management
├── item-requests.spec.ts        # Item request functionality
├── message-management.spec.ts   # Message thread management
├── messages.spec.ts             # Basic messaging tests
├── notifications.spec.ts        # Notification tests
├── search.spec.ts              # Search functionality
├── settings.spec.ts            # User settings and profile
├── transactions.spec.ts        # Transaction history and management
└── helpers/
    └── test-data.ts            # Test data factories and utilities
```

### Test Data Cleanup

Set `TEST_CLEANUP_SECRET` in your `.env.local` to enable automatic test data cleanup:

```env
TEST_CLEANUP_SECRET="your-secret-here"
```

This cleanup runs after all tests complete and removes test users and their data.

### Troubleshooting

#### Rate Limiting (429 errors)

If you see 429 errors during parallel test execution, the tests will automatically retry (configured with `retries: 2` in `playwright.config.ts`).

#### Flaky Tests

Some tests may be marked as "flaky" when they pass on retry. This is often due to:
- Rate limiting on signup API
- UI timing issues (modals, animations)
- Network latency

The retry mechanism handles these cases automatically.

#### Email Delivery Failures

If you're still receiving email delivery failure notifications:

1. Verify `E2E_AUTO_VERIFY=true` is set in Playwright config (check `playwright.config.ts`)
2. Check console logs for `[E2E Test Mode] Skipping...` messages
3. Set `SKIP_EMAIL=true` in your `.env.local` to disable emails globally

```env
# Add to .env.local
SKIP_EMAIL=true
```

### Best Practices

1. **Use `data-testid` attributes** - Prefer stable test selectors over text-based queries
2. **Wait for network idle** - Use `page.waitForLoadState('networkidle')` after navigation
3. **Handle UI states gracefully** - Use conditional checks for optional elements
4. **Mock external APIs** - Use `page.route()` for image upload and AI detection APIs
5. **Test isolation** - Each test should be independent and not rely on others
