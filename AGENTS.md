# Architecture rules
- Matrícula extraction uses an authenticated, read-only edge function with the AI Gateway SDK; never persist or create a property until the human applies and submits reviewed fields.
- Share the allowlisted extraction contract between client and function so unsupported operational/financial fields cannot overwrite the property form.
- Process PDF text and render scanned pages locally through PDF.js; keep sources ephemeral during extraction, then attach them privately after explicit property submission; never put private documents in public app assets.
- Return the created property ID and retain it on attachment failure so document retries cannot create duplicate properties.
- Read private documents through authenticated storage with an internally fetched short-lived signed fallback; refresh metadata before opening to avoid stale replaced attachments.