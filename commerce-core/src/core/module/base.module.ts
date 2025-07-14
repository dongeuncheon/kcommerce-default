import { Router } from 'express';

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: (req: any, reply: any) => Promise<any>;
  schema?: any;
}

export abstract class BaseModule {
  abstract name: string;
  router?: Router;
  routes?: Route[];

  abstract initialize(): Promise<void>;
  
  async shutdown(): Promise<void> {
    // Override in subclasses if cleanup is needed
  }

  protected createRouter(): Router {
    return Router();
  }
}