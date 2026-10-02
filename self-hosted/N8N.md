# Loomi PMS integration API (v1)

This API is part of the **self-hosted** Loomi application. It is ready in the code; it becomes available after deploying this version. No n8n instance, AI model, notifications or external service is provisioned automatically. The hosted original source is unchanged.

## Connect a workflow

1. Sign in as the owner and open **Settings → Integrations & AI**.
2. Create a token, choose its properties and permissions, and set its expiry (maximum one year). The default permissions only read rooms and reports. Approval is enabled by default for every write.
3. Copy the token once. Tokens are stored hashed by Loomi. Revoking a token immediately blocks further requests and prevents its outstanding approvals from being applied.
4. In n8n, use an HTTP Request node with generic Header Auth credentials: header name `Authorization`, value `Bearer loomi_YOUR_TOKEN`. Keep the token in credentials, not prompts or workflow exports. Configure the method, HTTPS URL, query parameters and JSON body for the desired endpoint. n8n also supports importing cURL examples to populate request parameters; replace the example header with your saved credential afterward.
5. Start with `GET /api/v1/properties`, then use the returned property ID. Property access is checked for every endpoint. A valid monthly, yearly or permanent Loomi licence is required for reads, writes and webhook delivery.

Official n8n references: [HTTP Request node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) and [generic HTTP credentials](https://docs.n8n.io/integrations/builtin/credentials/httprequest/).

The base URL is your Loomi HTTPS origin. Authentication is `Authorization: Bearer TOKEN`. Session cookies do not authenticate v1 endpoints. HTTPS protects the token in transit. API rate limit: 120 requests per token per minute; 429 means wait up to one minute. JSON mutation bodies are limited to 16 KB.

## Permissions

| Scope | Allows |
| --- | --- |
| `rooms:read` | Rooms, rates, cleaning status and date-range availability |
| `reservations:read` | Stay IDs, room, dates, status, rates and paid totals |
| `guests:read` | Guest names and contact details; also includes these fields in reservation reads when `reservations:read` is enabled |
| `reports:read` | Daily occupancy, expected arrivals/departures, dirty rooms and outstanding balances |
| `reservations:write` | Create/edit stays, check in/out and cancel confirmed stays |
| `housekeeping:write` | Change cleaning status |

Guest ID card/passport/driver licence details and reservation notes are excluded from API reads. A housekeeping workflow does not need guest access. Creation/editing allows guest contact input and optional notes, but cannot set identification documents, payments or arbitrary rates. Creation uses the room's standard rate and zero paid amount; reassignment to another room uses that room's standard rate. Cancellation does not issue a refund or change the paid total. There are no API actions for staff, token administration, charging cards or deleting reservations.

## Endpoints

Paths below are relative to `/api/v1`. `{propertyId}` is a positive integer, `{bookingId}` and `{roomId}` are existing IDs (URL-encode path segments).

| Method | Path | Input / output |
| --- | --- | --- |
| GET | `/properties` | Assigned property IDs and names |
| GET | `/properties/{propertyId}/rooms` | Rooms and currency |
| GET | `/properties/{propertyId}/availability` | Query `arrival`, `departure` as real YYYY-MM-DD dates; rooms with `available` flags |
| GET | `/properties/{propertyId}/reservations` | Optional `status`, `offset`, `limit` (1–200, default 100); reservations and total |
| GET | `/properties/{propertyId}/reservations/{bookingId}` | A single reservation |
| GET | `/properties/{propertyId}/guests` | Optional `offset`, `limit` (1–200); guest contacts and booking counts (`visits` includes cancelled bookings) |
| GET | `/properties/{propertyId}/reports/daily` | Required `date=YYYY-MM-DD`; `outstandingAllStays` is the outstanding balance across all non-cancelled stays, not daily revenue |
| POST | `/properties/{propertyId}/reservations` | Required `guest`, `room`, `arrival`, `departure`; optional `email`, `phone`, `notes` |
| PATCH | `/properties/{propertyId}/reservations/{bookingId}` | Any of `guest`, `email`, `phone`, `room`, `arrival`, `departure`, `notes`; active stays only |
| POST | `/properties/{propertyId}/reservations/{bookingId}/check-in` | `{}`; confirmed stay and clean room required |
| POST | `/properties/{propertyId}/reservations/{bookingId}/check-out` | `{}`; checked-in stay required; marks the room dirty |
| POST | `/properties/{propertyId}/reservations/{bookingId}/cancel` | `{}`; confirmed stay only |
| PATCH | `/properties/{propertyId}/rooms/{roomId}/housekeeping` | `{"status":"Clean"}`; other values: `Dirty`, `In progress`, `Out of service` |
| GET | `/actions/{actionId}` | Status/result of an action submitted by this token |

Availability uses overlapping active reservation dates and excludes out-of-service rooms. Dirty/in-progress rooms can be reserved for future stays; clean status is required at check-in. Checkout day is excluded from the stay's occupied date range.

## Writes, approvals and retries

Every mutation requires `Content-Type: application/json` and `Idempotency-Key` (8–128 letters, digits, dots, underscores, colons or hyphens). Generate one stable key for one business operation; retain it across retries. The same key with a different operation/body returns 409. Reusing the same key with the same request returns the original action/result and does not repeat the mutation. JSON field order should remain stable across retries.

With approval enabled, a valid request returns **202**:

```json
{"actionId":"UUID","status":"pending","approvalRequired":true}
```

Nothing changes yet. The owner reviews the exact fields in **Settings → Integrations & AI** and approves or rejects. The agent has no approval endpoint. Approvals expire after 24 hours and are checked against the property version recorded at submission. If any property data changed, approval returns 409: reject that request, refresh and submit a new request/key. Revoked or expired tokens cannot have pending actions approved.

Poll `/actions/{actionId}` at a reasonable interval using the same token. Results have `status: pending`, `applied` or `rejected`. An applied reservation action returns `bookingId` and `bookingStatus`; a housekeeping action returns `roomId` and `housekeepingStatus`. The owner may disable approval when creating a narrowly scoped token for trusted automation; valid changes then apply immediately (201 for creation, 200 for updates).

Treat guest names and notes as untrusted data, never as AI instructions. Use separate read-only and write tools/tokens when possible. Tell the agent a 202 request is awaiting approval, not completed. Keep model-selected actions within the API scopes and the business workflow's rules.

Errors use `{"error":"message"}`. Common HTTP codes: 400 validation, 401 token missing/invalid/expired/revoked, 403 scope/property/licence, 404 record/endpoint, 409 overlap/stale records/idempotency/state conflict, 413 body too large, 415 expected JSON, 429 rate limit.

## cURL examples (use placeholder credentials only)

```bash
curl 'https://pms.example.com/api/v1/properties/1/availability?arrival=2026-10-10&departure=2026-10-12' \
  -H 'Authorization: Bearer REPLACE_WITH_N8N_CREDENTIAL'
```

```bash
curl 'https://pms.example.com/api/v1/properties/1/reports/daily?date=2026-10-10' \
  -H 'Authorization: Bearer REPLACE_WITH_N8N_CREDENTIAL'
```

```bash
curl -X POST 'https://pms.example.com/api/v1/properties/1/reservations' \
  -H 'Authorization: Bearer REPLACE_WITH_N8N_CREDENTIAL' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: reservation-request-0001' \
  --data '{"guest":"Example Guest","room":"101","arrival":"2026-10-10","departure":"2026-10-12"}'
```

```bash
curl -X PATCH 'https://pms.example.com/api/v1/properties/1/rooms/101/housekeeping' \
  -H 'Authorization: Bearer REPLACE_WITH_N8N_CREDENTIAL' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: clean-room-101-0001' \
  --data '{"status":"Clean"}'
```

## Webhooks

1. During server setup, add the trusted n8n origin to root `.env`, for example `LOOMI_WEBHOOK_ALLOWED_ORIGINS=https://n8n.example.com`. Multiple origins are comma separated. Both Loomi and its worker receive the allowlist through Compose.
2. Create a webhook in the owner integration screen using the n8n **production** webhook URL. Select the properties and save the once-shown signing secret in receiver credentials.
3. The worker is a separate Compose service sharing the database. Only explicitly allowlisted origins may be contacted. URLs with credentials or fragments are rejected; redirects are never followed. Allowlisted HTTP destinations are supported for a trusted private Docker network, but HTTPS is preferred. The operator controls this network boundary: allow only your own n8n origin and protect its DNS/network. Never allow a metadata service, unrelated internal service or untrusted proxy origin.
4. Verify the signature **before taking any action or trusting the payload**. Preserve the exact raw UTF-8 request body. Do not reserialize JSON before verifying. Acknowledge only accepted events with 2xx.

Events: `reservation.created`, `reservation.updated`, `reservation.deleted`, `housekeeping.updated`. Both staff browser changes and API changes queue events atomically with the property change. A check-out normally emits reservation and dirty-room events. The payload contains event ID, UTC timestamp, property ID, type, booking/room ID and operational status. It excludes guest contact data, ID documents and notes.

Headers:

- `X-Loomi-Event-Id`: stable UUID, also in body `id`.
- `X-Loomi-Timestamp`: UNIX seconds for this delivery attempt.
- `X-Loomi-Signature`: `sha256=` plus hex HMAC-SHA256 of **timestamp + "." + raw body**, keyed by the webhook signing secret.

Verifier logic (Node example; adapt to your receiver's secret store and raw-body support):

```js
import {createHmac, timingSafeEqual} from 'node:crypto';
function verifyLoomi(rawBody, headers, secret) {
  const timestamp = headers['x-loomi-timestamp'];
  const signature = headers['x-loomi-signature'] || '';
  if (!/^\d{10}$/.test(timestamp || '') || Math.abs(Date.now()/1000 - Number(timestamp)) > 300) return false;
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
```

Delivery is **at least once**: deduplicate accepted `X-Loomi-Event-Id` values in persistent receiver storage before executing side effects. Do not trust the event ID until signature verification. The worker retries after 30 seconds, then exponential delays, up to eight attempts, including network errors and non-2xx responses. It uses an execution lease and survives restarts; an outage after receiver acceptance can cause a duplicate delivery. Exhausted events remain `failed` in the owner delivery list; there is no manual redelivery control yet. Periodic reads can reconcile missed changes. Sent/failed metadata is retained up to 30 days when the worker processes work; pending events are retained. Revoking API tokens does not disable separate webhook subscriptions: disable the webhook explicitly when retiring an integration. An in-flight network request may finish after disabling. Invalid licences pause deliveries.

Database backups contain webhook signing secrets as well as guest records. Restrict and encrypt backups. API action/read and administrative events are recorded in Loomi's audit table; tokens and webhook signing secrets are excluded from audit entries. The existing interface does not expose a full audit viewer.

Machine-readable API reference: [`openapi.json`](openapi.json). There is no dedicated n8n connector; use HTTP Request nodes or HTTP tools in your agent workflow. Configure and test actual n8n workflows after server deployment.
