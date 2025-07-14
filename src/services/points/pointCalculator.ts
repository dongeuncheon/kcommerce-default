import { PointPolicy } from '../../types/point';

export class PointCalculator {
  constructor(private policy: PointPolicy) {}

  /**
   * 회원 등급별 적립률 계산
   */
  getEarnRate(membershipLevel?: string): number {
    if (!membershipLevel) {
      return this.policy.orderEarnRate;
    }

    const rate = this.policy.membershipRates[membershipLevel as keyof typeof this.policy.membershipRates];
    return rate || this.policy.orderEarnRate;
  }

  /**
   * 적립 포인트 계산
   */
  calculateEarnPoints(orderAmount: number, earnRate?: number): number {
    const rate = earnRate || this.policy.orderEarnRate;
    return Math.floor(orderAmount * (rate / 100));
  }

  /**
   * 사용 가능한 최대 포인트 계산
   */
  calculateMaxUsablePoints(orderAmount: number, availablePoints: number): number {
    const maxByPolicy = Math.floor(orderAmount * (this.policy.maximumUseRate / 100));
    const maxByBalance = Math.max(0, availablePoints);
    const maxByMinimum = availablePoints >= this.policy.minimumUseAmount ? availablePoints : 0;
    
    return Math.min(maxByPolicy, maxByBalance, maxByMinimum);
  }

  /**
   * 포인트 사용 가능 여부 확인
   */
  canUsePoints(amount: number, orderAmount: number, availablePoints: number): {
    valid: boolean;
    reason?: string;
  } {
    if (amount < this.policy.minimumUseAmount) {
      return {
        valid: false,
        reason: `최소 ${this.policy.minimumUseAmount}포인트부터 사용 가능합니다.`
      };
    }

    if (amount > availablePoints) {
      return {
        valid: false,
        reason: '보유 포인트가 부족합니다.'
      };
    }

    const maxUsable = this.calculateMaxUsablePoints(orderAmount, availablePoints);
    if (amount > maxUsable) {
      return {
        valid: false,
        reason: `주문 금액의 ${this.policy.maximumUseRate}%까지만 사용 가능합니다.`
      };
    }

    return { valid: true };
  }

  /**
   * 만료 예정일 계산
   */
  calculateExpirationDate(earnedDate: Date = new Date()): Date {
    const expirationDate = new Date(earnedDate);
    expirationDate.setDate(expirationDate.getDate() + this.policy.expirationDays);
    return expirationDate;
  }

  /**
   * 만료 알림 대상 여부 확인
   */
  shouldNotifyExpiration(expiresAt: Date): boolean {
    const daysUntilExpiration = Math.floor(
      (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    return daysUntilExpiration > 0 && daysUntilExpiration <= this.policy.expirationNotifyDays;
  }
}