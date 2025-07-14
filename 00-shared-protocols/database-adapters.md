# 🗄️ 데이터베이스 어댑터 시스템

## 📋 개요
다양한 데이터베이스 백엔드(Firebase, Supabase, Self-hosted)를 지원하는 통합 어댑터 시스템입니다. 모든 모듈이 동일한 인터페이스로 데이터베이스에 접근할 수 있도록 추상화 계층을 제공합니다.

## 🎯 핵심 원칙
1. **추상화**: 모든 DB 작업은 공통 인터페이스를 통해 수행
2. **호환성**: 다양한 DB 백엔드 지원 (Firebase/Supabase/PostgreSQL/MySQL)
3. **성능**: 각 DB의 최적화 기능 활용
4. **마이그레이션**: DB 간 데이터 이전 지원

## 🔌 데이터베이스 어댑터 인터페이스

### 기본 어댑터 인터페이스
```typescript
interface DatabaseAdapter {
  // 연결 관리
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConfig(): DatabaseConfig;

  // 기본 CRUD 작업
  create<T>(collection: string, data: Partial<T>): Promise<T>;
  findById<T>(collection: string, id: string): Promise<T | null>;
  findMany<T>(collection: string, query?: QueryOptions): Promise<T[]>;
  update<T>(collection: string, id: string, data: Partial<T>): Promise<T>;
  delete(collection: string, id: string): Promise<boolean>;

  // 고급 쿼리
  query<T>(collection: string, query: QueryBuilder): Promise<T[]>;
  count(collection: string, query?: QueryOptions): Promise<number>;
  exists(collection: string, id: string): Promise<boolean>;

  // 일괄 작업
  batchCreate<T>(collection: string, items: Partial<T>[]): Promise<T[]>;
  batchUpdate<T>(collection: string, updates: BatchUpdate<T>[]): Promise<T[]>;
  batchDelete(collection: string, ids: string[]): Promise<boolean>;

  // 트랜잭션
  transaction<T>(operations: TransactionOperation[]): Promise<T>;

  // 관계형 작업
  join<T>(query: JoinQuery): Promise<T[]>;
  
  // 실시간 구독 (지원하는 DB만)
  subscribe<T>(collection: string, query: QueryOptions, callback: (data: T[]) => void): Promise<() => void>;

  // 마이그레이션
  migrate(migrations: Migration[]): Promise<void>;
  rollback(version: string): Promise<void>;

  // 백업/복원
  backup(options: BackupOptions): Promise<string>;
  restore(backupPath: string): Promise<void>;

  // 성능 모니터링
  getMetrics(): Promise<DatabaseMetrics>;
}
```

### 데이터베이스 설정
```typescript
interface DatabaseConfig {
  type: 'firebase' | 'supabase' | 'postgresql' | 'mysql' | 'mongodb';
  name: string;
  
  // Firebase 설정
  firebase?: {
    projectId: string;
    credentials: string; // 서비스 계정 키 파일 경로
    databaseURL?: string;
  };

  // Supabase 설정
  supabase?: {
    url: string;
    key: string;
    schema?: string;
  };

  // PostgreSQL/MySQL 설정
  sql?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    pool?: {
      min: number;
      max: number;
    };
  };

  // MongoDB 설정
  mongodb?: {
    uri: string;
    database: string;
    options?: any;
  };

  // 공통 옵션
  options?: {
    retryAttempts: number;
    retryDelay: number;
    timeout: number;
    debug: boolean;
  };
}
```

### 쿼리 빌더
```typescript
interface QueryBuilder {
  select(fields: string[]): QueryBuilder;
  where(field: string, operator: QueryOperator, value: any): QueryBuilder;
  orderBy(field: string, direction: 'asc' | 'desc'): QueryBuilder;
  limit(count: number): QueryBuilder;
  offset(count: number): QueryBuilder;
  groupBy(fields: string[]): QueryBuilder;
  having(field: string, operator: QueryOperator, value: any): QueryBuilder;
  build(): QueryOptions;
}

type QueryOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not-in' | 'like' | 'contains' | 'starts-with' | 'ends-with';

interface QueryOptions {
  select?: string[];
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  groupBy?: string[];
  having?: WhereClause[];
}

interface WhereClause {
  field: string;
  operator: QueryOperator;
  value: any;
  logic?: 'and' | 'or';
}

interface OrderByClause {
  field: string;
  direction: 'asc' | 'desc';
}
```

## 🔥 Firebase 어댑터

### Firebase 어댑터 구현
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';

export class FirebaseAdapter implements DatabaseAdapter {
  private app: any;
  private db: any;
  private config: DatabaseConfig;

  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;
    
    if (!config.firebase) {
      throw new Error('Firebase 설정이 필요합니다');
    }

    this.app = initializeApp({
      projectId: config.firebase.projectId,
      // 추가 Firebase 설정...
    });

    this.db = getFirestore(this.app);
  }

  async disconnect(): Promise<void> {
    // Firebase는 명시적 연결 해제가 필요하지 않음
  }

  isConnected(): boolean {
    return !!this.db;
  }

  async create<T>(collectionName: string, data: Partial<T>): Promise<T> {
    const col = collection(this.db, collectionName);
    const docRef = await addDoc(col, {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      id: docRef.id,
      ...data
    } as T;
  }

  async findById<T>(collectionName: string, id: string): Promise<T | null> {
    const docRef = doc(this.db, collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    } as T;
  }

  async findMany<T>(collectionName: string, queryOptions?: QueryOptions): Promise<T[]> {
    let q = collection(this.db, collectionName);

    if (queryOptions) {
      // where 조건 적용
      if (queryOptions.where) {
        for (const clause of queryOptions.where) {
          q = query(q, where(clause.field, this.convertOperator(clause.operator), clause.value));
        }
      }

      // orderBy 적용
      if (queryOptions.orderBy) {
        for (const order of queryOptions.orderBy) {
          q = query(q, orderBy(order.field, order.direction));
        }
      }

      // limit 적용
      if (queryOptions.limit) {
        q = query(q, limit(queryOptions.limit));
      }
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<T> {
    const docRef = doc(this.db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });

    return this.findById<T>(collectionName, id) as Promise<T>;
  }

  async delete(collectionName: string, id: string): Promise<boolean> {
    try {
      const docRef = doc(this.db, collectionName, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 실시간 구독 (Firebase의 강점)
  async subscribe<T>(
    collectionName: string, 
    queryOptions: QueryOptions, 
    callback: (data: T[]) => void
  ): Promise<() => void> {
    // onSnapshot을 사용한 실시간 구독 구현
    // 구독 해제 함수 반환
  }

  private convertOperator(operator: QueryOperator): any {
    const operatorMap = {
      '=': '==',
      '!=': '!=',
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
      'in': 'in',
      'not-in': 'not-in',
      'contains': 'array-contains',
      'starts-with': '>=', // 특별 처리 필요
      'ends-with': '<=' // 특별 처리 필요
    };
    
    return operatorMap[operator] || '==';
  }

  // 추가 메서드들 구현...
}
```

## 🚀 Supabase 어댑터

### Supabase 어댑터 구현
```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseAdapter implements DatabaseAdapter {
  private client: SupabaseClient;
  private config: DatabaseConfig;

  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;
    
    if (!config.supabase) {
      throw new Error('Supabase 설정이 필요합니다');
    }

    this.client = createClient(
      config.supabase.url,
      config.supabase.key
    );
  }

  async create<T>(table: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.client
      .from(table)
      .insert({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(`생성 실패: ${error.message}`);
    return result as T;
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // 데이터 없음 에러가 아닌 경우
      throw new Error(`조회 실패: ${error.message}`);
    }

    return data as T || null;
  }

  async findMany<T>(table: string, queryOptions?: QueryOptions): Promise<T[]> {
    let query = this.client.from(table).select('*');

    if (queryOptions) {
      // where 조건 적용
      if (queryOptions.where) {
        for (const clause of queryOptions.where) {
          query = this.applyWhereClause(query, clause);
        }
      }

      // orderBy 적용
      if (queryOptions.orderBy) {
        for (const order of queryOptions.orderBy) {
          query = query.order(order.field, { ascending: order.direction === 'asc' });
        }
      }

      // limit과 offset 적용
      if (queryOptions.limit) {
        const start = queryOptions.offset || 0;
        const end = start + queryOptions.limit - 1;
        query = query.range(start, end);
      }
    }

    const { data, error } = await query;

    if (error) throw new Error(`조회 실패: ${error.message}`);
    return data as T[];
  }

  // 실시간 구독 (Supabase의 강점)
  async subscribe<T>(
    table: string,
    queryOptions: QueryOptions,
    callback: (data: T[]) => void
  ): Promise<() => void> {
    const subscription = this.client
      .channel(`${table}_changes`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table },
        (payload) => {
          // 변경사항을 처리하고 callback 호출
          this.handleRealtimeChange(table, queryOptions, callback, payload);
        }
      )
      .subscribe();

    // 구독 해제 함수 반환
    return () => {
      this.client.removeChannel(subscription);
    };
  }

  private applyWhereClause(query: any, clause: WhereClause): any {
    switch (clause.operator) {
      case '=':
        return query.eq(clause.field, clause.value);
      case '!=':
        return query.neq(clause.field, clause.value);
      case '>':
        return query.gt(clause.field, clause.value);
      case '>=':
        return query.gte(clause.field, clause.value);
      case '<':
        return query.lt(clause.field, clause.value);
      case '<=':
        return query.lte(clause.field, clause.value);
      case 'in':
        return query.in(clause.field, clause.value);
      case 'like':
        return query.like(clause.field, clause.value);
      case 'contains':
        return query.contains(clause.field, clause.value);
      case 'starts-with':
        return query.like(clause.field, `${clause.value}%`);
      case 'ends-with':
        return query.like(clause.field, `%${clause.value}`);
      default:
        return query;
    }
  }

  // 추가 메서드들 구현...
}
```

## 🐘 PostgreSQL 어댑터

### PostgreSQL 어댑터 구현
```typescript
import { Pool, PoolClient } from 'pg';

export class PostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool;
  private config: DatabaseConfig;

  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;
    
    if (!config.sql) {
      throw new Error('PostgreSQL 설정이 필요합니다');
    }

    this.pool = new Pool({
      host: config.sql.host,
      port: config.sql.port,
      database: config.sql.database,
      user: config.sql.username,
      password: config.sql.password,
      ssl: config.sql.ssl,
      min: config.sql.pool?.min || 2,
      max: config.sql.pool?.max || 10
    });
  }

  async create<T>(table: string, data: Partial<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, index) => `$${index + 1}`);

      const query = `
        INSERT INTO ${table} (${fields.join(', ')}, created_at, updated_at)
        VALUES (${placeholders.join(', ')}, NOW(), NOW())
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows[0] as T;
    } finally {
      client.release();
    }
  }

  async findById<T>(table: string, id: string): Promise<T | null> {
    const client = await this.pool.connect();
    
    try {
      const query = `SELECT * FROM ${table} WHERE id = $1`;
      const result = await client.query(query, [id]);
      
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async findMany<T>(table: string, queryOptions?: QueryOptions): Promise<T[]> {
    const client = await this.pool.connect();
    
    try {
      let query = `SELECT * FROM ${table}`;
      const values: any[] = [];
      let valueIndex = 1;

      // WHERE 절 구성
      if (queryOptions?.where && queryOptions.where.length > 0) {
        const whereConditions = queryOptions.where.map(clause => {
          values.push(clause.value);
          return `${clause.field} ${this.convertOperator(clause.operator)} $${valueIndex++}`;
        });
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // ORDER BY 절 구성
      if (queryOptions?.orderBy && queryOptions.orderBy.length > 0) {
        const orderConditions = queryOptions.orderBy.map(order => 
          `${order.field} ${order.direction.toUpperCase()}`
        );
        query += ` ORDER BY ${orderConditions.join(', ')}`;
      }

      // LIMIT과 OFFSET 적용
      if (queryOptions?.limit) {
        query += ` LIMIT $${valueIndex++}`;
        values.push(queryOptions.limit);
      }

      if (queryOptions?.offset) {
        query += ` OFFSET $${valueIndex++}`;
        values.push(queryOptions.offset);
      }

      const result = await client.query(query, values);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  // 트랜잭션 지원 (PostgreSQL의 강점)
  async transaction<T>(operations: TransactionOperation[]): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      for (const operation of operations) {
        const result = await this.executeOperation(client, operation);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results as T;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private convertOperator(operator: QueryOperator): string {
    const operatorMap = {
      '=': '=',
      '!=': '!=',
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
      'in': 'IN',
      'not-in': 'NOT IN',
      'like': 'LIKE',
      'contains': 'LIKE', // 특별 처리 필요
      'starts-with': 'LIKE', // 특별 처리 필요
      'ends-with': 'LIKE' // 특별 처리 필요
    };
    
    return operatorMap[operator] || '=';
  }

  // 추가 메서드들 구현...
}
```

## 🏭 데이터베이스 팩토리

### 어댑터 팩토리
```typescript
export class DatabaseAdapterFactory {
  private static adapters: Map<string, DatabaseAdapter> = new Map();

  static async create(config: DatabaseConfig): Promise<DatabaseAdapter> {
    const key = `${config.type}_${config.name}`;
    
    if (this.adapters.has(key)) {
      return this.adapters.get(key)!;
    }

    let adapter: DatabaseAdapter;

    switch (config.type) {
      case 'firebase':
        adapter = new FirebaseAdapter();
        break;
      case 'supabase':
        adapter = new SupabaseAdapter();
        break;
      case 'postgresql':
        adapter = new PostgreSQLAdapter();
        break;
      case 'mysql':
        adapter = new MySQLAdapter();
        break;
      case 'mongodb':
        adapter = new MongoDBAdapter();
        break;
      default:
        throw new Error(`지원하지 않는 데이터베이스 타입: ${config.type}`);
    }

    await adapter.connect(config);
    this.adapters.set(key, adapter);
    
    return adapter;
  }

  static async getAdapter(type: string, name: string): Promise<DatabaseAdapter | null> {
    const key = `${type}_${name}`;
    return this.adapters.get(key) || null;
  }

  static async closeAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }
}
```

## 🔄 마이그레이션 시스템

### 마이그레이션 인터페이스
```typescript
interface Migration {
  version: string;
  name: string;
  up: (adapter: DatabaseAdapter) => Promise<void>;
  down: (adapter: DatabaseAdapter) => Promise<void>;
  dependencies?: string[];
}

class MigrationManager {
  constructor(private adapter: DatabaseAdapter) {}

  async runMigrations(migrations: Migration[]): Promise<void> {
    // 마이그레이션 실행 로직
    for (const migration of migrations) {
      await this.runMigration(migration);
    }
  }

  async rollback(targetVersion: string): Promise<void> {
    // 롤백 로직
  }

  private async runMigration(migration: Migration): Promise<void> {
    try {
      await migration.up(this.adapter);
      await this.recordMigration(migration);
    } catch (error) {
      throw new Error(`마이그레이션 실패 (${migration.version}): ${error.message}`);
    }
  }
}
```

## 📊 성능 모니터링

### 데이터베이스 메트릭
```typescript
interface DatabaseMetrics {
  connectionPool: {
    total: number;
    active: number;
    idle: number;
    waiting: number;
  };
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    totalQueries: number;
    errorsCount: number;
  };
  storage: {
    size: number;
    collections: number;
    indexes: number;
  };
  lastUpdated: string;
}

class DatabaseMonitor {
  constructor(private adapter: DatabaseAdapter) {}

  async getMetrics(): Promise<DatabaseMetrics> {
    return await this.adapter.getMetrics();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.adapter.query('health_check', { limit: 1 });
      return true;
    } catch {
      return false;
    }
  }
}
```

## 🧪 테스트 지원

### 테스트 데이터베이스
```typescript
class TestDatabaseAdapter implements DatabaseAdapter {
  private inMemoryStore: Map<string, any[]> = new Map();

  async create<T>(collection: string, data: Partial<T>): Promise<T> {
    const id = `test_${Date.now()}_${Math.random()}`;
    const item = { id, ...data } as T;
    
    if (!this.inMemoryStore.has(collection)) {
      this.inMemoryStore.set(collection, []);
    }
    
    this.inMemoryStore.get(collection)!.push(item);
    return item;
  }

  // 다른 메서드들도 인메모리 구현...
}

export function createTestAdapter(): DatabaseAdapter {
  return new TestDatabaseAdapter();
}
```

이 데이터베이스 어댑터 시스템을 통해 모든 모듈이 다양한 데이터베이스를 일관된 방식으로 사용할 수 있습니다! 🗄️