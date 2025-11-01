import axios from 'axios';
import { WbTariffsResponse, WarehouseTariff, BoxTariffDB } from '../models/BoxTariff';

interface WbErrorResponse {
  title: string;
  detail: string;
  code: string;
  requestId: string;
  origin: string;
  status: number;
  statusText: string;
  timestamp: string;
}

interface WbSuccessResponse {
  response: {
    data: WbTariffsResponse;
  };
}

export class WbApiService {
  private readonly baseUrl = 'https://common-api.wildberries.ru/api/v1/tariffs/box';

  constructor(private apiToken: string) {}

  async getBoxTariffs(date: string): Promise<WbTariffsResponse> {
    try {
      console.log(`🌐 Fetching WB tariffs for date: ${date}`);
      
      // Валидация даты
      if (!this.isValidDate(date)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
      }

      const response = await axios.get(this.baseUrl, {
        params: { date },
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        validateStatus: (status) => status < 500
      });

      console.log('📦 API Response status:', response.status);

      // Обрабатываем ошибки WB API
      if (this.isErrorResponse(response.data)) {
        const errorData = response.data as WbErrorResponse;
        throw new Error(`WB API Error [${errorData.status}]: ${errorData.title} - ${errorData.detail}`);
      }

      // Обрабатываем успешный ответ
      let tariffsData: WbTariffsResponse;

      // Формат 1: { response: { data: { ... } } } - успешный ответ
      if (this.isSuccessResponse(response.data)) {
        tariffsData = (response.data as WbSuccessResponse).response.data;
      }
      // Формат 2: Прямой ответ с данными
      else if (response.data?.warehouseList) {
        tariffsData = response.data;
      }
      // Неизвестный формат
      else {
        console.warn('⚠️ Unknown response format, using mock data');
        return this.getMockData(date);
      }

      console.log(`✅ Successfully processed tariffs for ${tariffsData.warehouseList.length} warehouses`);
      return tariffsData;

    } catch (error: any) {
      console.error('❌ WB API Error:', error.message);

      // Обрабатываем специфические ошибки WB
      if (error.message.includes('empty Authorization header') || error.message.includes('401')) {
        throw new Error('Unauthorized: Invalid or missing WB API token');
      } else if (error.message.includes('Invalid date param') || error.message.includes('400')) {
        throw new Error('Invalid date parameter. Use format YYYY-MM-DD');
      } else if (error.message.includes('too many requests') || error.message.includes('429')) {
        throw new Error('Rate limit exceeded. Try again later');
      } else if (error.message.includes('token problem') || error.message.includes('malformed')) {
        throw new Error('Invalid token format');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused - check API URL');
      } else if (error.response?.status === 404) {
        throw new Error('API endpoint not found');
      } else {
        // Возвращаем заглушку при других ошибках
        console.log('🔄 Using mock data due to API error');
        return this.getMockData(date);
      }
    }
  }

  // Проверяем валидность даты
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // Проверяем является ли ответ ошибкой
  private isErrorResponse(data: any): data is WbErrorResponse {
    return data && 
           typeof data === 'object' && 
           (data.status === 401 || data.status === 400 || data.status === 429) &&
           data.title && data.detail;
  }

  // Проверяем является ли ответ успешным
  private isSuccessResponse(data: any): data is WbSuccessResponse {
    return data && 
           data.response && 
           data.response.data &&
           Array.isArray(data.response.data.warehouseList);
  }

  // Метод для тестовых данных
  private getMockData(date: string): WbTariffsResponse {
    console.log('🎭 Using mock data for development');
    return {
      dtNextBox: "2024-02-01",
      dtTillMax: "2024-03-31",
      warehouseList: [
        {
          boxDeliveryBase: "48",
          boxDeliveryCoefExpr: "160",
          boxDeliveryLiter: "11,2",
          boxDeliveryMarketplaceBase: "40",
          boxDeliveryMarketplaceCoefExpr: "125",
          boxDeliveryMarketplaceLiter: "11",
          boxStorageBase: "0,14",
          boxStorageCoefExpr: "115",
          boxStorageLiter: "0,07",
          geoName: "Центральный федеральный округ",
          warehouseName: "Коледино"
        }
      ]
    };
  }

  // ИСПРАВЛЕННЫЙ МЕТОД ПАРСИНГА ЧИСЕЛ
  parseTariffNumber(value: string): number | null {
    if (!value || value === '-' || value === '' || value === 'null') {
      return null; // Возвращаем null вместо 0 для отсутствующих значений
    }
    
    const cleanedValue = value.replace(',', '.').replace(/\s/g, '');
    const number = parseFloat(cleanedValue);
    
    if (isNaN(number)) {
      console.warn(`⚠️ Cannot parse tariff number: "${value}", using null`);
      return null;
    }
    
    return number;
  }

  transformTariffData(warehouseData: WarehouseTariff, date: string): Omit<BoxTariffDB, 'id' | 'created_at' | 'updated_at'> {
    return {
      date: date.split('T')[0], // Убедимся что дата в формате YYYY-MM-DD
      warehouse_name: warehouseData.warehouseName || 'Unknown',
      box_delivery_base: this.parseTariffNumber(warehouseData.boxDeliveryBase),
      box_delivery_coef_expr: this.parseTariffNumber(warehouseData.boxDeliveryCoefExpr),
      box_delivery_liter: this.parseTariffNumber(warehouseData.boxDeliveryLiter),
      box_delivery_marketplace_base: this.parseTariffNumber(warehouseData.boxDeliveryMarketplaceBase),
      box_delivery_marketplace_coef_expr: this.parseTariffNumber(warehouseData.boxDeliveryMarketplaceCoefExpr),
      box_delivery_marketplace_liter: this.parseTariffNumber(warehouseData.boxDeliveryMarketplaceLiter),
      box_storage_base: this.parseTariffNumber(warehouseData.boxStorageBase),
      box_storage_coef_expr: this.parseTariffNumber(warehouseData.boxStorageCoefExpr),
      box_storage_liter: this.parseTariffNumber(warehouseData.boxStorageLiter),
      geo_name: warehouseData.geoName || 'Unknown'
    };
  }
}