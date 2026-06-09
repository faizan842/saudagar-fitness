// ╔════════════════════════════════════════════════════════════════════╗
// ║  SAUDAGAR FITNESS CLUB — Google Apps Script (Code.gs)            ║
// ║                                                                    ║
// ║  HOW TO USE:                                                       ║
// ║  1. Open Google Sheets → Create blank spreadsheet                  ║
// ║  2. Name it "Saudagar Fitness Members"                             ║
// ║  3. In Row 1, add headers:                                         ║
// ║     id | membershipId | name | phone | weight | height |           ║
// ║     joinDate | plan | admissionFee | expDate                       ║
// ║  4. Go to Extensions → Apps Script                                 ║
// ║  5. Delete default code, paste THIS entire file                    ║
// ║  6. Click Deploy → New deployment → Web app                       ║
// ║     - Execute as: Me                                               ║
// ║     - Who has access: Anyone                                       ║
// ║  7. Click Deploy → Authorize → Copy the Web App URL               ║
// ║  8. Paste that URL in script.js line 1 (SCRIPT_URL)                ║
// ║                                                                    ║
// ║  ⚠️  DO NOT include this file in your website!                     ║
// ║      This code runs inside Google Apps Script only.                 ║
// ╚════════════════════════════════════════════════════════════════════╝

const SHEET_NAME = "Sheet1"; // Change if your sheet tab has a different name

/**
 * GET handler — Returns all members as JSON array
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = data[0];
    const members = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] && !row[2]) continue; // skip completely empty rows
      const member = {};
      headers.forEach((header, j) => {
        member[header] = row[j];
      });
      members.push(member);
    }

    return ContentService
      .createTextOutput(JSON.stringify(members))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST handler — Saves a new member OR deletes an existing one
 *
 * To add a member:   POST { id, membershipId, name, phone, ... }
 * To delete a member: POST { action: "delete", id: 123456 }
 */
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = JSON.parse(e.postData.contents);

    // ── Delete request ──
    if (data.action === "delete") {
      return deleteMemberRow(sheet, data.id);
    }

    // ── Add new member ──
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(h => {
      if (data[h] !== undefined && data[h] !== null) return data[h];
      return "";
    });

    sheet.appendRow(newRow);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", id: data.id }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Deletes a row by matching member ID in column A
 */
function deleteMemberRow(sheet, id) {
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
      return ContentService
        .createTextOutput(JSON.stringify({ status: "deleted", id: id }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: "not_found", id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}
