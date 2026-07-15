/**
 * Phone-based auth (phone login, phone signup, and phone-number updates in Settings)
 * is hidden for the MVP launch until the SMS/OTP provider is configured.
 *
 * Flip to `true` to re-enable the entire phone UI at once — the backend routes
 * (send-phone-otp / verify-phone-otp), validation, and DB fields all remain intact
 * behind this flag, so nothing else needs to change.
 *
 * Provider setup (Twilio Verify) is documented in TWILIO_VERIFY_SETUP.md.
 */
export const PHONE_AUTH_ENABLED = false;
