import { DatabaseAdapter } from './database.adapter';

export class DatabaseFactory {
  static async create(config: any): Promise<DatabaseAdapter> {
    const adapter = new DatabaseAdapter(config);
    await adapter.connect();
    return adapter;
  }
}