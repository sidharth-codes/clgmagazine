/**
 * GECK UNION MAGAZINE — GOOGLE DRIVE UPLOAD ENDPOINT
 *
 * Setup:
 * 1. Open https://script.google.com/ and create a standalone project.
 * 2. Paste this file into Code.gs.
 * 3. Run setupMagazineStorage() once and authorize Drive + Sheets access.
 * 4. Deploy as a Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Copy the /exec URL into script.js in the website project.
 *
 * Each uploaded file is saved in the configured Drive folder.
 * Submission metadata and the Drive file link are appended to a Sheet.
 */

const CONFIG_KEYS = {
  folderId: "GECK_UPLOAD_FOLDER_ID",
  spreadsheetId: "GECK_UPLOAD_SPREADSHEET_ID"
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "doc", "docx", "pdf", "txt", "rtf", "jpg", "jpeg", "png"
];

/**
 * Run this manually once from the Apps Script editor.
 * It creates the Drive folder and tracking spreadsheet.
 */
function setupMagazineStorage() {
  const properties = PropertiesService.getScriptProperties();

  let folder;
  const savedFolderId = properties.getProperty(CONFIG_KEYS.folderId);

  if (savedFolderId) {
    try {
      folder = DriveApp.getFolderById(savedFolderId);
      folder.getName();
    } catch (error) {
      folder = null;
    }
  }

  if (!folder) {
    folder = DriveApp.createFolder("Geck Magazine Submissions");
    properties.setProperty(CONFIG_KEYS.folderId, folder.getId());
  }

  let spreadsheet;
  const savedSpreadsheetId = properties.getProperty(CONFIG_KEYS.spreadsheetId);

  if (savedSpreadsheetId) {
    try {
      spreadsheet = SpreadsheetApp.openById(savedSpreadsheetId);
      spreadsheet.getName();
    } catch (error) {
      spreadsheet = null;
    }
  }

  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create("Geck Magazine Submission Records");
    DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);
    properties.setProperty(CONFIG_KEYS.spreadsheetId, spreadsheet.getId());
  }

  let sheet = spreadsheet.getSheetByName("Submissions");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Submissions");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp",
      "Author Name",
      "Submission Title",
      "Original File Name",
      "Stored File Name",
      "MIME Type",
      "File Size (bytes)",
      "Drive File URL",
      "Drive File ID"
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
  }

  Logger.log("Drive folder: " + folder.getUrl());
  Logger.log("Submission spreadsheet: " + spreadsheet.getUrl());

  return {
    folderUrl: folder.getUrl(),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

/**
 * Health-check endpoint. Open the deployed /exec URL in a browser.
 */
function doGet() {
  return HtmlService.createHtmlOutput(
    "<!doctype html><html><body style='font-family:Arial;padding:24px'>" +
    "<h2>Geck Union Magazine upload service</h2>" +
    "<p>The Google Apps Script endpoint is running.</p>" +
    "</body></html>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Receives one base64-encoded file per POST request.
 * The website sends a URL-encoded form field named "payload".
 */
function doPost(e) {
  let payload = {};
  let token = "";

  try {
    if (e && e.parameter) {
      token = String(e.parameter.uploadToken || "");
    }

    if (!e || !e.parameter || !e.parameter.payload) {
      throw new Error("Missing upload payload.");
    }

    payload = JSON.parse(e.parameter.payload);
    token = String(payload.token || token);

    const result = saveSubmissionFile_(payload);
    return uploadResponse_(token, true, "File saved successfully.", result);

  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return uploadResponse_(
      token,
      false,
      error && error.message ? error.message : "An unexpected upload error occurred."
    );
  }
}

/**
 * Validates and saves one uploaded file to Google Drive.
 */
function saveSubmissionFile_(payload) {
  const authorName = String(payload.authorName || "").trim();
  const title = String(payload.title || "").trim();
  const originalName = String(payload.fileName || "").trim();
  const mimeType = String(payload.mimeType || "application/octet-stream");
  const base64 = String(payload.base64 || "");
  const declaredSize = Number(payload.fileSize || 0);

  if (!authorName) {
    throw new Error("Please provide your name.");
  }

  if (!originalName || !base64) {
    throw new Error("The uploaded file is missing its name or content.");
  }

  if (!Number.isFinite(declaredSize) || declaredSize <= 0 || declaredSize > MAX_FILE_BYTES) {
    throw new Error("Each file must be smaller than or equal to 20 MB.");
  }

  const extension = originalName.includes(".")
    ? originalName.split(".").pop().toLowerCase()
    : "";

  if (ALLOWED_EXTENSIONS.indexOf(extension) === -1) {
    throw new Error("This file type is not supported.");
  }

  const bytes = Utilities.base64Decode(base64);

  if (bytes.length !== declaredSize) {
    throw new Error("The uploaded file size did not match. Please try again.");
  }

  if (bytes.length > MAX_FILE_BYTES) {
    throw new Error("Each file must be smaller than or equal to 20 MB.");
  }

  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty(CONFIG_KEYS.folderId);
  const spreadsheetId = properties.getProperty(CONFIG_KEYS.spreadsheetId);

  if (!folderId || !spreadsheetId) {
    throw new Error("Storage is not initialized. Run setupMagazineStorage() in Apps Script first.");
  }

  const safeOriginalName = sanitizeFileName_(originalName);
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );
  const safeAuthor = sanitizeFileName_(authorName).replace(/\s+/g, "-").substring(0, 35);
  const storedName = timestamp + "_" + safeAuthor + "_" + safeOriginalName;

  const blob = Utilities.newBlob(bytes, mimeType, storedName);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const folder = DriveApp.getFolderById(folderId);
    const driveFile = folder.createFile(blob);

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    let sheet = spreadsheet.getSheetByName("Submissions");

    if (!sheet) {
      sheet = spreadsheet.insertSheet("Submissions");
    }

    sheet.appendRow([
      new Date(),
      authorName,
      title,
      originalName,
      storedName,
      mimeType,
      bytes.length,
      driveFile.getUrl(),
      driveFile.getId()
    ]);

    return {
      fileName: storedName,
      fileUrl: driveFile.getUrl(),
      fileId: driveFile.getId()
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns an HTML response inside the hidden iframe.
 * postMessage lets the original website know whether the upload succeeded.
 */
function uploadResponse_(token, ok, message, fileInfo) {
  const response = {
    type: "GECK_MAGAZINE_UPLOAD",
    token: token,
    ok: Boolean(ok),
    message: String(message || ""),
    file: fileInfo || null
  };

  const serialized = JSON.stringify(response).replace(/</g, "\\u003c");

  const html =
    "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
    "<script>" +
    "window.parent.postMessage(" + serialized + ", '*');" +
    "</script>" +
    "</body></html>";

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Keeps user-supplied names safe and removes path separators/control chars.
 */
function sanitizeFileName_(name) {
  return String(name)
    .replace(/[\/\\:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 150) || "submission";
}
