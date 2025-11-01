import knex, { Knex } from 'knex';
import { BoxTariffDB } from '../models/BoxTariff';

export class DatabaseService {
  private db: Knex;

  constructor(config: Knex.Config) {
    this.db = knex(config);
  }

  async saveBoxTariffs(tariffs: Omit<BoxTariffDB, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    if (tariffs.length === 0) {
      console.log('⚠️ No tariffs to save');
      return;
    }

    // Логируем первые несколько записей для отладки
    console.log('💾 Sample tariff data:', JSON.stringify(tariffs.slice(0, 2), null, 2));

    await this.db.transaction(async (trx) => {
      for (const tariff of tariffs) {
        await trx('box_tariffs')
          .insert({
            ...tariff,
            updated_at: this.db.fn.now()
          })
          .onConflict(['date', 'warehouse_name'])
          .merge();
      }
    });

    console.log(`💾 Saved/updated ${tariffs.length} tariff records`);
  }

  async getLatestTariffs(): Promise<BoxTariffDB[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tariffs = await this.db('box_tariffs')
      .where('date', '>=', sevenDaysAgo.toISOString().split('T')[0])
      .orderBy('box_storage_coef_expr', 'asc');

    console.log(`📋 Retrieved ${tariffs.length} tariffs from database`);
    
    // Преобразуем даты в строки для Google Sheets
    const formattedTariffs = tariffs.map(tariff => ({
      ...tariff,
      date: new Date(tariff.date).toISOString().split('T')[0] // Форматируем дату
    }));

    return formattedTariffs;
  }

  async disconnect(): Promise<void> {
    await this.db.destroy();
    console.log('🔌 Database connection closed');
  }
}