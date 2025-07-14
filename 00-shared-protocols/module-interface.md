# 🔌 모듈 인터페이스 표준 (레고 블록 규격)

## 📋 개요
모든 모듈(CMS, Commerce, Travel)이 준수해야 하는 표준 인터페이스입니다. 이 규격을 준수하면 모듈들이 레고 블록처럼 자유롭게 조합 가능합니다.

## 🎯 핵심 원칙
1. **플러그 앤 플레이**: 설정만으로 모듈 추가/제거
2. **타입 안전성**: TypeScript 기반 엄격한 타입 체크
3. **버전 호환성**: 하위 호환성 보장
4. **독립성**: 모듈 간 직접 의존성 금지

## 📦 모듈 표준 인터페이스

### 기본 모듈 구조
```typescript
interface Module {
  // 모듈 메타데이터
  readonly info: ModuleInfo;
  
  // 라이프사이클 관리
  readonly lifecycle: ModuleLifecycle;
  
  // 통신 인터페이스
  readonly communication: ModuleCommunication;
  
  // 데이터 스키마
  readonly data: ModuleDataSchema;
  
  // 권한 정의
  readonly permissions: ModulePermissions;
}
```

### 모듈 정보 (ModuleInfo)
```typescript
interface ModuleInfo {
  // 기본 정보
  readonly name: string;              // 모듈명 (예: "cms-core")
  readonly version: string;           // 버전 (semver)
  readonly description: string;       // 모듈 설명
  readonly author: string;            // 개발자
  
  // 의존성
  readonly dependencies: {
    required: string[];               // 필수 의존성
    optional: string[];               // 선택적 의존성
    conflicts: string[];              // 충돌 모듈
  };
  
  // 제공 기능
  readonly provides: {
    apis: string[];                   // 제공하는 API 목록
    events: string[];                 // 발생시키는 이벤트
    hooks: string[];                  // 제공하는 훅
    ui: string[];                     // UI 컴포넌트
  };
  
  // 요구사항
  readonly requires: {
    nodeVersion: string;              // Node.js 버전
    database: string[];               // 지원 DB
    storage: string[];                // 지원 스토리지
    permissions: string[];            // 필요 권한
  };
}
```

### 라이프사이클 (ModuleLifecycle)
```typescript
interface ModuleLifecycle {
  // 설치 단계
  install(context: InstallContext): Promise<InstallResult>;
  
  // 활성화 단계  
  activate(context: ActivationContext): Promise<void>;
  
  // 비활성화 단계
  deactivate(): Promise<void>;
  
  // 제거 단계
  uninstall(): Promise<void>;
  
  // 업데이트 단계
  update(fromVersion: string, toVersion: string): Promise<void>;
  
  // 상태 확인
  getStatus(): ModuleStatus;
  
  // 건강성 체크
  healthCheck(): Promise<HealthStatus>;
}

type ModuleStatus = 'installed' | 'active' | 'inactive' | 'error' | 'updating';

interface HealthStatus {
  healthy: boolean;
  issues: string[];
  performance: {
    memoryUsage: number;
    responseTime: number;
  };
}
```

### 통신 인터페이스 (ModuleCommunication)
```typescript
interface ModuleCommunication {
  // 이벤트 시스템
  events: {
    emit(event: string, data: any): void;
    on(event: string, handler: EventHandler): void;
    off(event: string, handler: EventHandler): void;
    once(event: string, handler: EventHandler): void;
  };
  
  // API 제공
  api: {
    register(path: string, handler: ApiHandler): void;
    unregister(path: string): void;
    getRoutes(): ApiRoute[];
  };
  
  // 훅 시스템
  hooks: {
    register(hookName: string, handler: HookHandler): void;
    execute(hookName: string, data: any): Promise<any>;
    getHooks(): string[];
  };
  
  // 상태 공유
  state: {
    get(key: string): any;
    set(key: string, value: any): void;
    subscribe(key: string, handler: StateHandler): void;
  };
}

interface EventHandler {
  (data: any): void | Promise<void>;
}

interface ApiHandler {
  (request: ApiRequest): Promise<ApiResponse>;
}

interface HookHandler {
  (data: any): any | Promise<any>;
}
```

### 데이터 스키마 (ModuleDataSchema)
```typescript
interface ModuleDataSchema {
  // 데이터베이스 스키마
  database: {
    tables: TableSchema[];
    indexes: IndexSchema[];
    migrations: Migration[];
  };
  
  // API 스키마
  api: {
    requests: RequestSchema[];
    responses: ResponseSchema[];
  };
  
  // 이벤트 스키마
  events: {
    outgoing: EventSchema[];
    incoming: EventSchema[];
  };
  
  // 설정 스키마
  config: ConfigSchema;
}

interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  constraints: ConstraintSchema[];
}

interface EventSchema {
  name: string;
  data: any; // Zod 스키마
  description: string;
}
```

### 권한 시스템 (ModulePermissions)
```typescript
interface ModulePermissions {
  // 정의하는 권한들
  defines: Permission[];
  
  // 요구하는 권한들
  requires: string[];
  
  // 권한 체크
  check(permission: string, context?: any): boolean;
  
  // 권한 부여
  grant(userId: string, permission: string): void;
  
  // 권한 해제
  revoke(userId: string, permission: string): void;
}

interface Permission {
  name: string;
  description: string;
  category: string;
  level: 'read' | 'write' | 'admin';
}
```

## 🔄 모듈 등록 과정

### 1. 모듈 검증
```typescript
const moduleValidator = new ModuleValidator();
const isValid = await moduleValidator.validate(module);
```

### 2. 의존성 해결
```typescript
const dependencyResolver = new DependencyResolver();
const resolved = await dependencyResolver.resolve(module.info.dependencies);
```

### 3. 모듈 등록
```typescript
const moduleRegistry = new ModuleRegistry();
await moduleRegistry.register(module);
```

### 4. 자동 활성화
```typescript
if (autoActivate) {
  await module.lifecycle.activate(context);
}
```

## 📝 모듈 개발 가이드

### 필수 구현 사항
1. ✅ `ModuleInfo` 완전 구현
2. ✅ `ModuleLifecycle` 모든 메서드 구현
3. ✅ `ModuleCommunication` 이벤트 시스템 구현
4. ✅ `ModuleDataSchema` Zod 스키마 정의
5. ✅ `ModulePermissions` 권한 시스템 구현

### 모범 사례
- **에러 처리**: 모든 메서드에서 적절한 에러 처리
- **로깅**: 구조화된 로그 기록
- **테스트**: 100% 테스트 커버리지
- **문서화**: API 문서 자동 생성
- **성능**: 메모리 누수 방지

### 금지 사항
- ❌ 다른 모듈 직접 import 금지
- ❌ 전역 변수 사용 금지
- ❌ 데이터베이스 직접 접근 금지 (어댑터 사용)
- ❌ 하드코딩된 경로 금지

## 🧪 테스트 표준

### 모듈 테스트 슈트
```typescript
describe('Module Interface Compliance', () => {
  test('모듈 정보 유효성', () => {
    expect(module.info).toBeDefined();
    expect(module.info.name).toMatch(/^[a-z-]+$/);
    expect(module.info.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
  
  test('라이프사이클 구현', () => {
    expect(module.lifecycle.install).toBeDefined();
    expect(module.lifecycle.activate).toBeDefined();
    expect(module.lifecycle.deactivate).toBeDefined();
    expect(module.lifecycle.uninstall).toBeDefined();
  });
  
  test('통신 인터페이스 구현', () => {
    expect(module.communication.events).toBeDefined();
    expect(module.communication.api).toBeDefined();
    expect(module.communication.hooks).toBeDefined();
  });
});
```

이 표준을 준수하면 모든 모듈이 레고 블록처럼 완벽하게 조합됩니다! 🧩