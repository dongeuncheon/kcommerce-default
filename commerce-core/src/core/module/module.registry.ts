import { BaseModule } from './base.module';

export class ModuleRegistry {
  private modules: Map<string, BaseModule> = new Map();

  async register(module: BaseModule): Promise<void> {
    if (this.modules.has(module.name)) {
      throw new Error(`Module "${module.name}" is already registered`);
    }

    await module.initialize();
    this.modules.set(module.name, module);
  }

  get(name: string): BaseModule | undefined {
    return this.modules.get(name);
  }

  getAll(): BaseModule[] {
    return Array.from(this.modules.values());
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }

  async unregister(name: string): Promise<void> {
    const module = this.modules.get(name);
    if (module) {
      await module.shutdown();
      this.modules.delete(name);
    }
  }

  async shutdown(): Promise<void> {
    for (const module of this.modules.values()) {
      await module.shutdown();
    }
    this.modules.clear();
  }
}