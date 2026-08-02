# Cloud API contract

`openapi.json` is the pinned TestPapers Backend contract. `contract.lock.json`
records its release source, exact SHA-256, and the generator configuration used
by this repository.

After copying a released Backend `openapi.json` into this directory and updating
the lock metadata, regenerate and verify the committed TypeScript declarations:

```bash
npm run contract:generate
npm run contract:check
```

Both commands read only repository-local inputs. The Web runtime continues to
use `app/composables/useApi.ts` for cookie credentials and CSRF transport.
