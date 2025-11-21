/**
 * G0 — Bootstrap Drive & Auth
 * 
 * Creates:
 * - New root folder: MH-Trading-OS-v3
 * - All subfolders: _BACKUPS, _EXPORTS, _IMPORTS, _LOGS, _PDF, _IMAGES, _ARCHIVE, _TEMPLATES, _ATTACHMENTS, _STAGING
 * - PROD sheet: HAIROTICMEN Trading OS — PROD (v3)
 * - STAGING sheet: HAIROTICMEN Trading OS — STAGING (v3)
 * - Shares with Service Account and Owner
 * 
 * Output: reports/NEW-ENV.json
 */

import { google } from 'googleapis';
import { getUncachableGoogleSheetClient } from '../../lib/sheets';
import * as fs from 'fs/promises';
import * as path from 'path';

// Configuration from master prompt
const CONFIG = {
  NEW_ROOT_FOLDER_NAME: 'MH-Trading-OS-v3',
  SERVICE_ACCOUNT_EMAIL: 'hairoticmen-sheets-bot@hairoticmen-sheets-bot.iam.gserviceaccount.com',
  OWNER_GOOGLE_ACCOUNT: 'mhtradingeu@gmail.com',
  NEW_PROD_SHEET_TITLE: 'HAIROTICMEN Trading OS — PROD (v3)',
  NEW_STAGING_SHEET_TITLE: 'HAIROTICMEN Trading OS — STAGING (v3)',
  LEGACY_SHEET_ID: '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0',
  
  SUBFOLDERS: [
    '_BACKUPS',
    '_EXPORTS', 
    '_IMPORTS',
    '_LOGS',
    '_PDF',
    '_IMAGES',
    '_ARCHIVE',
    '_TEMPLATES',
    '_ATTACHMENTS',
    '_STAGING'
  ]
};

interface G0Result {
  rootFolder: {
    id: string;
    name: string;
    webViewLink: string;
  };
  subfolders: Array<{
    name: string;
    id: string;
    webViewLink: string;
  }>;
  sheets: {
    prod: {
      id: string;
      title: string;
      webViewLink: string;
    };
    staging: {
      id: string;
      title: string;
      webViewLink: string;
    };
  };
  permissions: {
    serviceAccount: {
      email: string;
      role: string;
      status: string;
    };
    owner: {
      email: string;
      role: string;
      status: string;
    };
  };
  apis: {
    drive: string;
    sheets: string;
  };
  timestamp: string;
}

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function runG0Bootstrap(): Promise<G0Result> {
  console.log('🚀 Starting G0 — Bootstrap Drive & Auth\n');
  
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  const result: G0Result = {
    rootFolder: { id: '', name: '', webViewLink: '' },
    subfolders: [],
    sheets: {
      prod: { id: '', title: '', webViewLink: '' },
      staging: { id: '', title: '', webViewLink: '' }
    },
    permissions: {
      serviceAccount: { email: CONFIG.SERVICE_ACCOUNT_EMAIL, role: 'writer', status: '' },
      owner: { email: CONFIG.OWNER_GOOGLE_ACCOUNT, role: 'writer', status: '' }
    },
    apis: { drive: '', sheets: '' },
    timestamp: new Date().toISOString()
  };

  // Step 1: Verify APIs are enabled
  console.log('📋 Step 1: Verifying Google APIs...');
  try {
    await drive.about.get({ fields: 'user' });
    result.apis.drive = 'enabled';
    console.log('✅ Drive API: enabled');
  } catch (error) {
    result.apis.drive = 'error: ' + (error as Error).message;
    console.log('❌ Drive API: error');
  }

  try {
    await sheets.spreadsheets.get({ spreadsheetId: CONFIG.LEGACY_SHEET_ID, fields: 'spreadsheetId' });
    result.apis.sheets = 'enabled';
    console.log('✅ Sheets API: enabled');
  } catch (error) {
    result.apis.sheets = 'error: ' + (error as Error).message;
    console.log('❌ Sheets API: error');
  }

  // Step 2: Create root folder
  console.log('\n📁 Step 2: Creating root folder...');
  const rootFolderResponse = await drive.files.create({
    requestBody: {
      name: CONFIG.NEW_ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id, name, webViewLink'
  });

  result.rootFolder = {
    id: rootFolderResponse.data.id!,
    name: rootFolderResponse.data.name!,
    webViewLink: rootFolderResponse.data.webViewLink!
  };
  console.log(`✅ Root folder created: ${result.rootFolder.id}`);
  console.log(`   🔗 ${result.rootFolder.webViewLink}`);

  // Step 3: Create subfolders
  console.log('\n📁 Step 3: Creating subfolders...');
  for (const folderName of CONFIG.SUBFOLDERS) {
    const subfolderResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [result.rootFolder.id]
      },
      fields: 'id, name, webViewLink'
    });

    result.subfolders.push({
      name: subfolderResponse.data.name!,
      id: subfolderResponse.data.id!,
      webViewLink: subfolderResponse.data.webViewLink!
    });
    console.log(`✅ ${folderName}: ${subfolderResponse.data.id}`);
  }

  // Step 4: Share root folder with Service Account (Editor)
  console.log('\n🔐 Step 4: Sharing with Service Account...');
  try {
    await drive.permissions.create({
      fileId: result.rootFolder.id,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: CONFIG.SERVICE_ACCOUNT_EMAIL
      }
    });
    result.permissions.serviceAccount.status = 'success';
    console.log(`✅ Service Account granted Editor access: ${CONFIG.SERVICE_ACCOUNT_EMAIL}`);
  } catch (error) {
    result.permissions.serviceAccount.status = 'error: ' + (error as Error).message;
    console.log(`❌ Failed to share with Service Account: ${(error as Error).message}`);
  }

  // Step 5: Share root folder with Owner
  console.log('\n🔐 Step 5: Sharing with Owner...');
  try {
    await drive.permissions.create({
      fileId: result.rootFolder.id,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: CONFIG.OWNER_GOOGLE_ACCOUNT
      }
    });
    result.permissions.owner.status = 'success';
    console.log(`✅ Owner granted Editor access: ${CONFIG.OWNER_GOOGLE_ACCOUNT}`);
  } catch (error) {
    result.permissions.owner.status = 'error: ' + (error as Error).message;
    console.log(`❌ Failed to share with Owner: ${(error as Error).message}`);
  }

  // Step 6: Create PROD sheet
  console.log('\n📊 Step 6: Creating PROD sheet...');
  const prodSheetResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: CONFIG.NEW_PROD_SHEET_TITLE
      }
    }
  });
  result.sheets.prod = {
    id: prodSheetResponse.data.spreadsheetId!,
    title: CONFIG.NEW_PROD_SHEET_TITLE,
    webViewLink: prodSheetResponse.data.spreadsheetUrl!
  };
  console.log(`✅ PROD sheet created: ${result.sheets.prod.id}`);
  console.log(`   🔗 ${result.sheets.prod.webViewLink}`);

  // Move PROD sheet to root folder
  await drive.files.update({
    fileId: result.sheets.prod.id,
    addParents: result.rootFolder.id,
    fields: 'id, parents'
  });
  console.log(`✅ PROD sheet moved to root folder`);

  // Step 7: Create STAGING sheet
  console.log('\n📊 Step 7: Creating STAGING sheet...');
  const stagingSheetResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: CONFIG.NEW_STAGING_SHEET_TITLE
      }
    }
  });
  result.sheets.staging = {
    id: stagingSheetResponse.data.spreadsheetId!,
    title: CONFIG.NEW_STAGING_SHEET_TITLE,
    webViewLink: stagingSheetResponse.data.spreadsheetUrl!
  };
  console.log(`✅ STAGING sheet created: ${result.sheets.staging.id}`);
  console.log(`   🔗 ${result.sheets.staging.webViewLink}`);

  // Move STAGING sheet to root folder
  await drive.files.update({
    fileId: result.sheets.staging.id,
    addParents: result.rootFolder.id,
    fields: 'id, parents'
  });
  console.log(`✅ STAGING sheet moved to root folder`);

  // Step 8: Write results to reports/NEW-ENV.json
  console.log('\n💾 Step 8: Writing results...');
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  
  const outputPath = path.join(reportsDir, 'NEW-ENV.json');
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`✅ Results written to: ${outputPath}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ DONE-G0: Bootstrap Drive & Auth Complete');
  console.log('='.repeat(60));
  console.log(`\n📁 Root Folder: ${result.rootFolder.name}`);
  console.log(`   ID: ${result.rootFolder.id}`);
  console.log(`   🔗 ${result.rootFolder.webViewLink}`);
  console.log(`\n📊 PROD Sheet: ${result.sheets.prod.title}`);
  console.log(`   ID: ${result.sheets.prod.id}`);
  console.log(`\n📊 STAGING Sheet: ${result.sheets.staging.title}`);
  console.log(`   ID: ${result.sheets.staging.id}`);
  console.log(`\n🔐 Permissions:`);
  console.log(`   Service Account (${CONFIG.SERVICE_ACCOUNT_EMAIL}): ${result.permissions.serviceAccount.status}`);
  console.log(`   Owner (${CONFIG.OWNER_GOOGLE_ACCOUNT}): ${result.permissions.owner.status}`);
  console.log(`\n📂 Subfolders created: ${result.subfolders.length}`);
  console.log('='.repeat(60));

  return result;
}

// Execute
runG0Bootstrap()
  .then(() => {
    console.log('\n✅ G0 Bootstrap completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ G0 Bootstrap failed:', error);
    process.exit(1);
  });
