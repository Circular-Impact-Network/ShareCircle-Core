# Email Test Fix Summary

## Problem

During E2E test execution, the system was attempting to send emails to test accounts (e.g., `e2e+test@example.com`), causing email delivery failures because these are invalid email addresses.

## Solution

Modified the email system to automatically disable email sending during E2E tests.

## Changes Made

### 1. Updated `lib/email.ts`

Added check to skip email initialization when `E2E_AUTO_VERIFY=true` or `SKIP_EMAIL=true`:

```typescript
function getMail(): InstanceType<typeof IrisMail> | null {
	// Skip email sending during E2E tests
	if (process.env.E2E_AUTO_VERIFY === 'true' || process.env.SKIP_EMAIL === 'true') {
		return null;
	}
	// ... rest of the function
}
```

Enhanced logging to clearly indicate when emails are skipped:

```typescript
if (!client) {
	if (process.env.E2E_AUTO_VERIFY === 'true') {
		console.log(`[E2E Test Mode] Skipping OTP email to ${to} (OTP: ${otp})`);
	} else {
		console.warn('Email sending disabled - GMAIL_USER/GMAIL_APP_PASSWORD not set or SKIP_EMAIL=true');
	}
	return;
}
```

### 2. Updated `.env.example`

Added documentation for email configuration flags:

```env
# Email configuration (optional - for OTP and password reset emails)
# Leave these blank to disable email sending (e.g., during development/testing)
# GMAIL_USER="your_gmail_address@gmail.com"
# GMAIL_APP_PASSWORD="your_gmail_app_password"

# E2E Testing flags
# E2E_AUTO_VERIFY=true - Auto-verify users during signup in E2E tests (disables email sending)
# SKIP_EMAIL=true - Disable all email sending (useful for local development/testing)
```

### 3. Created `TESTING.md`

Comprehensive testing documentation including:

- How to run tests
- Email handling explanation
- Test structure overview
- Troubleshooting guide
- Best practices

## How It Works

1. **Playwright config** (`playwright.config.ts`) automatically sets `E2E_AUTO_VERIFY=true` when running tests
2. **Email module** (`lib/email.ts`) checks for this flag and returns `null` instead of initializing the mail client
3. **Email functions** detect the null client and skip sending, logging the action for debugging
4. **Tests continue normally** without attempting to send emails to invalid test accounts

## Testing Results

All tests pass successfully with emails disabled:

- **109 tests passed**
- **5 tests skipped** (features not yet implemented)
- **2 tests flaky** (pass on retry due to rate limiting)
- **0 email delivery failures**

## Additional Options

If you want to disable emails for local development (outside of tests), add to `.env.local`:

```env
SKIP_EMAIL=true
```

Or simply remove/comment out the Gmail credentials:

```env
# GMAIL_USER="your_email@gmail.com"
# GMAIL_APP_PASSWORD="your_app_password"
```

## Verification

You can verify emails are being skipped by checking the console output during test runs. You should see messages like:

```
[E2E Test Mode] Skipping OTP email to e2e+1234567890-1@example.com (OTP: 123456)
```

## No More Email Delivery Failures! ✅

The system will no longer attempt to send emails to test accounts, eliminating the email delivery failure notifications.
