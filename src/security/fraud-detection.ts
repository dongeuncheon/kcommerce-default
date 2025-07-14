import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cacheService';

export interface FraudScore {
  score: number; // 0-100, 높을수록 위험
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasons: string[];
  recommendations: string[];
}

export interface TransactionData {
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  billingAddress?: any;
  shippingAddress?: any;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  timestamp: Date;
}

export interface UserBehaviorPattern {
  userId: string;
  avgOrderValue: number;
  orderFrequency: number;
  preferredPaymentMethods: string[];
  commonIPs: string[];
  commonDevices: string[];
  shippingAddresses: any[];
  riskScore: number;
  lastUpdated: Date;
}

export class FraudDetectionService {
  private prisma: PrismaClient;
  private readonly RISK_THRESHOLDS = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 90
  };

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 종합 사기 탐지 분석
   */
  async analyzeFraudRisk(transaction: TransactionData): Promise<FraudScore> {
    const scores: Array<{ score: number; reason: string }> = [];

    try {
      // 1. IP 기반 분석
      const ipScore = await this.analyzeIPRisk(transaction.ip);
      scores.push({ score: ipScore.score, reason: ipScore.reason });

      // 2. 사용자 행동 패턴 분석
      if (transaction.userId) {
        const behaviorScore = await this.analyzeUserBehavior(transaction);
        scores.push({ score: behaviorScore.score, reason: behaviorScore.reason });
      }

      // 3. 거래 패턴 분석
      const transactionScore = await this.analyzeTransactionPattern(transaction);
      scores.push({ score: transactionScore.score, reason: transactionScore.reason });

      // 4. 속도 제한 분석
      const velocityScore = await this.analyzeVelocity(transaction);
      scores.push({ score: velocityScore.score, reason: velocityScore.reason });

      // 5. 디바이스 지문 분석
      const deviceScore = await this.analyzeDeviceFingerprint(transaction);
      scores.push({ score: deviceScore.score, reason: deviceScore.reason });

      // 6. 지리적 분석
      const geoScore = await this.analyzeGeolocation(transaction);
      scores.push({ score: geoScore.score, reason: geoScore.reason });

      // 7. 결제 방법 분석
      const paymentScore = await this.analyzePaymentMethod(transaction);
      scores.push({ score: paymentScore.score, reason: paymentScore.reason });

      // 가중 평균 계산
      const totalScore = this.calculateWeightedScore(scores);
      const level = this.getRiskLevel(totalScore);
      const reasons = scores.filter(s => s.score > 20).map(s => s.reason);
      const recommendations = this.generateRecommendations(level, reasons);

      const fraudScore: FraudScore = {
        score: Math.round(totalScore),
        level,
        reasons,
        recommendations
      };

      // 결과 로깅
      logger.info(`Fraud analysis completed: ${transaction.userId || transaction.sessionId} - Score: ${fraudScore.score} (${fraudScore.level})`);

      // 고위험 거래 알림
      if (level === 'HIGH' || level === 'CRITICAL') {
        await this.alertHighRiskTransaction(transaction, fraudScore);
      }

      return fraudScore;

    } catch (error) {
      logger.error('Fraud detection analysis failed:', error);
      
      // 오류 시 보수적 접근
      return {
        score: 50,
        level: 'MEDIUM',
        reasons: ['Analysis failed - manual review required'],
        recommendations: ['Manual review required due to system error']
      };
    }
  }

  /**
   * IP 위험도 분석
   */
  private async analyzeIPRisk(ip: string): Promise<{ score: number; reason: string }> {
    try {
      // IP 블랙리스트 확인
      const isBlacklisted = await this.isIPBlacklisted(ip);
      if (isBlacklisted) {
        return { score: 95, reason: 'IP address is blacklisted' };
      }

      // VPN/프록시 탐지
      const isVPN = await this.detectVPNorProxy(ip);
      if (isVPN) {
        return { score: 70, reason: 'VPN or proxy detected' };
      }

      // 지리적 위치 확인
      const geoData = await this.getIPGeolocation(ip);
      if (geoData.country && this.isHighRiskCountry(geoData.country)) {
        return { score: 60, reason: `High-risk country: ${geoData.country}` };
      }

      // IP 평판 점수
      const reputationScore = await this.getIPReputation(ip);
      if (reputationScore > 70) {
        return { score: reputationScore, reason: 'Poor IP reputation score' };
      }

      return { score: Math.max(0, reputationScore - 10), reason: 'IP analysis passed' };

    } catch (error) {
      logger.warn('IP risk analysis failed:', error);
      return { score: 30, reason: 'IP analysis inconclusive' };
    }
  }

  /**
   * 사용자 행동 패턴 분석
   */
  private async analyzeUserBehavior(transaction: TransactionData): Promise<{ score: number; reason: string }> {
    if (!transaction.userId) {
      return { score: 40, reason: 'Guest checkout - limited analysis' };
    }

    try {
      const pattern = await this.getUserBehaviorPattern(transaction.userId);
      if (!pattern) {
        return { score: 30, reason: 'New user - limited history' };
      }

      let score = 0;
      const reasons: string[] = [];

      // 주문 금액 편차 분석
      const amountDeviation = Math.abs(transaction.amount - pattern.avgOrderValue) / pattern.avgOrderValue;
      if (amountDeviation > 3) {
        score += 40;
        reasons.push('Order amount significantly deviates from user pattern');
      } else if (amountDeviation > 1.5) {
        score += 20;
        reasons.push('Order amount moderately deviates from user pattern');
      }

      // 결제 방법 확인
      if (!pattern.preferredPaymentMethods.includes(transaction.paymentMethod)) {
        score += 25;
        reasons.push('Unusual payment method for this user');
      }

      // IP 주소 확인
      if (!pattern.commonIPs.includes(transaction.ip)) {
        score += 15;
        reasons.push('New IP address for this user');
      }

      // 기기 확인
      if (!pattern.commonDevices.includes(transaction.userAgent)) {
        score += 10;
        reasons.push('New device for this user');
      }

      return {
        score: Math.min(score, 100),
        reason: reasons.length > 0 ? reasons.join('; ') : 'User behavior analysis passed'
      };

    } catch (error) {
      logger.warn('User behavior analysis failed:', error);
      return { score: 25, reason: 'User behavior analysis inconclusive' };
    }
  }

  /**
   * 거래 패턴 분석
   */
  private async analyzeTransactionPattern(transaction: TransactionData): Promise<{ score: number; reason: string }> {
    try {
      let score = 0;
      const reasons: string[] = [];

      // 주문 금액 분석
      if (transaction.amount > 1000000) { // 100만원 이상
        score += 30;
        reasons.push('Very high order amount');
      } else if (transaction.amount > 500000) { // 50만원 이상
        score += 15;
        reasons.push('High order amount');
      }

      // 주문 시간 분석
      const hour = transaction.timestamp.getHours();
      if (hour < 6 || hour > 23) {
        score += 20;
        reasons.push('Unusual transaction time');
      }

      // 상품 수량 분석
      const totalQuantity = transaction.items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity > 10) {
        score += 25;
        reasons.push('Unusually high product quantities');
      }

      // 주소 불일치 분석
      if (transaction.billingAddress && transaction.shippingAddress) {
        const addressMismatch = this.compareAddresses(transaction.billingAddress, transaction.shippingAddress);
        if (addressMismatch > 0.7) {
          score += 35;
          reasons.push('Significant billing/shipping address mismatch');
        }
      }

      return {
        score: Math.min(score, 100),
        reason: reasons.length > 0 ? reasons.join('; ') : 'Transaction pattern analysis passed'
      };

    } catch (error) {
      logger.warn('Transaction pattern analysis failed:', error);
      return { score: 20, reason: 'Transaction pattern analysis inconclusive' };
    }
  }

  /**
   * 속도 제한 분석 (Velocity Check)
   */
  private async analyzeVelocity(transaction: TransactionData): Promise<{ score: number; reason: string }> {
    try {
      const now = new Date();
      const oneHour = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let score = 0;
      const reasons: string[] = [];

      // IP 기반 속도 체크
      const ipTransactions = await this.getRecentTransactionsByIP(transaction.ip, oneHour);
      if (ipTransactions.length > 5) {
        score += 50;
        reasons.push('Too many transactions from same IP in short time');
      }

      // 사용자 기반 속도 체크
      if (transaction.userId) {
        const userTransactions = await this.getRecentTransactionsByUser(transaction.userId, oneDay);
        if (userTransactions.length > 10) {
          score += 40;
          reasons.push('Too many transactions from same user in one day');
        }
      }

      // 결제 카드 기반 속도 체크
      const cardTransactions = await this.getRecentTransactionsByPaymentMethod(
        transaction.paymentMethod, 
        oneHour
      );
      if (cardTransactions.length > 3) {
        score += 45;
        reasons.push('Too many transactions with same payment method');
      }

      return {
        score: Math.min(score, 100),
        reason: reasons.length > 0 ? reasons.join('; ') : 'Velocity check passed'
      };

    } catch (error) {
      logger.warn('Velocity analysis failed:', error);
      return { score: 25, reason: 'Velocity analysis inconclusive' };
    }
  }

  /**
   * 디바이스 지문 분석
   */
  private async analyzeDeviceFingerprint(transaction: TransactionData): Promise<{ score: number; reason: string }> {
    try {
      let score = 0;
      const reasons: string[] = [];

      // User-Agent 분석
      if (!transaction.userAgent || transaction.userAgent.length < 50) {
        score += 30;
        reasons.push('Suspicious or missing user agent');
      }

      // 봇 탐지
      if (this.detectBot(transaction.userAgent)) {
        score += 80;
        reasons.push('Bot or automated tool detected');
      }

      // 브라우저 버전 확인
      if (this.isOutdatedBrowser(transaction.userAgent)) {
        score += 15;
        reasons.push('Outdated browser version');
      }

      return {
        score: Math.min(score, 100),
        reason: reasons.length > 0 ? reasons.join('; ') : 'Device fingerprint analysis passed'
      };

    } catch (error) {
      logger.warn('Device fingerprint analysis failed:', error);
      return { score: 20, reason: 'Device fingerprint analysis inconclusive' };
    }
  }

  /**
   * 지리적 위치 분석
   */
  private async analyzeGeolocation(transaction: TransactionData): Promise<{ score: number; reason: string }> {
    try {
      let score = 0;
      const reasons: string[] = [];

      const geoData = await this.getIPGeolocation(transaction.ip);
      
      if (transaction.userId && geoData.country) {
        const userLocations = await this.getUserLocationHistory(transaction.userId);
        
        if (userLocations.length > 0) {
          const isNewCountry = !userLocations.some(loc => loc.country === geoData.country);
          
          if (isNewCountry) {
            score += 35;
            reasons.push('Transaction from new country');
          }

          // 지리적 임계값 확인 (이전 거래와 거리)
          const lastLocation = userLocations[0];
          const distance = this.calculateDistance(lastLocation, geoData);
          
          if (distance > 10000) { // 10,000km 이상
            score += 50;
            reasons.push('Geographically impossible transaction speed');
          } else if (distance > 5000) { // 5,000km 이상
            score += 25;
            reasons.push('Long distance from previous transaction');
          }
        }
      }

      return {
        score: Math.min(score, 100),
        reason: reasons.length > 0 ? reasons.join('; ') : 'Geolocation analysis passed'
      };

    } catch (error) {
      logger.warn('Geolocation analysis failed:', error);
      return { score: 15, reason: 'Geolocation analysis inconclusive' };
    }
  }

  /**
   * 결제 방법 분석
   */
  private async analyzePaymentMethod(transaction: TransactionData): Promise<{ score: number; reason: string }> {
    try {
      let score = 0;
      const reasons: string[] = [];

      // 고위험 결제 방법
      const highRiskMethods = ['cryptocurrency', 'prepaid_card', 'money_transfer'];
      if (highRiskMethods.includes(transaction.paymentMethod)) {
        score += 30;
        reasons.push('High-risk payment method');
      }

      // 새로운 결제 방법
      if (transaction.userId) {
        const paymentHistory = await this.getUserPaymentMethods(transaction.userId);
        if (!paymentHistory.includes(transaction.paymentMethod)) {
          score += 20;
          reasons.push('New payment method for user');
        }
      }

      return {
        score: Math.min(score, 100),
        reason: reasons.length > 0 ? reasons.join('; ') : 'Payment method analysis passed'
      };

    } catch (error) {
      logger.warn('Payment method analysis failed:', error);
      return { score: 15, reason: 'Payment method analysis inconclusive' };
    }
  }

  /**
   * 가중 점수 계산
   */
  private calculateWeightedScore(scores: Array<{ score: number; reason: string }>): number {
    const weights = {
      ip: 0.2,
      behavior: 0.25,
      transaction: 0.2,
      velocity: 0.15,
      device: 0.1,
      geo: 0.05,
      payment: 0.05
    };

    const weightValues = Object.values(weights);
    let weightedSum = 0;

    scores.forEach((scoreData, index) => {
      const weight = weightValues[index] || 0.1;
      weightedSum += scoreData.score * weight;
    });

    return Math.min(weightedSum, 100);
  }

  /**
   * 위험도 레벨 결정
   */
  private getRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= this.RISK_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (score >= this.RISK_THRESHOLDS.HIGH) return 'HIGH';
    if (score >= this.RISK_THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendations(level: string, reasons: string[]): string[] {
    const recommendations: string[] = [];

    switch (level) {
      case 'CRITICAL':
        recommendations.push('Block transaction immediately');
        recommendations.push('Flag account for manual review');
        recommendations.push('Require additional verification');
        break;
      case 'HIGH':
        recommendations.push('Hold transaction for manual review');
        recommendations.push('Require additional authentication');
        recommendations.push('Contact customer for verification');
        break;
      case 'MEDIUM':
        recommendations.push('Apply additional monitoring');
        recommendations.push('Consider step-up authentication');
        break;
      case 'LOW':
        recommendations.push('Process normally with standard monitoring');
        break;
    }

    // 특정 이유에 따른 맞춤 권장사항
    if (reasons.some(r => r.includes('VPN'))) {
      recommendations.push('Request identity verification due to VPN usage');
    }
    
    if (reasons.some(r => r.includes('new country'))) {
      recommendations.push('Send location confirmation alert to user');
    }

    return recommendations;
  }

  /**
   * 고위험 거래 알림
   */
  private async alertHighRiskTransaction(transaction: TransactionData, fraudScore: FraudScore): Promise<void> {
    try {
      // 관리자 알림 (실제 구현시 이메일/슬랙 등)
      logger.warn(`HIGH RISK TRANSACTION DETECTED: ${JSON.stringify({
        userId: transaction.userId,
        amount: transaction.amount,
        score: fraudScore.score,
        level: fraudScore.level,
        reasons: fraudScore.reasons
      })}`);

      // 실시간 알림 시스템에 전송
      // await notificationService.sendAlert('HIGH_RISK_TRANSACTION', fraudScore);

    } catch (error) {
      logger.error('Failed to send fraud alert:', error);
    }
  }

  // === 헬퍼 메서드들 ===

  private async isIPBlacklisted(ip: string): Promise<boolean> {
    // IP 블랙리스트 확인 로직
    return false;
  }

  private async detectVPNorProxy(ip: string): Promise<boolean> {
    // VPN/프록시 탐지 로직
    return false;
  }

  private async getIPGeolocation(ip: string): Promise<any> {
    // IP 지리적 위치 조회
    return { country: 'KR', city: 'Seoul', lat: 37.5665, lng: 126.9780 };
  }

  private isHighRiskCountry(country: string): boolean {
    const highRiskCountries = ['XX', 'YY']; // 실제 고위험 국가 코드
    return highRiskCountries.includes(country);
  }

  private async getIPReputation(ip: string): Promise<number> {
    // IP 평판 점수 조회
    return 20;
  }

  private async getUserBehaviorPattern(userId: string): Promise<UserBehaviorPattern | null> {
    // 사용자 행동 패턴 조회
    return null;
  }

  private compareAddresses(billing: any, shipping: any): number {
    // 주소 비교 로직
    return 0;
  }

  private async getRecentTransactionsByIP(ip: string, since: Date): Promise<any[]> {
    // IP별 최근 거래 조회
    return [];
  }

  private async getRecentTransactionsByUser(userId: string, since: Date): Promise<any[]> {
    // 사용자별 최근 거래 조회
    return [];
  }

  private async getRecentTransactionsByPaymentMethod(method: string, since: Date): Promise<any[]> {
    // 결제방법별 최근 거래 조회
    return [];
  }

  private detectBot(userAgent: string): boolean {
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper'];
    return botPatterns.some(pattern => userAgent.toLowerCase().includes(pattern));
  }

  private isOutdatedBrowser(userAgent: string): boolean {
    // 구버전 브라우저 탐지 로직
    return false;
  }

  private async getUserLocationHistory(userId: string): Promise<any[]> {
    // 사용자 위치 히스토리 조회
    return [];
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // 두 지점 간 거리 계산 (Haversine formula)
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async getUserPaymentMethods(userId: string): Promise<string[]> {
    // 사용자 결제방법 히스토리 조회
    return [];
  }
}

export const fraudDetectionService = new FraudDetectionService();