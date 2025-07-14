import 'reflect-metadata';

export interface ServiceDescriptor {
  factory?: () => any;
  instance?: any;
  singleton?: boolean;
}

export class Container {
  private static instance: Container;
  private services: Map<string, ServiceDescriptor> = new Map();

  private constructor() {}

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  register(name: string, service: any, options?: { singleton?: boolean }): void {
    const descriptor: ServiceDescriptor = {
      singleton: options?.singleton ?? true
    };

    if (typeof service === 'function' && service.prototype) {
      descriptor.factory = () => new service();
    } else if (typeof service === 'function') {
      descriptor.factory = service;
    } else {
      descriptor.instance = service;
    }

    this.services.set(name, descriptor);
  }

  resolve<T>(name: string): T {
    const descriptor = this.services.get(name);
    
    if (!descriptor) {
      throw new Error(`Service "${name}" not found in container`);
    }

    if (descriptor.instance) {
      return descriptor.instance;
    }

    if (descriptor.factory) {
      const instance = descriptor.factory();
      
      if (descriptor.singleton) {
        descriptor.instance = instance;
        delete descriptor.factory;
      }
      
      return instance;
    }

    throw new Error(`Invalid service descriptor for "${name}"`);
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  clear(): void {
    this.services.clear();
  }
}