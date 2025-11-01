import { google, sheets_v4 } from 'googleapis';

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;

  constructor(private serviceAccountEmail: string, private privateKey: string) {
    const auth = new google.auth.JWT(
      serviceAccountEmail,
      undefined,
      privateKey.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  // Проверяем существование листа и создаем если нужно
  private async ensureSheetExists(spreadsheetId: string, sheetName: string): Promise<void> {
    try {
      // Получаем информацию о таблице
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId
      });

      const sheets = spreadsheet.data.sheets || [];
      const targetSheet = sheets.find(sheet => 
        sheet.properties?.title === sheetName
      );

      if (!targetSheet) {
        // Создаем новый лист
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });
        console.log(`✅ Created new sheet: ${sheetName}`);
      }
    } catch (error: any) {
      console.error(`❌ Error ensuring sheet exists: ${error.message}`);
      throw error;
    }
  }

  async updateSpreadsheet(spreadsheetId: string, data: any[]): Promise<void> {
    if (data.length === 0) {
      console.log('⚠️ No data to update in Google Sheets');
      return;
    }

    const sheetName = 'stocks_coefs';

    try {
      // Убедимся что лист существует
      await this.ensureSheetExists(spreadsheetId, sheetName);

      const headers = [
        'Date',
        'Warehouse Name',
        'Box Delivery Base',
        'Box Delivery Coef Expr',
        'Box Delivery Liter',
        'Box Delivery Marketplace Base',
        'Box Delivery Marketplace Coef Expr',
        'Box Delivery Marketplace Liter',
        'Box Storage Base',
        'Box Storage Coef Expr',
        'Box Storage Liter',
        'Geo Name'
      ];

      const values = [
        headers,
        ...data.map(row => [
          row.date,
          row.warehouse_name,
          row.box_delivery_base ?? '',
          row.box_delivery_coef_expr ?? '',
          row.box_delivery_liter ?? '',
          row.box_delivery_marketplace_base ?? '',
          row.box_delivery_marketplace_coef_expr ?? '',
          row.box_delivery_marketplace_liter ?? '',
          row.box_storage_base ?? '',
          row.box_storage_coef_expr ?? '',
          row.box_storage_liter ?? '',
          row.geo_name
        ])
      ];

      // Очищаем существующие данные (используем безопасный диапазон)
      try {
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${sheetName}!A1:Z1000` // Ограничиваем диапазон
        });
      } catch (clearError) {
        console.log('ℹ️ No data to clear or sheet is empty');
      }

      // Записываем новые данные
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values
        }
      });

      console.log(`✅ Successfully updated ${sheetName} with ${data.length} rows in spreadsheet: ${spreadsheetId}`);

    } catch (error: any) {
      console.error(`❌ Error updating spreadsheet ${spreadsheetId}:`, error.message);
      
      // Если ошибка связана с правами доступа
      if (error.message.includes('PERMISSION_DENIED')) {
        console.error('🔐 Please check:');
        console.error('1. Is the Google Service Account email shared on the spreadsheet?');
        console.error('2. Does the service account have editor permissions?');
      }
      
      // Если ошибка связана с несуществующей таблицей
      if (error.message.includes('Unable to parse range') || error.message.includes('not found')) {
        console.error('📋 Please check:');
        console.error('1. Is the spreadsheet ID correct?');
        console.error('2. Does the spreadsheet exist?');
        console.error('3. Is the service account email shared on the spreadsheet?');
      }
      
      throw error;
    }
  }

  async updateMultipleSpreadsheets(spreadsheetIds: string[], data: any[]): Promise<void> {
    if (data.length === 0) {
      console.log('⚠️ No data to update in Google Sheets');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const spreadsheetId of spreadsheetIds) {
      try {
        await this.updateSpreadsheet(spreadsheetId, data);
        successCount++;
        console.log(`✅ Updated spreadsheet: ${spreadsheetId}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to update spreadsheet ${spreadsheetId}:`, error);
      }
    }

    console.log(`📊 Google Sheets update summary: ${successCount} successful, ${errorCount} failed`);
  }
}