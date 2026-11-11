# Geck Union Magazine — Google Drive Upload Setup

This package keeps the existing magazine HTML and CSS intact and connects the existing submission form to Google Drive using Google Apps Script.

## Files

- `index.html` — your existing website HTML (unchanged)
- `style.css` — your existing stylesheet (unchanged)
- `script.js` — existing website logic with the Google Drive upload integration
- `logo.png` — your existing logo image
- `Code.gs` — Apps Script backend that saves files to Drive and logs each file in Sheets

## 1. Create the Google Apps Script backend

1. Sign in to the Google account that should own the submissions.
2. Open <https://script.google.com/>.
3. Click **New project**.
4. Replace the contents of `Code.gs` with the supplied `Code.gs`.
5. Save the project with a name such as **Geck Union Magazine Uploads**.
6. In the function selector, choose `setupMagazineStorage`.
7. Click **Run** and approve the requested Google Drive and Google Sheets permissions.
8. Open **Execution log**. The setup function logs the Drive folder and tracking spreadsheet URLs.

The setup function creates:

- A Drive folder named `Geck Magazine Submissions`
- A spreadsheet named `Geck Magazine Submission Records`
- A `Submissions` sheet with timestamp, author, title, filename, MIME type, size, Drive URL and Drive file ID columns

Run `setupMagazineStorage()` only once unless you intentionally want to recreate storage after deleting it.

## 2. Deploy as a web app

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon and select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone** (or the broadest audience appropriate for your deployment).
5. Click **Deploy** and authorize if prompted.
6. Copy the Web app URL ending in `/exec`.

The endpoint must be deployed with public access for visitors who are not signed in to your Google account. This also means anyone who obtains the endpoint URL may submit files; do not treat the URL as an authentication mechanism.

## 3. Connect the website

Open `script.js` and find:

```js
const uploadEndpoint = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```

Replace the placeholder with your deployed `/exec` URL, for example:

```js
const uploadEndpoint = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";
```

Save and upload all website files to your hosting provider. Keep `index.html`, `style.css`, `script.js` and `logo.png` in the same website directory.

## 4. Test a submission

1. Open the website using its hosted URL (or a local development server).
2. Open the **Submit** page.
3. Enter a name and optional title.
4. Select one small PDF or image first.
5. Submit and wait for the success message.
6. Check the `Geck Magazine Submissions` Drive folder.
7. Check the `Submissions` tab in the tracking spreadsheet.

Each file is uploaded separately in sequence. If one file fails, already-uploaded files remain in Drive and the remaining files stay selected so you can retry.

## Upload limits and security

- Allowed extensions: DOC, DOCX, PDF, TXT, RTF, JPG, JPEG and PNG.
- Maximum size: 20 MB per file.
- Files are saved in the Drive account that owns the Apps Script deployment.
- Files are not made publicly accessible by this script; they inherit the Drive folder's access settings.
- The Apps Script endpoint is public when deployed for anonymous visitors. Add CAPTCHA, moderation, quotas, or another abuse-prevention layer before publishing widely.
- Do not put Google account passwords, OAuth tokens or service-account credentials in frontend files.

## Troubleshooting

- **“Connect Google Drive first”**: the URL placeholder in `script.js` has not been replaced with a valid `/exec` URL.
- **File appears in Drive but the page stays on “Uploading”**: update the Apps Script response code, then use **Deploy → Manage deployments → Edit** and deploy a new version. The response must post to the top-level page so the website can receive the upload confirmation.
- **No response from Apps Script**: check that the deployment is active, the URL ends in `/exec`, and access is set to Anyone.
- **Storage is not initialized**: run `setupMagazineStorage()` from the Apps Script editor and authorize it.
- **Permission error**: redeploy with **Execute as: Me** and confirm the script owner authorized Drive and Sheets.
- **Changes to Code.gs are not reflected**: use **Deploy → Manage deployments → Edit**, create a new version, and deploy it.

The website uses a hidden iframe form post rather than `fetch()` because Apps Script web-app redirects do not behave like a normal CORS-enabled JSON API.
