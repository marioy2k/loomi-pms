# Loomi Intelligence

Open **Chat** at the bottom right, then select **Loomi Intelligence**. Ask questions in the conversation; **More tools / Meer functies** opens the existing analysis and draft tools within the chat window. Conversation history remains in memory when switching to team chat or closing the window and clears when changing property or reloading. **Enter** sends a question; **Shift+Enter** adds a new line in both question fields. **Clear conversation / Gesprek wissen** clears the local Intelligence history after confirmation. Each question is interpreted independently; include dates or references again in follow-up questions.

For room packages, select the optional **Loomi Intelligence** add-on in **Settings → Licence & optional extras**: **USD 50 per month per property**, or USD 600 for a year (12 months). It is excluded from base packages and Operations and included in the free demo. Existing legacy licences keep their explicitly granted modules. The licence form controls entitlements and pricing; it does not collect payments. Team chat remains a separate free add-on; Intelligence works even when team chat is disabled. Each tool also requires its underlying module and employee permission. Property assignments apply to all reads and writes.

## Included tools

| Tool | Behavior |
| --- | --- |
| Ask Loomi | Available room counts and room lists (Dutch or English, including today/tomorrow/ISO date ranges), arrivals, departures, overlapping reservations, accommodation balances, discounts and occupancy queries. Answers are computed from saved records and link to reservations. Availability covers every day of the inclusive date range, releases rooms on checkout day, excludes maintenance blocks and out-of-service rooms, and labels dirty rooms as needing cleaning. Local queries recognize common Dutch/English phrases and ISO dates; AI can interpret more varied wording. |
| Daily briefing & alerts | Current arrivals, departures, occupancy, currency-separated accommodation balances, high discounts, unready arrivals and accommodation credit. |
| Guest messages | Dutch/English arrival, status, checkout and payment drafts. Text is editable; approved reminder drafts are stored in Operations → Guest reminders. Nothing sends automatically. Status messages can be copied. Existing email configuration is required for delivery from Operations. |
| Reservation from text | Extract dates/contact details, suggest available accommodation, then open the ordinary reservation editor. Saving rechecks availability, permissions, room status and concurrent changes. |
| Room recommendations | Exclude conflicting reservations, out-of-service rooms and maintenance blocks; prefer matching room types and adjacent stays. Known capacities also support group allocations across multiple rooms. Enter capacities in room settings. Unknown capacities must be checked by staff. No bookings are moved automatically. |
| Cleaning priorities | Same-day arrivals, departures, dirty rooms, maintenance holds and existing assignments. Duration estimates are planning defaults. Open Housekeeping to assign staff or record completion. |
| Maintenance patterns | Group room issues and maintenance tasks by equipment/topic and show recurrence and source references. Keyword grouping is transparent; it is not a diagnosis. |
| Supplier invoice intake | Paste text for local extraction, or use AI for JPEG/PNG/WebP/PDF recognition. Review editable supplier/reference/date/currency/total/category/description. Confirming creates one unpaid expense through the normal accounting validation. No payment is recorded. Uploaded documents are not persisted by this feature. |
| Occupancy forecast | Show on-the-books occupancy and historical weekday averages from up to 12 weeks of checked-in/completed stays. Less than four matching weekday observations is labeled insufficient. Forecasts are estimates, not a pickup or market model; past room-capacity changes are not known. |
| Rate & discount advice | Explain conservative suggestions from already-booked occupancy: +10% at >=85%, +5% at >=65%, -5% below 35% within seven days, otherwise unchanged. No rates or discounts are applied automatically. |
| Stock recommendations | Issued minus returned stock over 28 days, scaled by expected room nights, with minimum-stock fallback. Insufficient history is shown. Purchasing and stock changes remain in their existing modules. |
| Guest feedback | Store staff-entered feedback, rating, date, optional room/reservation and source. Show topic/rating trends, with optional AI summaries and actions backed by saved feedback IDs. Administrators can delete entries. |

## Optional AI provider

The local tools work without any API credential. A company administrator can expand **AI-provider instellen** inside the workspace, enter an OpenAI API key, select a compatible model, set the daily request cap and explicitly allow external AI processing. Each AI-capable tool has its own **AI gebruiken voor deze opdracht** checkbox. It is off by default. The initial model is `gpt-4.1-mini` and may be changed to a model in your API account that supports the Responses API, structured outputs and (for document recognition) image/PDF inputs.

Alternatively set `OPENAI_API_KEY` on the server, or mount a readable `OPENAI_API_KEY_FILE`. UI-managed keys are stored with mode `0600` at `DATA_DIR/ai-provider-key`; keys never appear in API status responses, browser storage, logs or the hotel JSON backup. Back up that private file separately if needed. Settings and request counters are stored server-side. Default cap: 50 provider requests per installation per day; each employee is also capped at 25. Failed provider attempts count toward the cap. Request caps limit calls, not currency spend; monitor your provider account's billing controls as well.

AI calls use the fixed OpenAI Responses endpoint with `store:false`, structured JSON output, a 45-second timeout and bounded input/output. Identification documents and the entire hotel database are never included. Guest-message calls use booking facts without guest contact data; names are substituted locally. Text typed or documents uploaded for extraction are sent only when AI is selected. Document processing can incur API costs and should follow the hotel's data policy.

Official implementation references: [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [Images and vision](https://developers.openai.com/api/docs/guides/images-vision).

## Data and deployment

Migration `0023_intelligence.sql` adds feedback and AI request counters without rewriting reservations. Feedback is included in hotel backups; older backups import with an empty feedback list. Hotel-data reset clears feedback while preserving AI settings and usage limits. Secrets are separate from hotel backup exports. Existing Docker volumes, environment configuration and secrets must be retained during updates.

Automated tests cover permissions/property isolation, money/currency calculations, availability and capacity, maintenance, cleaning priorities, sparse forecast history, stock use, invoice idempotency, message drafts, feedback backups, spoofed files, provider configuration and quotas. Provider requests are tested with mocks; a live provider test requires the hotel's configured key.
