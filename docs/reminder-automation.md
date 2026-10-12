# Loomi private reminder runner

The Site remains owner-private. The unattended writer is `POST /api/reminders/run`. It relies on Sites dispatch validating private service access; signed-in visitors must be Super Admins. Do not make this Site public without adding separate writer authorization.

A fresh linked Sites cloud task obtains this Site's current service bearer credential using `get_site`, sends it only to this Site as `OAI-Sites-Authorization: Bearer <token>`, and calls the writer. Do not put credentials in source, logs, prompts or URLs. Record only returned prepared/sent counts and errors. Normal runs update the database without rebuilding or republishing.

Runs create dated drafts for arrivals and checkout today/tomorrow and unpaid accommodation balances. They send only when the provider is configured AND that property's Booking policies has automatic email enabled. The default is off. No provider credentials means drafts only, with no external messages.

Email payloads are frozen while Sending. Concurrent and uncertain retries share a provider idempotency key. Resend retains keys for 24 hours; Loomi stops retries after 23 hours and requires a provider delivery check. Sent records are retained. A new day creates a new reminder; payment reminders can recur daily while unpaid.
