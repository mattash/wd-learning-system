# Parish Admin Notes

## Outbound Email Delivery

Parish communications support real email delivery through Resend.

- `PARISH_COMMUNICATIONS_DELIVERY_MODE` controls delivery:
  - `disabled` (default): messages are logged only.
  - `mock`: validates recipient email presence without contacting a provider.
  - `resend`: sends through the Resend batch API.
- Normal parish-admin sends are delivered immediately in the authenticated request.
- Audiences are capped at 100 recipients per send so one request maps to one provider batch and cannot time out midway through a multi-batch campaign.
- A durable `parish_message_delivery_jobs` record remains available when dispatch cannot safely begin.
- Each recipient records delivery status, attempted time, provider message ID, and the latest error.
- Resend requests use stable idempotency keys and stable recipient ordering.
- Once provider dispatch begins, failures and interrupted jobs are failed closed rather than automatically resent when acceptance is uncertain.

## Recovery Worker

- Endpoint: `GET` or `POST /api/internal/parish-admin/communications/deliver`
- The route is excluded from Clerk browser authentication and instead requires a dedicated bearer secret.
- Vercel Cron uses `CRON_SECRET` through `Authorization: Bearer <secret>`.
- Legacy/manual workers may use `PARISH_COMMUNICATIONS_WORKER_TOKEN` through the same authorization header or `x-parish-worker-token`.
- `POST` accepts an optional JSON body: `{ "limit": 10 }`.
- `vercel.json` schedules one daily recovery run, the maximum frequency supported by the current Vercel Hobby plan.
- Immediate delivery is the primary path. The daily cron processes jobs whose provider dispatch never began and marks abandoned `processing` leases as failed; it does not automatically resend ambiguous provider attempts.

## Required Production Configuration

```bash
PARISH_COMMUNICATIONS_DELIVERY_MODE=resend
RESEND_API_KEY=
RESEND_FROM_EMAIL="St. John Learning <noreply@stjohnarmenianchurch.com>"
CRON_SECRET=
NEXT_PUBLIC_APP_URL=https://learn.stjohnarmenianchurch.com
```
