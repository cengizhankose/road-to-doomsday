# Security

## Reporting

Please report vulnerabilities through GitHub's private
[security advisories](https://github.com/cengizhankose/road-to-doomsday/security/advisories/new)
rather than a public issue. This is a hobby project maintained in spare time,
so expect a best-effort response rather than a guaranteed window.

## How access works

There are no passwords and no user accounts. A household holds exactly two
members, and each member joins through a single-use invite link:

```
https://<your-origin>/join#<invite-token>
```

- The token lives in the URL **fragment**, which browsers never send to the
  server. It stays out of access logs, referrers, and CDN records. The app
  strips it from the address bar on arrival and posts it once to `/api/join`.
- Postgres stores only a SHA-256 hash of the invite and of the session that
  replaces it. A database dump cannot be replayed into a session.
- Exchanging an invite is atomic: the row is deleted and the session created in
  one statement, so a link cannot be redeemed twice.
- Invites expire after 7 days; sessions after 30.
- The session cookie is `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`.

## Boundaries the server enforces

- Every read and write is scoped to the household resolved from the session
  cookie. The client never supplies a household id.
- Writes require an `Origin` header matching `APP_ORIGIN`, reject non-JSON
  bodies, and cap the payload at 10 KB.
- Writes carry a revision. A stale one gets `409 Conflict` with the winning row
  rather than silently overwriting another device.
- Scores, statuses, episode positions, and note length are constrained in the
  database, not only in the client.
- A push subscription is bound to the session that registered it and cascades
  away with it, so revoking a session stops its notifications immediately.
- Responses are `private, no-store`, and the app ships a restrictive CSP that
  allows images from only the two artwork hosts.

## Running your own instance

- `DATABASE_URL` and `VAPID_PRIVATE_KEY` belong only in your host's environment
  settings — never in the repository.
- `npm run setup` and `npm run invites` write raw links to `.secrets/` with
  mode `0600` and never print them. `.secrets/` is gitignored; keep it that way.
- Set `APP_ORIGIN` to your exact production origin. A wrong value disables the
  CSRF origin check's usefulness and breaks invite links.
- Rotate by re-running `npm run invites`; it revokes unused invites for the
  household first. Existing sessions keep working, so re-inviting someone does
  not sign out the devices they already joined on.
