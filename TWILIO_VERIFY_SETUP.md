# Phone OTP via Twilio Verify — Setup Plan (deferred)

**Status:** Phone auth (login/signup/phone-number update) is **hidden in the UI** behind
`PHONE_AUTH_ENABLED` in `lib/feature-flags.ts` (currently `false`). All backend routes,
validation, and DB fields remain intact. Flip the flag to `true` to re-enable the UI once
the provider below is configured.

This document is the plan to enable it later. Nothing here is wired yet.

---

## Decision: use Twilio **Verify** (not raw Programmable SMS)

Requirements: **OTP only**, **multi-country from day 1** (US, Germany, India), **minimal config**.

Twilio Verify is the right fit because it is a fully-managed OTP service:

- No phone number to buy or manage; Twilio handles global routing, sender IDs, code
  generation, expiry, rate limits, and fraud checks.
- Far less country-regulatory setup than raw SMS (which, for India, requires full DLT
  number + template registration).
- Multi-channel built in (SMS now; voice / WhatsApp / email later with no rewrite).
- ~$0.05 per successful verification (bundles the SMS cost).

It **replaces** the current self-managed phone OTP path (generate → hash → store → compare).
Email OTP is unaffected and stays as-is.

### Cheaper alternatives considered

- **MSG91 / Plivo** — cheaper per-message, India-friendly, but more setup and less "managed".
- **Twilio Verify** — slightly pricier per OTP but zero number/DLT management and global by
  default. For OTP-only across three countries with minimal ops, this wins.

---

## Your one-time setup (Twilio Console)

1. **Create a Twilio account** at https://www.twilio.com (free trial works for testing).
2. **Verify → Services → Create** → name it "ShareCircle" → copy the **Verify Service SID**
   (`VAxxxxxxxx…`).
3. **Account → API keys & tokens → Create API key** → copy the **API Key SID + Secret**
   (used by both the app and the Twilio MCP; preferred over the raw Auth Token).
4. Add these to `.env` (NOT committed):
    ```
    TWILIO_ACCOUNT_SID=ACxxxxxxxx
    TWILIO_API_KEY=SKxxxxxxxx
    TWILIO_API_SECRET=xxxxxxxx
    TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxx
    ```
    Note: with Verify you do **not** need `TWILIO_PHONE_NUMBER`.

### Country notes

- **US, Germany** — work immediately (trial → paid).
- **India** — Verify still needs a lighter regulatory step than full raw-SMS DLT; check the
  Verify onboarding prompts for India when you go live.
- **Trial limitation:** until the account is upgraded, Verify only messages phone numbers
  you have verified in the Twilio Console.

---

## Connect the Twilio MCP (so the agent can administer Twilio)

The MCP must be added to Claude Code by you (the agent cannot self-connect). Either:

- In Claude Code, run `/plugins` and install **`twilio-developer-kit`** (bundles MCP + skills), **or**
- CLI:
    ```bash
    claude mcp add-json "twilio" '{"command":"npx","args":["-y","@twilio-alpha/mcp","ACCOUNT_SID/API_KEY:API_SECRET"]}'
    ```

Security: do not run community Twilio MCP servers alongside the official one.

---

## Code changes required to enable (done later, on request)

1. `lib/sms.ts` → replace the `messages.create` send with Verify:
   `client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({ to, channel: 'sms' })`.
2. `app/api/auth/verify-phone-otp/route.ts` → replace the local hash comparison with
   `...verificationChecks.create({ to, code })` and treat `status === 'approved'` as success.
   (Phone OTPs no longer use the local `verificationToken` table; email OTP still does.)
3. `app/api/auth/send-phone-otp/route.ts` → drop local OTP generation/storage for phone;
   just call the Verify send. Keep the same request/response shape so the UI is untouched.
4. Flip `PHONE_AUTH_ENABLED` to `true` in `lib/feature-flags.ts`.
5. Live test: one verification to a Console-verified number (trial) or any number (paid).

Because the request/response contracts stay the same, the existing login/signup/settings UI
lights back up unchanged the moment the flag flips.

---

## References

- Twilio Verify: https://www.twilio.com/docs/verify
- Migrate Messaging → Verify: https://www.twilio.com/en-us/blog/migrate-programmable-messaging-to-verify
- Twilio MCP: https://www.twilio.com/docs/ai/mcp
- @twilio-alpha/mcp: https://www.npmjs.com/package/@twilio-alpha/mcp
