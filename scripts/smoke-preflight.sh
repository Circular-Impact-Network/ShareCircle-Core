#!/usr/bin/env bash
#
# Verify a smoke-test target is actually testable before spending three minutes proving it isn't.
#
# The smoke jobs point at a deployed URL held in a repository secret, so the URL itself is masked
# in the logs. When the target is wrong the only signal used to be a Playwright assertion failure
# on a page that was never the app. This prints the diagnosis instead.
#
# Nothing here echoes the URL — only its status code and, if it redirects, the redirect *host*.
# Vercel's SSO endpoint embeds the original URL in a query string, so the host is taken alone.

set -euo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
	echo "::error::PLAYWRIGHT_BASE_URL is empty. Set the STAGING_URL / PRODUCTION_URL repository secret."
	exit 1
fi

read -r STATUS REDIRECT <<<"$(curl -sS -o /dev/null -m 30 \
	-w '%{http_code} %{redirect_url}' \
	-H 'User-Agent: ShareCircle-CI-Preflight' \
	"${BASE_URL%/}/login")"

REDIRECT_HOST=""
if [ -n "${REDIRECT:-}" ]; then
	REDIRECT_HOST="$(printf '%s' "$REDIRECT" | sed -E 's#^[a-zA-Z]+://([^/?]+).*#\1#')"
fi

echo "Target /login -> HTTP $STATUS${REDIRECT_HOST:+ (redirects to $REDIRECT_HOST)}"

case "$REDIRECT_HOST" in
vercel.com | *.vercel.com)
	echo "::error::Target is behind Vercel Deployment Protection — every request is redirected to Vercel SSO, so no smoke test can reach the app. Fix: in the Vercel project, Settings -> Deployment Protection, either disable Vercel Authentication for this environment or add a Protection Bypass for Automation and send it as the x-vercel-protection-bypass header."
	exit 1
	;;
esac

if [ "$STATUS" -ge 500 ] || [ "$STATUS" = "000" ]; then
	echo "::error::Target is not serving (HTTP $STATUS). The deployment is down or the URL secret is wrong."
	exit 1
fi

echo "Preflight OK."
