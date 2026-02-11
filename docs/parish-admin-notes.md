# Parish Admin Notes

## Known Gap: Outbound Messaging Delivery
- Current parish communications are log-only (`parish_message_sends` + `parish_message_recipients`).
- The product does not yet send actual email/SMS/push notifications.
- Delivery status is tracked as `not_configured` until a provider integration is implemented.

## Delivery Scaffold (Current)
- Added async delivery-job contract:
  - `parish_message_delivery_jobs` queue table.
  - Per-recipient delivery fields on `parish_message_recipients`.
- Delivery mode is controlled by `PARISH_COMMUNICATIONS_DELIVERY_MODE`:
  - `disabled` (default): behavior remains log-only.
  - `mock`: message sends are marked `queued` and a job is enqueued.
- Worker endpoint:
  - `POST /api/internal/parish-admin/communications/deliver`
  - Requires `PARISH_COMMUNICATIONS_WORKER_TOKEN` and matching header `x-parish-worker-token` (or `Authorization: Bearer ...`).
  - Optional JSON body: `{ "limit": 10 }`
- The `mock` provider currently validates recipient email presence and marks sends/recipients `sent` or `failed` accordingly.

## Follow-up Issue Suggestion
- Title: `Integrate outbound delivery for Parish Admin communications (email/SMS)`
- Scope:
  - Add provider abstraction and environment configuration.
  - Implement async job/queue delivery pipeline.
  - Add retry/backoff + failure logging.
  - Add delivery metrics and admin-facing send status drill-down.
