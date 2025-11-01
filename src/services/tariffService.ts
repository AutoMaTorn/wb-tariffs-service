import { WbApiService } from './wbApiService';
import { DatabaseService } from './databaseService';
import { GoogleSheetsService } from './googleSheetsService';
import { CronJob } from 'cron';

export class TariffService {
  private isRunning = false;

  constructor(
    private wbApiService: WbApiService,
    private databaseService: DatabaseService,
    private googleSheetsService: GoogleSheetsService,
    private spreadsheetIds: string[]
  ) {}

  async fetchAndSaveTariffs(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Tariff service is already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`📅 Processing tariffs for date: ${today}`);

      const tariffsData = await this.wbApiService.getBoxTariffs(today);
      
      if (!tariffsData.warehouseList || tariffsData.warehouseList.length === 0) {
        console.log('ℹ️ No warehouse data available, skipping save operation');
        return;
      }
      
      const transformedData = tariffsData.warehouseList.map(warehouse =>
        this.wbApiService.transformTariffData(warehouse, today)
      );

      await this.databaseService.saveBoxTariffs(transformedData);

      // Обновляем Google Sheets
      const latestTariffs = await this.databaseService.getLatestTariffs();
      await this.googleSheetsService.updateMultipleSpreadsheets(this.spreadsheetIds, latestTariffs);

      console.log('✅ Tariff processing completed successfully');

    } catch (error: any) {
      console.error('❌ Error in fetchAndSaveTariffs:', error.message);
      
      // Логируем полную ошибку для отладки
      if (error.stack) {
        console.error('🔍 Error stack:', error.stack);
      }
    } finally {
      this.isRunning = false;
    }
  }

  startScheduler(): void {
    // Запускаем каждый час в 0 минут
    const job = new CronJob('0 * * * *', () => {
      this.fetchAndSaveTariffs();
    });

    job.start();
    console.log('⏰ Tariff scheduler started (runs hourly)');

    // Первый запуск сразу после старта (с задержкой 10 сек)
    setTimeout(() => {
      this.fetchAndSaveTariffs();
    }, 10000);
  }
}