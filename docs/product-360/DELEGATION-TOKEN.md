# The delegation token

How TradeLink247 tells the mind-map service who is calling.

**Status:** both sides are implemented and tested. Verifying:
`mind-map/backend/app/api/delegation.py`, `tests/test_product360_delegation.py`. Minting:
`DelegationTokenService` and `POST /api/{tenant}/product-360/delegation-token` in the Spring Boot
repo, `DelegationTokenServiceTest`. The two have been proved to interoperate — see §6.

---

## 1. Why not just forward the ERP's session token

The ERP session JWT is **HS256 with a shared secret**. Verifying it anywhere means holding a key
that can also *create* it.

Hand that to the mind-map service and a bug there — a log line, a debug endpoint, a dependency
with a flaw — stops being a mind-map problem and becomes an authentication bypass in an ERP that
holds every tenant's sales and cost data. The blast radius is out of all proportion to what the
service actually needs, which is: *this person, at this company, wants to save where they dragged
a node.*

So the ERP mints a **second, narrower token**, signed asymmetrically. The mind-map service holds
only the public half: it can check a signature and forge nothing.

---

## 2. Shape

| | |
|---|---|
| Algorithm | **RS256** (EdDSA also accepted) |
| Audience | `mindmap-layout-api` |
| Issuer | `tradelink247` |
| Lifetime | **≤ 300 seconds**, and the verifier enforces it |
| Key held by mind-map | **public only** |

```jsonc
{
  "iss": "tradelink247",
  "aud": "mindmap-layout-api",
  "sub": "alice@example.com",   // stable user id - owns the layout
  "tenant": "9446968394a",      // owns the layout together with sub
  "iat": 1756600000,
  "exp": 1756600300,            // iat + 300 at most
  "jti": "b3f1…"                // for correlation in logs
}
```

Nothing else. No roles, no branch list, no email beyond the subject, no display name. The service
stores node coordinates; anything more in the token is data it cannot use and should not hold.

`exp - iat > 300` is **rejected**, not just discouraged. A long-lived token is a session token
wearing a disguise, and this catches a mistake on the minting side rather than trusting it to stay
careful.

---

## 3. What the verifier enforces

Every one of these fails **closed**, with a single indistinguishable message so a caller learns
nothing from probing:

- signature valid against the configured public key
- `alg` in an explicit allow-list — this is what defeats `alg: none` and the HS256-with-the-public-key
  confusion attack, both of which have tests
- `aud` and `iss` exact
- `exp` in the future, `iat` present
- `exp - iat` within the maximum
- `sub` and `tenant` both present
- a `tenant` in the request path or body that disagrees with the token → **403**

Identity comes from the token and from nowhere else.

---

## 4. Configuration

```properties
# mind-map service
AUTH_MODE=delegated
JWT_PUBLIC_KEY_PATH=/run/secrets/product360_public.pem   # preferred over the inline value
JWT_AUDIENCE=mindmap-layout-api
JWT_ISSUER=tradelink247
JWT_MAX_AGE_SECONDS=300
CORS_ORIGINS=https://tradelink247.com                    # never *
```

`AUTH_MODE` defaults to `none`, which is the standalone product behaving exactly as it always has:
a single get-or-created user, no tokens, no tenancy. The standalone deployment needs no change and
its 113 tests pass untouched.

A **path** is preferred to an inline key: it keeps the key out of the process environment, where it
would appear in crash dumps and `docker inspect`.

---

## 5. Key rotation

Both keys valid at once, distinguished by `kid`:

1. Generate the new pair; publish the new **public** key alongside the old one.
2. Switch the ERP to sign with the new private key.
3. Wait one token lifetime (5 minutes) plus a margin.
4. Retire the old public key.

Because tokens live minutes rather than hours, rotation is a five-minute overlap rather than a
migration.

---

## 6. The minting side

`DelegationTokenService` (Spring Boot) mints RS256 tokens with the claims in §2 and the configured
expiry, from a PKCS#8 key read off a mounted path. It returns *nothing* — rather than something
weaker — when delegation is switched off, when the key is missing, or when it is asked for a token
that names no tenant and no subject.

`POST /api/{tenant}/product-360/delegation-token` hands one to the browser. It re-derives `tenant`
and `sub` from the caller's **own** authenticated session; accepting them as parameters would make
it an endpoint that mints a token for anybody you can name, which is the whole attack it exists to
avoid. The response is `Cache-Control: no-store`, and 404 when the feature is off.

Two rules that constrain the callers:

- **The token never goes in a URL.** Query strings end up in browser history, proxy logs and
  `Referer` headers. Authorization header only.
- **The admin holds it in memory, never in `localStorage`.** It is short-lived precisely so it does
  not need persisting, and anything in `localStorage` is readable by every script on the origin.

### The two sides actually agree

Unit tests on each side prove each side self-consistent, which is not the same as proving they
interoperate. RS256 padding, audience-as-array, and the `exp`/`iat` window are all places two JWT
libraries can differ while each remains internally correct — so a token minted by JJWT was verified
by the PyJWT verifier, against a keypair generated by neither:

```
$ docs/product-360/scripts/verify-delegation-interop.sh
==> minting with the Spring service
    minted 601 chars
==> verifying with the Python verifier
    verified: tenant=9446968394a subject=alice@example.com
    a token signed by an unknown key is refused
==> interop OK
```

Run it before any deployment that changes either side.

### What breaking it looks like

Against a running `AUTH_MODE=delegated` service holding a layout saved by `alice@example.com` at
tenant `9446968394a` (§7 of `PILOT.md` has the commands):

| attempt | status | what came back |
|---|---|---|
| no token | **401** | `{"detail":"Not authenticated"}` |
| the ERP session token (HS256, real, correct claims) | **401** | `{"detail":"Not authenticated"}` |
| an expired token, correctly signed | **401** | `{"detail":"Not authenticated"}` |
| a valid token for a **different tenant** | **200** | an *empty* layout — none of alice's data |

The fourth is a 200 and that is the correct answer, so it is worth being explicit about why. A
token for another tenant is not an attack on the signature; it is a legitimate caller from another
company. Rejecting it would be wrong. What must not happen is that it sees anything of alice's —
and it does not: ownership is `(tenant, user)` taken from the token, so that caller gets its own
(absent, therefore empty) layout. Pushed harder:

- that caller's `PUT` returns 200 and writes **its own** row; alice re-reads her layout unchanged
- `bob@example.com`, a different user in **alice's own tenant**, also sees an empty layout

Isolation therefore holds on both axes, not just the tenant one. Confirmed at the row level:

```
9446968394a  | alice@example.com | ITEM001 | [{"x": 137.0, "y": 42.0,   "node_id": "PRODUCT:ITEM001"}]
SOMEONE-ELSE | mallory@evil.com  | ITEM001 | [{"x": -999.0, "y": -999.0, "node_id": "PRODUCT:ITEM001"}]
```

A caveat on the second row of the table: the HS256 token is refused because the algorithm
allow-list is `RS256,EdDSA`, **not** because the service knows the ERP's secret and found it
wanting. It does not hold that secret and never should. That distinction is the whole point of
§1 — and it means the allow-list is load-bearing, so `jwt_algorithms` must never grow an HMAC
entry.
