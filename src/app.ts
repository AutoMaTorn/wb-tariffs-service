import { WbApiService } from './services/wbApiService';
import { DatabaseService } from './services/databaseService';
import { GoogleSheetsService } from './services/googleSheetsService';
import { TariffService } from './services/tariffService';
import { config } from './config/database';

console.log('🚀 Starting WB Tariffs Service...');

class App {
  async start(): Promise<void> {
    try {
      console.log('📦 Initializing services...');

      // Инициализация сервисов
      const wbApiService = new WbApiService(process.env.WB_API_TOKEN || '');
      const databaseService = new DatabaseService(config);
      const googleSheetsService = new GoogleSheetsService(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
        process.env.GOOGLE_PRIVATE_KEY || ''
      );

      const spreadsheetIds = process.env.SPREADSHEET_IDS?.split(',') || [];

      console.log(`📊 Configured for ${spreadsheetIds.length} spreadsheets`);

      const tariffService = new TariffService(
        wbApiService,
        databaseService,
        googleSheetsService,
        spreadsheetIds
      );

      // Запуск сервиса
      tariffService.startScheduler();
      console.log('✅ WB Tariffs Service started successfully');

      // Обработка graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('🛑 SIGTERM received, shutting down gracefully');
        await databaseService.disconnect();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        console.log('🛑 SIGINT received, shutting down gracefully');
        await databaseService.disconnect();
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  }
}

// Запуск приложения
new App().start();