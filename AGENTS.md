# Architecture rules
- Matrícula extraction uses an authenticated, read-only edge function with the AI Gateway SDK; never persist or create a property until the human applies and submits reviewed fields.
- Share the allowlisted extraction contract between client and function so unsupported operational/financial fields cannot overwrite the property form.
- Process PDF text and render scanned pages locally through PDF.js; keep source documents ephemeral during extraction and never put private documents in public app assets.