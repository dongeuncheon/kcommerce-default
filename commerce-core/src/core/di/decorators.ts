/**
 * Dependency Injection Decorators
 * 의존성 주입을 위한 데코레이터들
 */

export const METADATA_KEYS = {
  INJECTABLE: Symbol('Injectable'),
  INJECT: Symbol('Inject'),
  SINGLETON: Symbol('Singleton'),
  TRANSIENT: Symbol('Transient'),
  SCOPED: Symbol('Scoped')
};

/**
 * Injectable 데코레이터
 * 클래스를 DI 컨테이너에 등록 가능하도록 마킹
 */
export function Injectable(options?: { singleton?: boolean }) {
  return function (target: any) {
    Reflect.defineMetadata(METADATA_KEYS.INJECTABLE, true, target);
    if (options?.singleton !== false) {
      Reflect.defineMetadata(METADATA_KEYS.SINGLETON, true, target);
    }
    return target;
  };
}

/**
 * Inject 데코레이터
 * 생성자 매개변수에 주입할 의존성을 지정
 */
export function Inject(token: string | symbol) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata(METADATA_KEYS.INJECT, target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(METADATA_KEYS.INJECT, existingTokens, target);
  };
}

/**
 * Singleton 데코레이터
 * 클래스를 싱글톤으로 등록
 */
export function Singleton() {
  return function (target: any) {
    Reflect.defineMetadata(METADATA_KEYS.SINGLETON, true, target);
    return target;
  };
}

/**
 * Transient 데코레이터
 * 매번 새로운 인스턴스를 생성
 */
export function Transient() {
  return function (target: any) {
    Reflect.defineMetadata(METADATA_KEYS.TRANSIENT, true, target);
    return target;
  };
}

/**
 * Scoped 데코레이터
 * 스코프별로 인스턴스를 관리
 */
export function Scoped(scope: string) {
  return function (target: any) {
    Reflect.defineMetadata(METADATA_KEYS.SCOPED, scope, target);
    return target;
  };
}

/**
 * Service 데코레이터 (Injectable의 별칭)
 */
export const Service = Injectable;

/**
 * Repository 데코레이터 (Injectable의 별칭)
 */
export const Repository = Injectable;

/**
 * Controller 데코레이터 (Injectable의 별칭)
 */
export const Controller = Injectable;