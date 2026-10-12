# พลิก — ห้องสมุดออนไลน์

GitHub Pages frontend + Supabase Auth / PostgreSQL / private Storage.

- Read the same personal library on multiple devices by signing in with the same email.
- Guest mode uses an anonymous Supabase account tied to this browser. Signing out may lose access to that guest library; use email login for permanent cross-device access.
- Upload PDF, DOCX, TXT, MD, CSV and PNG/JPG/WEBP/GIF. Reorder files before import. DOCX imports text only; PDF retains page layout. Uploaded originals are also retained privately.
- Generate typographic book covers automatically. Single page in portrait; double spread in landscape. Touch page turns and keyboard navigation.
- 50 MB per file, 100 files per import, 1,000 pages per book. Supabase free-tier storage and transfer limits apply.
- Books and files are private per user through RLS; only a publishable key is in config.js. No service-role key or database password is shipped.
- To develop: npm ci then npm run build. Serve dist with a static HTTP server.
- To deploy: upload dist files to repository root and enable Pages from main / root.
- Run schema.sql once on the dedicated Supabase project. Enable anonymous sign-ins only if guest mode is wanted. Enable email sign-ins and add the Pages URL to Auth redirect URLs.
- Local SQLite books are not automatically sent online. Re-import selected files in the online version.
- Reader upgrade: fullscreen button with a full-area fallback for unsupported browsers; text sizes 16/18/20/24px. Text pages reflow without changing stored originals; page counts vary by screen/font size. PDF and image content retain their original typography.
