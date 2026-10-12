# Configure Loomi email

The prepared adapter uses Resend. If you prefer another provider, replace the server adapter before supplying its credentials.

1. Configure a sender/domain in Resend and verify it: https://resend.com/docs/dashboard/domains/introduction
2. Set production Site runtime values `RESEND_API_KEY` (secret) and `LOOMI_EMAIL_FROM` (verified sender, e.g. `Loomi <reception@your-domain>`). Keep credentials out of source and the browser.
3. Deploy the saved Site version to apply the runtime environment revision.
4. In Operations → Guest reminders, review a draft and send a test to an address you control.
5. Enable automatic sending per property in Operations → Booking policies. Daily runs prepare drafts even when sending is off.

The guest booking page remains within the Site's private sharing boundary. Staff approval creates a reservation only after a fresh availability check. A submitted request is never an automatic confirmation or a payment.
