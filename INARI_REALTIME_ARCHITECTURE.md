# Real-time architecture decision

## Decision
**Do not introduce WebSockets / Socket.IO for this release.**

## Rationale
1. Staging API is currently offline; adding infrastructure before basic HTTP reliability is inverted priority.
2. Kitchen already refreshes every 15 seconds — adequate for single-kitchen operations.
3. Horizontal multi-instance Render would require Redis or equivalent for socket fan-out — new operational dependency without measured need.
4. Critical money/stock paths must remain request-response with transactional commits; push events would still need outbox complexity.

## Interim approach
- Kitchen: 15s poll (already implemented)
- POS: explicit complete → response includes ticket
- Optional later: Server-Sent Events on `/events/kitchen` authenticated with the same Bearer session, single-instance first

## When to revisit
- Multiple concurrent kitchen stations with <3s latency requirements
- Measured complaint that 15s poll is insufficient
- Stable multi-instance API with shared pub/sub budgeted
