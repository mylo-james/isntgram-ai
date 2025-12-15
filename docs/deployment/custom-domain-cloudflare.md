# Custom Domain Setup (Cloudflare DNS → Firebase Hosting)

Goal: map `isntgram.mjames.dev` → the Firebase Hosting site `isntgram` (which then rewrites to Cloud Run).

## 1) Add the custom domain in Firebase

In the Firebase console:

- Hosting → your **`isntgram`** site → Add custom domain
- Enter: `isntgram.mjames.dev`
- Follow the verification instructions shown (Firebase will provide the exact DNS records)

## 2) Add DNS records in Cloudflare

Your DNS is hosted on Cloudflare (NS for `mjames.dev` points to Cloudflare), so add the records there.

Important:

- Set Cloudflare Proxy to **DNS only** (grey cloud) for the verification + CNAME records.
- Use the exact hostnames and values Firebase provides (they can vary).

Firebase will typically ask for:

- A **TXT** record for domain verification (e.g. `firebase=...`)
- A **CNAME** record for `isntgram` pointing to Firebase Hosting (often `ghs.googlehosted.com`)

## 3) Verify DNS propagation locally

Once you add the records, verify from your terminal:

```bash
dig +short TXT isntgram.mjames.dev
dig +short CNAME isntgram.mjames.dev
```

DNS propagation can take minutes to hours depending on TTL.

## 4) Re-deploy with the custom domain (required)

After Firebase shows the domain is connected and SSL is provisioned, re-run the deploy script so runtime configs match
the new origin:

- API `CORS_ORIGIN` must allow `https://isntgram.mjames.dev`
- Web `NEXTAUTH_URL` must be `https://isntgram.mjames.dev`

Run:

```bash
WEB_DOMAIN=https://isntgram.mjames.dev scripts/deploy/cloud-run.sh
```

## 5) Verify

- `https://isntgram.mjames.dev/health`
- `https://isntgram.mjames.dev/api/health`
- Demo sign-in works end-to-end
