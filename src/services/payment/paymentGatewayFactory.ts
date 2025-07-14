import { PaymentGateway } from './paymentGateway'
import { TossPaymentsGateway } from './gateways/tossPaymentsGateway'
import { InicisGateway } from './gateways/inicisGateway'
import { KCPGateway } from './gateways/kcpGateway'
import { StripeGateway } from './gateways/stripeGateway'
import { PayPalGateway } from './gateways/paypalGateway'
import { AppError } from '../../middleware/error'

export class PaymentGatewayFactory {
  private static gateways: Map<string, PaymentGateway> = new Map()

  static {
    // Initialize gateways based on configuration
    this.registerGateway('TOSS_PAYMENTS', new TossPaymentsGateway({
      secretKey: process.env['TOSS_PAYMENTS_SECRET_KEY'] || '',
      clientKey: process.env['TOSS_PAYMENTS_CLIENT_KEY'] || '',
      testMode: process.env['NODE_ENV'] !== 'production',
    }))

    this.registerGateway('INICIS', new InicisGateway({
      mid: process.env['INICIS_MID'] || '',
      signKey: process.env['INICIS_SIGN_KEY'] || '',
      apiUrl: process.env['INICIS_API_URL'] || '',
      testMode: process.env['NODE_ENV'] !== 'production',
    }))

    this.registerGateway('KCP', new KCPGateway({
      siteCd: process.env['KCP_SITE_CODE'] || '',
      siteKey: process.env['KCP_SITE_KEY'] || '',
      apiUrl: process.env['KCP_API_URL'] || 'https://testpay.kcp.co.kr',
      testMode: process.env['NODE_ENV'] !== 'production',
    }))

    this.registerGateway('STRIPE', new StripeGateway({
      secretKey: process.env['STRIPE_SECRET_KEY'] || '',
      publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'] || '',
      webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] || '',
      testMode: process.env['NODE_ENV'] !== 'production',
    }))

    this.registerGateway('PAYPAL', new PayPalGateway({
      clientId: process.env['PAYPAL_CLIENT_ID'] || '',
      clientSecret: process.env['PAYPAL_CLIENT_SECRET'] || '',
      mode: process.env['NODE_ENV'] === 'production' ? 'live' : 'sandbox',
    }))
  }

  static registerGateway(name: string, gateway: PaymentGateway): void {
    this.gateways.set(name, gateway)
  }

  static getGateway(name: string): PaymentGateway {
    const gateway = this.gateways.get(name)
    
    if (!gateway) {
      throw new AppError(`Payment gateway ${name} not found`, 400)
    }

    return gateway
  }

  static getSupportedGateways(): string[] {
    return Array.from(this.gateways.keys())
  }

  static isGatewaySupported(name: string): boolean {
    return this.gateways.has(name)
  }
}