/**
 * Shipping Module Service
 * Business logic for shipping operations and Korean provider integrations
 */

import { inject, injectable } from '../../core/di/decorators';
import { ShippingRepository } from './shipping.repository';
import {
  Shipment,
  ShippingCalculationRequest,
  ShippingCalculationResponse,
  ShippingOption,
  KoreanShippingProvider,
  ShippingServiceType,
  ShippingStatus,
  TrackingResponse,
  TrackingEvent,
  ShippingEstimateRequest,
  ShippingEstimateResponse,
  KoreanAddress,
  InternationalAddress,
  ShippingRate,
  ShippingZone,
  FreeShippingRule,
  ShippingProviderConfig,
  ReturnShipment,
  ShippingLabel,
  AddressValidationResponse,
  BulkShippingRequest,
  ShippingWebhookPayload,
  PackageSize
} from './shipping.types';
import { 
  ShipmentEntity, 
  ShipmentItemEntity,
  TrackingEventEntity,
  KoreanAddressEntity,
  InternationalAddressEntity
} from './shipping.entity';
import { LoggerService } from '../../core/services/logger.service';
import { CacheService } from '../../core/services/cache.service';
import { NotificationService } from '../notification/notification.service';
import { v4 as uuidv4 } from 'uuid';

@injectable()
export class ShippingService {
  private providerHandlers: Map<KoreanShippingProvider, IShippingProviderHandler>;

  constructor(
    @inject('ShippingRepository') private repository: ShippingRepository,
    @inject('LoggerService') private logger: LoggerService,
    @inject('CacheService') private cache: CacheService,
    @inject('NotificationService') private notificationService: NotificationService
  ) {
    this.initializeProviderHandlers();
  }

  private initializeProviderHandlers(): void {
    this.providerHandlers = new Map([
      [KoreanShippingProvider.CJ_LOGISTICS, new CJLogisticsHandler()],
      [KoreanShippingProvider.HANJIN, new HanjinHandler()],
      [KoreanShippingProvider.LOGEN, new LogenHandler()],
      [KoreanShippingProvider.KOREA_POST, new KoreaPostHandler()],
      [KoreanShippingProvider.LOTTE, new LotteHandler()],
      [KoreanShippingProvider.COUPANG_ROCKET, new CoupangRocketHandler()],
      [KoreanShippingProvider.DAWN_DELIVERY, new DawnDeliveryHandler()]
    ]);
  }

  /**
   * Calculate shipping options
   */
  async calculateShipping(request: ShippingCalculationRequest): Promise<ShippingCalculationResponse> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('calculation', request);
      const cachedResult = await this.cache.get<ShippingCalculationResponse>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Get applicable shipping zones
      const zone = await this.getShippingZone(request.toAddress);
      
      // Get applicable shipping rates
      const rates = await this.getApplicableRates(request, zone);
      
      // Calculate options for each rate
      const options: ShippingOption[] = [];
      for (const rate of rates) {
        const option = await this.calculateShippingOption(rate, request, zone);
        if (option) {
          options.push(option);
        }
      }

      // Check free shipping eligibility
      const orderTotal = this.calculateOrderTotal(request.items);
      const freeShippingRules = await this.repository.getApplicableFreeShippingRules(
        orderTotal,
        this.extractRegion(request.toAddress)
      );

      const response: ShippingCalculationResponse = {
        requestId: uuidv4(),
        options: options.sort((a, b) => a.price - b.price),
        recommendedOption: this.selectRecommendedOption(options),
        freeShippingAvailable: freeShippingRules.length > 0,
        freeShippingThreshold: freeShippingRules[0]?.minimumOrderAmount,
        calculatedAt: new Date()
      };

      // Cache the result
      await this.cache.set(cacheKey, response, 300); // 5 minutes

      return response;
    } catch (error) {
      this.logger.error('Failed to calculate shipping', error);
      throw error;
    }
  }

  /**
   * Create a new shipment
   */
  async createShipment(data: {
    orderId: string;
    customerId: string;
    fromAddress: KoreanAddress | InternationalAddress;
    toAddress: KoreanAddress | InternationalAddress;
    items: any[];
    provider: KoreanShippingProvider;
    serviceType: ShippingServiceType;
  }): Promise<Shipment> {
    try {
      // Save addresses if not already saved
      const fromAddressEntity = await this.saveAddress(data.fromAddress);
      const toAddressEntity = await this.saveAddress(data.toAddress);

      // Calculate package details
      const packageDetails = this.calculatePackageDetails(data.items);
      
      // Get shipping rate
      const rate = await this.getShippingRate(
        data.provider,
        data.serviceType,
        packageDetails,
        this.extractRegion(data.toAddress)
      );

      // Calculate pricing
      const pricing = this.calculatePricing(rate, packageDetails);

      // Generate tracking number
      const trackingNumber = await this.generateTrackingNumber(data.provider);

      // Create shipment entity
      const shipmentEntity = await this.repository.createShipment({
        orderId: data.orderId,
        customerId: data.customerId,
        provider: data.provider,
        serviceType: data.serviceType,
        trackingNumber,
        status: ShippingStatus.PENDING,
        fromAddressId: fromAddressEntity.id,
        fromAddressType: this.isKoreanAddress(data.fromAddress) ? 'korean' : 'international',
        toAddressId: toAddressEntity.id,
        toAddressType: this.isKoreanAddress(data.toAddress) ? 'korean' : 'international',
        packageWeight: packageDetails.weight,
        packageLength: packageDetails.dimensions?.length,
        packageWidth: packageDetails.dimensions?.width,
        packageHeight: packageDetails.dimensions?.height,
        packageCount: packageDetails.packageCount,
        packageSize: packageDetails.packageSize,
        basePrice: pricing.basePrice,
        additionalCharges: pricing.additionalCharges,
        insuranceAmount: pricing.insurance,
        totalPrice: pricing.totalPrice,
        estimatedDeliveryDate: this.calculateEstimatedDeliveryDate(rate),
        isReturn: false
      });

      // Create shipment items
      const shipmentItems = await this.createShipmentItems(shipmentEntity.id!, data.items);

      // Request shipping label from provider
      const label = await this.requestShippingLabel(shipmentEntity);

      // Create initial tracking event
      await this.createTrackingEvent({
        shipmentId: shipmentEntity.id!,
        trackingNumber,
        status: ShippingStatus.PENDING,
        location: this.formatAddress(data.fromAddress),
        description: 'Shipment created',
        eventTimestamp: new Date()
      });

      // Send notification
      await this.notificationService.sendNotification({
        userId: data.customerId,
        type: 'shipping',
        title: 'Shipment Created',
        message: `Your order has been prepared for shipping. Tracking number: ${trackingNumber}`,
        data: { shipmentId: shipmentEntity.id, trackingNumber }
      });

      return this.mapToShipment(shipmentEntity, shipmentItems, data.fromAddress, data.toAddress);
    } catch (error) {
      this.logger.error('Failed to create shipment', error);
      throw error;
    }
  }

  /**
   * Track shipment
   */
  async trackShipment(trackingNumber: string): Promise<TrackingResponse> {
    try {
      // Check cache first
      const cacheKey = `tracking:${trackingNumber}`;
      const cachedResult = await this.cache.get<TrackingResponse>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Get shipment from database
      const shipment = await this.repository.getShipmentByTrackingNumber(trackingNumber);
      if (!shipment) {
        throw new Error('Shipment not found');
      }

      // Get provider handler
      const handler = this.providerHandlers.get(shipment.provider);
      if (!handler) {
        throw new Error(`Provider ${shipment.provider} not supported`);
      }

      // Get tracking info from provider
      const providerTracking = await handler.track(trackingNumber);

      // Update tracking events in database
      for (const event of providerTracking.events) {
        await this.createTrackingEvent({
          shipmentId: shipment.id!,
          trackingNumber,
          status: event.status,
          location: event.location,
          description: event.description,
          eventTimestamp: event.timestamp,
          details: event.details
        });
      }

      // Update shipment status if changed
      if (providerTracking.currentStatus !== shipment.status) {
        await this.updateShipmentStatus(
          shipment.id!,
          providerTracking.currentStatus,
          providerTracking.actualDeliveryDate
        );
      }

      // Get all tracking events from database
      const trackingEvents = await this.repository.getTrackingEvents(trackingNumber);

      // Get addresses
      const fromAddress = await this.getAddress(shipment.fromAddressId, shipment.fromAddressType);
      const toAddress = await this.getAddress(shipment.toAddressId, shipment.toAddressType);

      // Get delivery proof if delivered
      const deliveryProof = shipment.status === ShippingStatus.DELIVERED
        ? await this.repository.getDeliveryProof(shipment.id!)
        : undefined;

      const response: TrackingResponse = {
        trackingNumber,
        currentStatus: providerTracking.currentStatus,
        provider: shipment.provider,
        shipmentDetails: {
          sender: fromAddress.receiverName,
          receiver: toAddress.receiverName,
          packageCount: shipment.packageCount,
          weight: shipment.packageWeight
        },
        events: trackingEvents.map(this.mapToTrackingEvent),
        estimatedDeliveryDate: shipment.estimatedDeliveryDate,
        actualDeliveryDate: shipment.actualDeliveryDate,
        deliveryProof: deliveryProof ? {
          signature: deliveryProof.signature,
          photoUrl: deliveryProof.photoUrl,
          receivedBy: deliveryProof.receivedBy,
          timestamp: deliveryProof.deliveredAt
        } : undefined
      };

      // Cache the result
      await this.cache.set(cacheKey, response, 60); // 1 minute

      return response;
    } catch (error) {
      this.logger.error('Failed to track shipment', error);
      throw error;
    }
  }

  /**
   * Update shipment status
   */
  async updateShipmentStatus(
    shipmentId: string,
    status: ShippingStatus,
    actualDeliveryDate?: Date
  ): Promise<Shipment> {
    try {
      const updatedShipment = await this.repository.updateShipmentStatus(
        shipmentId,
        status,
        actualDeliveryDate
      );

      // Create tracking event
      await this.createTrackingEvent({
        shipmentId,
        trackingNumber: updatedShipment.trackingNumber,
        status,
        location: 'System Update',
        description: `Status updated to ${status}`,
        eventTimestamp: new Date()
      });

      // Send notification
      await this.notificationService.sendNotification({
        userId: updatedShipment.customerId,
        type: 'shipping',
        title: 'Shipment Status Update',
        message: this.getStatusMessage(status, updatedShipment.trackingNumber),
        data: { shipmentId, trackingNumber: updatedShipment.trackingNumber, status }
      });

      // Get full shipment data
      const items = await this.repository.find({
        where: { shipmentId },
        table: 'shipment_items'
      });

      const fromAddress = await this.getAddress(
        updatedShipment.fromAddressId,
        updatedShipment.fromAddressType
      );
      const toAddress = await this.getAddress(
        updatedShipment.toAddressId,
        updatedShipment.toAddressType
      );

      return this.mapToShipment(updatedShipment, items, fromAddress, toAddress);
    } catch (error) {
      this.logger.error('Failed to update shipment status', error);
      throw error;
    }
  }

  /**
   * Get shipping providers
   */
  async getShippingProviders(): Promise<ShippingProviderConfig[]> {
    try {
      const configs = await this.repository.getAllProviderConfigs();
      return configs.map(config => ({
        provider: config.provider,
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        accountNumber: config.accountNumber,
        environment: config.environment,
        webhookUrl: config.webhookUrl,
        supportedServices: config.supportedServices,
        features: config.features
      }));
    } catch (error) {
      this.logger.error('Failed to get shipping providers', error);
      throw error;
    }
  }

  /**
   * Get shipping zones
   */
  async getShippingZones(region?: string): Promise<ShippingZone[]> {
    try {
      const zones = await this.repository.getShippingZones(region);
      return zones;
    } catch (error) {
      this.logger.error('Failed to get shipping zones', error);
      throw error;
    }
  }

  /**
   * Estimate shipping cost
   */
  async estimateShipping(request: ShippingEstimateRequest): Promise<ShippingEstimateResponse> {
    try {
      // Calculate total weight
      const totalWeight = request.items.reduce(
        (sum, item) => sum + item.weight * item.quantity,
        0
      );

      // Get zone for the region
      const zones = await this.repository.getShippingZones(request.region);
      const zone = zones[0] || this.getDefaultZone();

      // Calculate estimates for different service types
      const standardRate = await this.getAverageRate(
        ShippingServiceType.STANDARD,
        totalWeight,
        zone
      );
      const expressRate = await this.getAverageRate(
        ShippingServiceType.EXPRESS,
        totalWeight,
        zone
      );
      const dawnRate = await this.getAverageRate(
        ShippingServiceType.DAWN,
        totalWeight,
        zone
      );

      return {
        standardShipping: {
          price: this.calculatePrice(standardRate, totalWeight),
          estimatedDays: standardRate?.estimatedMinDays || 3
        },
        expressShipping: expressRate ? {
          price: this.calculatePrice(expressRate, totalWeight),
          estimatedDays: expressRate.estimatedMinDays
        } : undefined,
        dawnDelivery: dawnRate ? {
          price: this.calculatePrice(dawnRate, totalWeight),
          cutoffTime: dawnRate.cutoffTime || '23:00',
          available: true
        } : undefined
      };
    } catch (error) {
      this.logger.error('Failed to estimate shipping', error);
      throw error;
    }
  }

  /**
   * Validate Korean address
   */
  async validateKoreanAddress(address: KoreanAddress): Promise<AddressValidationResponse> {
    try {
      // Basic validation
      const errors: string[] = [];

      // Validate postal code (5 digits)
      if (!/^\d{5}$/.test(address.postalCode)) {
        errors.push('Invalid postal code format. Must be 5 digits.');
      }

      // Validate required fields
      if (!address.sido || address.sido.trim().length === 0) {
        errors.push('Province/City (시/도) is required.');
      }
      if (!address.sigungu || address.sigungu.trim().length === 0) {
        errors.push('City/County/District (시/군/구) is required.');
      }
      if (!address.eupmyeondong || address.eupmyeondong.trim().length === 0) {
        errors.push('Dong/Eup/Myeon (동/읍/면) is required.');
      }

      // Validate phone number format
      if (!/^(01[016789]{1}|02|0[3-9]{1}[0-9]{1})-?[0-9]{3,4}-?[0-9]{4}$/.test(address.receiverPhone)) {
        errors.push('Invalid Korean phone number format.');
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          errors
        };
      }

      // Normalize address
      const normalizedAddress: KoreanAddress = {
        ...address,
        postalCode: address.postalCode.replace(/[^0-9]/g, ''),
        receiverPhone: address.receiverPhone.replace(/[^0-9]/g, '')
      };

      return {
        isValid: true,
        normalizedAddress
      };
    } catch (error) {
      this.logger.error('Failed to validate Korean address', error);
      throw error;
    }
  }

  /**
   * Create return shipment
   */
  async createReturnShipment(originalShipmentId: string, reason: string): Promise<ReturnShipment> {
    try {
      // Get original shipment
      const originalShipment = await this.repository.findById(originalShipmentId);
      if (!originalShipment) {
        throw new Error('Original shipment not found');
      }

      // Create return shipment with swapped addresses
      const returnShipment = await this.repository.createShipment({
        orderId: originalShipment.orderId,
        customerId: originalShipment.customerId,
        provider: originalShipment.provider,
        serviceType: originalShipment.serviceType,
        trackingNumber: await this.generateTrackingNumber(originalShipment.provider),
        status: ShippingStatus.PENDING,
        fromAddressId: originalShipment.toAddressId,
        fromAddressType: originalShipment.toAddressType,
        toAddressId: originalShipment.fromAddressId,
        toAddressType: originalShipment.fromAddressType,
        packageWeight: originalShipment.packageWeight,
        packageLength: originalShipment.packageLength,
        packageWidth: originalShipment.packageWidth,
        packageHeight: originalShipment.packageHeight,
        packageCount: originalShipment.packageCount,
        packageSize: originalShipment.packageSize,
        basePrice: 0, // Return shipping might be free
        totalPrice: 0,
        estimatedDeliveryDate: this.calculateEstimatedDeliveryDate(),
        isReturn: true,
        originalShipmentId,
        metadata: { returnReason: reason }
      });

      // Update original shipment with return ID
      await this.repository.update(originalShipmentId, {
        returnShipmentId: returnShipment.id
      });

      // Get addresses
      const fromAddress = await this.getAddress(
        returnShipment.fromAddressId,
        returnShipment.fromAddressType
      );
      const toAddress = await this.getAddress(
        returnShipment.toAddressId,
        returnShipment.toAddressType
      );

      // Get items
      const items = await this.repository.find({
        where: { shipmentId: originalShipmentId },
        table: 'shipment_items'
      });

      return {
        id: returnShipment.id!,
        originalShipmentId,
        returnReason: reason,
        status: returnShipment.status,
        trackingNumber: returnShipment.trackingNumber,
        provider: returnShipment.provider,
        fromAddress,
        toAddress,
        items: items.map(this.mapToShippingItem),
        labelUrl: returnShipment.labelUrl,
        createdAt: returnShipment.createdAt!
      };
    } catch (error) {
      this.logger.error('Failed to create return shipment', error);
      throw error;
    }
  }

  /**
   * Handle webhook from shipping provider
   */
  async handleWebhook(payload: ShippingWebhookPayload): Promise<void> {
    try {
      this.logger.info('Received shipping webhook', payload);

      switch (payload.event) {
        case 'status_update':
          await this.handleStatusUpdate(payload);
          break;
        case 'delivery_completed':
          await this.handleDeliveryCompleted(payload);
          break;
        case 'delivery_failed':
          await this.handleDeliveryFailed(payload);
          break;
        case 'return_requested':
          await this.handleReturnRequested(payload);
          break;
        default:
          this.logger.warn('Unknown webhook event', payload.event);
      }
    } catch (error) {
      this.logger.error('Failed to handle webhook', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async saveAddress(address: KoreanAddress | InternationalAddress): Promise<any> {
    if (this.isKoreanAddress(address)) {
      return this.repository.createKoreanAddress(address as any);
    } else {
      return this.repository.createInternationalAddress(address as any);
    }
  }

  private isKoreanAddress(address: any): address is KoreanAddress {
    return 'sido' in address && 'sigungu' in address;
  }

  private calculatePackageDetails(items: any[]): any {
    const totalWeight = items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
    const totalVolume = items.reduce((sum, item) => {
      if (item.dimensions) {
        return sum + (item.dimensions.length * item.dimensions.width * item.dimensions.height) * item.quantity;
      }
      return sum;
    }, 0);

    return {
      weight: totalWeight,
      dimensions: this.estimateDimensions(totalVolume),
      packageCount: 1, // Simplified - in reality would calculate based on volume
      packageSize: this.determinePackageSize(totalWeight, totalVolume)
    };
  }

  private determinePackageSize(weight: number, volume: number): PackageSize {
    if (weight <= 1 && volume <= 1000) return PackageSize.SMALL;
    if (weight <= 5 && volume <= 8000) return PackageSize.MEDIUM;
    if (weight <= 15 && volume <= 27000) return PackageSize.LARGE;
    if (weight <= 30 && volume <= 64000) return PackageSize.EXTRA_LARGE;
    return PackageSize.CUSTOM;
  }

  private estimateDimensions(volume: number): any {
    // Simplified cube root estimation
    const side = Math.cbrt(volume);
    return {
      length: Math.ceil(side),
      width: Math.ceil(side),
      height: Math.ceil(side)
    };
  }

  private calculatePricing(rate: any, packageDetails: any): any {
    const basePrice = rate.basePrice;
    const weightCharge = rate.pricePerKg * packageDetails.weight;
    const additionalCharges = 0; // Could include fuel surcharge, etc.
    const insurance = 0; // Optional insurance

    return {
      basePrice,
      additionalCharges,
      insurance,
      totalPrice: basePrice + weightCharge + additionalCharges + insurance
    };
  }

  private async generateTrackingNumber(provider: KoreanShippingProvider): Promise<string> {
    const prefix = this.getProviderPrefix(provider);
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  private getProviderPrefix(provider: KoreanShippingProvider): string {
    const prefixes: Record<KoreanShippingProvider, string> = {
      [KoreanShippingProvider.CJ_LOGISTICS]: 'CJ',
      [KoreanShippingProvider.HANJIN]: 'HJ',
      [KoreanShippingProvider.LOGEN]: 'LG',
      [KoreanShippingProvider.KOREA_POST]: 'KP',
      [KoreanShippingProvider.LOTTE]: 'LT',
      [KoreanShippingProvider.COUPANG_ROCKET]: 'CR',
      [KoreanShippingProvider.DAWN_DELIVERY]: 'DD'
    };
    return prefixes[provider] || 'XX';
  }

  private calculateEstimatedDeliveryDate(rate?: any): Date {
    const days = rate?.estimatedMinDays || 3;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  private generateCacheKey(type: string, data: any): string {
    return `shipping:${type}:${JSON.stringify(data)}`;
  }

  private extractRegion(address: KoreanAddress | InternationalAddress): string {
    if (this.isKoreanAddress(address)) {
      return (address as KoreanAddress).sido;
    }
    return (address as InternationalAddress).country;
  }

  private formatAddress(address: KoreanAddress | InternationalAddress): string {
    if (this.isKoreanAddress(address)) {
      const addr = address as KoreanAddress;
      return `${addr.sido} ${addr.sigungu} ${addr.eupmyeondong}`;
    }
    const addr = address as InternationalAddress;
    return `${addr.city}, ${addr.country}`;
  }

  private getStatusMessage(status: ShippingStatus, trackingNumber: string): string {
    const messages: Record<ShippingStatus, string> = {
      [ShippingStatus.PENDING]: `Your shipment ${trackingNumber} is being prepared`,
      [ShippingStatus.READY_FOR_PICKUP]: `Your shipment ${trackingNumber} is ready for pickup`,
      [ShippingStatus.PICKED_UP]: `Your shipment ${trackingNumber} has been picked up`,
      [ShippingStatus.IN_TRANSIT]: `Your shipment ${trackingNumber} is in transit`,
      [ShippingStatus.OUT_FOR_DELIVERY]: `Your shipment ${trackingNumber} is out for delivery`,
      [ShippingStatus.DELIVERED]: `Your shipment ${trackingNumber} has been delivered`,
      [ShippingStatus.FAILED]: `Delivery failed for shipment ${trackingNumber}`,
      [ShippingStatus.RETURNED]: `Your shipment ${trackingNumber} has been returned`,
      [ShippingStatus.CANCELLED]: `Your shipment ${trackingNumber} has been cancelled`
    };
    return messages[status];
  }

  private async getShippingZone(address: KoreanAddress | InternationalAddress): Promise<any> {
    const region = this.extractRegion(address);
    const zones = await this.repository.getShippingZones(region);
    return zones[0] || this.getDefaultZone();
  }

  private getDefaultZone(): any {
    return {
      id: 'default',
      name: 'Default Zone',
      code: 'DEFAULT',
      regions: [],
      baseShippingRate: 3000,
      additionalRatePerKg: 500,
      estimatedDays: 3,
      isActive: true
    };
  }

  private async getApplicableRates(request: ShippingCalculationRequest, zone: any): Promise<any[]> {
    const weight = this.calculateTotalWeight(request.items);
    const region = this.extractRegion(request.toAddress);

    return this.repository.getShippingRates({
      region,
      weight,
      serviceType: request.serviceType
    });
  }

  private calculateTotalWeight(items: any[]): number {
    return items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  }

  private calculateOrderTotal(items: any[]): number {
    return items.reduce((sum, item) => sum + item.value * item.quantity, 0);
  }

  private async calculateShippingOption(rate: any, request: ShippingCalculationRequest, zone: any): Promise<ShippingOption | null> {
    const weight = this.calculateTotalWeight(request.items);
    const price = this.calculatePrice(rate, weight);

    return {
      id: rate.id,
      provider: rate.provider,
      providerName: this.getProviderName(rate.provider),
      serviceType: rate.serviceType,
      serviceName: this.getServiceName(rate.serviceType),
      price,
      estimatedDeliveryDate: this.calculateEstimatedDeliveryDate(rate),
      cutoffTime: rate.cutoffTime,
      trackingAvailable: true,
      insuranceAvailable: true,
      insurancePrice: price * 0.01, // 1% of shipping cost
      freeShippingThreshold: 50000 // 50,000 KRW
    };
  }

  private calculatePrice(rate: any, weight: number): number {
    if (!rate) return 0;
    return rate.basePrice + (rate.pricePerKg * weight);
  }

  private selectRecommendedOption(options: ShippingOption[]): ShippingOption | undefined {
    // Recommend the option with best value (price vs delivery time)
    return options.find(opt => opt.serviceType === ShippingServiceType.STANDARD) || options[0];
  }

  private getProviderName(provider: KoreanShippingProvider): string {
    const names: Record<KoreanShippingProvider, string> = {
      [KoreanShippingProvider.CJ_LOGISTICS]: 'CJ대한통운',
      [KoreanShippingProvider.HANJIN]: '한진택배',
      [KoreanShippingProvider.LOGEN]: '로젠택배',
      [KoreanShippingProvider.KOREA_POST]: '우체국택배',
      [KoreanShippingProvider.LOTTE]: '롯데택배',
      [KoreanShippingProvider.COUPANG_ROCKET]: '쿠팡 로켓배송',
      [KoreanShippingProvider.DAWN_DELIVERY]: '새벽배송'
    };
    return names[provider];
  }

  private getServiceName(serviceType: ShippingServiceType): string {
    const names: Record<ShippingServiceType, string> = {
      [ShippingServiceType.STANDARD]: '일반배송',
      [ShippingServiceType.EXPRESS]: '익일배송',
      [ShippingServiceType.DAWN]: '새벽배송',
      [ShippingServiceType.NEXT_DAY]: '익일배송',
      [ShippingServiceType.SAME_DAY]: '당일배송'
    };
    return names[serviceType];
  }

  private async getShippingRate(
    provider: KoreanShippingProvider,
    serviceType: ShippingServiceType,
    packageDetails: any,
    region: string
  ): Promise<any> {
    const rates = await this.repository.getShippingRates({
      provider,
      serviceType,
      region,
      weight: packageDetails.weight
    });
    return rates[0];
  }

  private async createShipmentItems(shipmentId: string, items: any[]): Promise<ShipmentItemEntity[]> {
    const shipmentItems = items.map(item => ({
      shipmentId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      weight: item.weight,
      length: item.dimensions?.length,
      width: item.dimensions?.width,
      height: item.dimensions?.height,
      value: item.value,
      isFragile: item.isFragile || false,
      requiresColdChain: item.requiresColdChain || false,
      specialInstructions: item.specialInstructions
    }));

    return this.repository.createShipmentItems(shipmentItems);
  }

  private async requestShippingLabel(shipment: ShipmentEntity): Promise<ShippingLabel> {
    const handler = this.providerHandlers.get(shipment.provider);
    if (!handler) {
      throw new Error(`Provider ${shipment.provider} not supported`);
    }

    const label = await handler.generateLabel(shipment);
    
    return this.repository.createShippingLabel({
      shipmentId: shipment.id!,
      trackingNumber: shipment.trackingNumber,
      provider: shipment.provider,
      labelFormat: label.format,
      labelUrl: label.url,
      labelData: label.data,
      expiresAt: label.expiresAt
    });
  }

  private async createTrackingEvent(event: Omit<TrackingEventEntity, 'id' | 'createdAt'>): Promise<void> {
    await this.repository.createTrackingEvent(event);
  }

  private async getAddress(addressId: string, addressType: string): Promise<any> {
    if (addressType === 'korean') {
      return this.repository.getKoreanAddress(addressId);
    } else {
      return this.repository.getInternationalAddress(addressId);
    }
  }

  private mapToShipment(
    entity: ShipmentEntity,
    items: any[],
    fromAddress: any,
    toAddress: any
  ): Shipment {
    return {
      id: entity.id!,
      orderId: entity.orderId,
      customerId: entity.customerId,
      provider: entity.provider,
      serviceType: entity.serviceType,
      trackingNumber: entity.trackingNumber,
      status: entity.status,
      fromAddress,
      toAddress,
      items: items.map(this.mapToShippingItem),
      packageDetails: {
        weight: entity.packageWeight,
        dimensions: entity.packageLength ? {
          length: entity.packageLength,
          width: entity.packageWidth!,
          height: entity.packageHeight!
        } : undefined,
        packageCount: entity.packageCount
      },
      pricing: {
        basePrice: entity.basePrice,
        additionalCharges: entity.additionalCharges,
        insurance: entity.insuranceAmount,
        totalPrice: entity.totalPrice
      },
      dates: {
        createdAt: entity.createdAt!,
        shippedAt: entity.shippedAt,
        estimatedDeliveryDate: entity.estimatedDeliveryDate,
        actualDeliveryDate: entity.actualDeliveryDate
      },
      labelUrl: entity.labelUrl,
      invoiceUrl: entity.invoiceUrl,
      returnShipmentId: entity.returnShipmentId,
      metadata: entity.metadata
    };
  }

  private mapToShippingItem(item: any): any {
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      weight: item.weight,
      dimensions: item.length ? {
        length: item.length,
        width: item.width,
        height: item.height
      } : undefined,
      value: item.value,
      isFragile: item.isFragile,
      requiresColdChain: item.requiresColdChain,
      specialInstructions: item.specialInstructions
    };
  }

  private mapToTrackingEvent(event: TrackingEventEntity): TrackingEvent {
    return {
      id: event.id!,
      shipmentId: event.shipmentId,
      trackingNumber: event.trackingNumber,
      status: event.status,
      location: event.location,
      description: event.description,
      timestamp: event.eventTimestamp,
      details: event.details
    };
  }

  private async getAverageRate(serviceType: ShippingServiceType, weight: number, zone: any): Promise<any> {
    const rates = await this.repository.getShippingRates({
      serviceType,
      weight
    });
    return rates[0];
  }

  private async handleStatusUpdate(payload: ShippingWebhookPayload): Promise<void> {
    const status = payload.data.status as ShippingStatus;
    await this.updateShipmentStatus(payload.shipmentId, status);
  }

  private async handleDeliveryCompleted(payload: ShippingWebhookPayload): Promise<void> {
    await this.updateShipmentStatus(
      payload.shipmentId,
      ShippingStatus.DELIVERED,
      new Date()
    );

    // Save delivery proof if provided
    if (payload.data.proof) {
      await this.repository.createDeliveryProof({
        shipmentId: payload.shipmentId,
        trackingNumber: payload.trackingNumber,
        deliveredAt: new Date(),
        signature: payload.data.proof.signature,
        signatureUrl: payload.data.proof.signatureUrl,
        photoUrl: payload.data.proof.photoUrl,
        receivedBy: payload.data.proof.receivedBy,
        deliveryLocation: payload.data.proof.location
      });
    }
  }

  private async handleDeliveryFailed(payload: ShippingWebhookPayload): Promise<void> {
    await this.updateShipmentStatus(payload.shipmentId, ShippingStatus.FAILED);
  }

  private async handleReturnRequested(payload: ShippingWebhookPayload): Promise<void> {
    await this.createReturnShipment(
      payload.shipmentId,
      payload.data.reason || 'Customer requested return'
    );
  }

  /**
   * Additional public methods for controller
   */
  async getShippingOptions(filters: {
    region?: string;
    weight?: number;
    serviceType?: string;
  }): Promise<any> {
    try {
      const rates = await this.repository.getShippingRates({
        region: filters.region,
        weight: filters.weight,
        serviceType: filters.serviceType as ShippingServiceType
      });

      return rates.map(rate => ({
        id: rate.id,
        provider: rate.provider,
        providerName: this.getProviderName(rate.provider),
        serviceType: rate.serviceType,
        serviceName: this.getServiceName(rate.serviceType),
        basePrice: rate.basePrice,
        pricePerKg: rate.pricePerKg,
        estimatedDays: `${rate.estimatedMinDays}-${rate.estimatedMaxDays}`,
        availableRegions: rate.availableRegions,
        cutoffTime: rate.cutoffTime
      }));
    } catch (error) {
      this.logger.error('Failed to get shipping options', error);
      throw error;
    }
  }

  async getShipmentById(shipmentId: string): Promise<Shipment | null> {
    try {
      const shipment = await this.repository.findById(shipmentId);
      if (!shipment) return null;

      const items = await this.repository.find({
        where: { shipmentId },
        table: 'shipment_items'
      });

      const fromAddress = await this.getAddress(
        shipment.fromAddressId,
        shipment.fromAddressType
      );
      const toAddress = await this.getAddress(
        shipment.toAddressId,
        shipment.toAddressType
      );

      return this.mapToShipment(shipment, items, fromAddress, toAddress);
    } catch (error) {
      this.logger.error('Failed to get shipment by ID', error);
      throw error;
    }
  }

  async getShipmentsByOrderId(orderId: string): Promise<Shipment[]> {
    try {
      const shipments = await this.repository.getShipmentsByOrderId(orderId);
      const results: Shipment[] = [];

      for (const shipment of shipments) {
        const items = await this.repository.find({
          where: { shipmentId: shipment.id },
          table: 'shipment_items'
        });

        const fromAddress = await this.getAddress(
          shipment.fromAddressId,
          shipment.fromAddressType
        );
        const toAddress = await this.getAddress(
          shipment.toAddressId,
          shipment.toAddressType
        );

        results.push(this.mapToShipment(shipment, items, fromAddress, toAddress));
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get shipments by order ID', error);
      throw error;
    }
  }

  async getShippingLabel(shipmentId: string): Promise<ShippingLabel | null> {
    try {
      return await this.repository.getShippingLabel(shipmentId);
    } catch (error) {
      this.logger.error('Failed to get shipping label', error);
      throw error;
    }
  }

  async createBulkShipments(request: BulkShippingRequest): Promise<any[]> {
    const results: any[] = [];

    for (const shipmentData of request.shipments) {
      try {
        const shipment = await this.createShipment({
          orderId: shipmentData.orderId,
          customerId: '', // Should be provided in actual implementation
          fromAddress: await this.getDefaultFromAddress(),
          toAddress: shipmentData.toAddress,
          items: shipmentData.items,
          provider: request.provider,
          serviceType: shipmentData.serviceType
        });

        results.push({
          orderId: shipmentData.orderId,
          success: true,
          shipment
        });
      } catch (error) {
        results.push({
          orderId: shipmentData.orderId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  async getCustomerAddresses(customerId: string): Promise<any> {
    try {
      return await this.repository.getCustomerAddresses(customerId);
    } catch (error) {
      this.logger.error('Failed to get customer addresses', error);
      throw error;
    }
  }

  async saveCustomerAddress(address: KoreanAddress & { customerId: string }): Promise<any> {
    try {
      // Validate address first
      const validation = await this.validateKoreanAddress(address);
      if (!validation.isValid) {
        throw new Error(`Address validation failed: ${validation.errors?.join(', ')}`);
      }

      // If setting as default, unset other default addresses
      if (address.isDefault) {
        await this.repository.update(
          { customerId: address.customerId, isDefault: true },
          { isDefault: false },
          'korean_addresses'
        );
      }

      return await this.repository.createKoreanAddress({
        customerId: address.customerId,
        postalCode: address.postalCode,
        sido: address.sido,
        sigungu: address.sigungu,
        eupmyeondong: address.eupmyeondong,
        streetName: address.streetName,
        streetNumber: address.streetNumber,
        buildingName: address.buildingName,
        apartmentName: address.apartmentName,
        dongNumber: address.dongNumber,
        hoNumber: address.hoNumber,
        detailAddress: address.detailAddress,
        receiverName: address.receiverName,
        receiverPhone: address.receiverPhone,
        deliveryInstructions: address.deliveryInstructions,
        isDefault: address.isDefault || false
      });
    } catch (error) {
      this.logger.error('Failed to save customer address', error);
      throw error;
    }
  }

  async getShippingStats(startDate: Date, endDate: Date): Promise<any> {
    try {
      return await this.repository.getShippingStatsByDateRange(startDate, endDate);
    } catch (error) {
      this.logger.error('Failed to get shipping stats', error);
      throw error;
    }
  }

  async getShippingVolumeByRegion(startDate: Date, endDate: Date): Promise<any> {
    try {
      return await this.repository.getShippingVolumeByRegion(startDate, endDate);
    } catch (error) {
      this.logger.error('Failed to get shipping volume by region', error);
      throw error;
    }
  }

  private async getDefaultFromAddress(): Promise<KoreanAddress> {
    // This would typically come from configuration
    return {
      postalCode: '06164',
      sido: '서울특별시',
      sigungu: '강남구',
      eupmyeondong: '삼성동',
      streetName: '테헤란로',
      streetNumber: '123',
      buildingName: '커머스센터',
      receiverName: '발송센터',
      receiverPhone: '02-1234-5678'
    };
  }
}

/**
 * Provider handler interfaces and implementations
 */
interface IShippingProviderHandler {
  track(trackingNumber: string): Promise<any>;
  generateLabel(shipment: any): Promise<any>;
  calculateRate(request: any): Promise<any>;
}

class CJLogisticsHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    // Mock implementation - would integrate with CJ Logistics API
    return {
      currentStatus: ShippingStatus.IN_TRANSIT,
      events: [{
        status: ShippingStatus.IN_TRANSIT,
        location: 'Seoul Distribution Center',
        description: 'Package in transit',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://cj-logistics.com/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 3000,
      estimatedDays: 2
    };
  }
}

class HanjinHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    return {
      currentStatus: ShippingStatus.IN_TRANSIT,
      events: [{
        status: ShippingStatus.IN_TRANSIT,
        location: 'Incheon Hub',
        description: 'Package processed',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://hanjin.com/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 3500,
      estimatedDays: 3
    };
  }
}

class LogenHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    return {
      currentStatus: ShippingStatus.PICKED_UP,
      events: [{
        status: ShippingStatus.PICKED_UP,
        location: 'Pickup Location',
        description: 'Package picked up',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://logen.com/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 2800,
      estimatedDays: 3
    };
  }
}

class KoreaPostHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    return {
      currentStatus: ShippingStatus.IN_TRANSIT,
      events: [{
        status: ShippingStatus.IN_TRANSIT,
        location: 'Local Post Office',
        description: 'Package received',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://koreapost.kr/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 2500,
      estimatedDays: 4
    };
  }
}

class LotteHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    return {
      currentStatus: ShippingStatus.IN_TRANSIT,
      events: [{
        status: ShippingStatus.IN_TRANSIT,
        location: 'Lotte Distribution Center',
        description: 'Package sorted',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://lotte.com/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 3200,
      estimatedDays: 2
    };
  }
}

class CoupangRocketHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    return {
      currentStatus: ShippingStatus.OUT_FOR_DELIVERY,
      events: [{
        status: ShippingStatus.OUT_FOR_DELIVERY,
        location: 'Local Delivery Hub',
        description: 'Out for delivery',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://coupang.com/rocket/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 0, // Free for Rocket Delivery
      estimatedDays: 1
    };
  }
}

class DawnDeliveryHandler implements IShippingProviderHandler {
  async track(trackingNumber: string): Promise<any> {
    return {
      currentStatus: ShippingStatus.IN_TRANSIT,
      events: [{
        status: ShippingStatus.IN_TRANSIT,
        location: 'Dawn Delivery Hub',
        description: 'Prepared for dawn delivery',
        timestamp: new Date()
      }]
    };
  }

  async generateLabel(shipment: any): Promise<any> {
    return {
      format: 'PDF',
      url: `https://dawn-delivery.kr/labels/${shipment.trackingNumber}.pdf`,
      data: null,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
    };
  }

  async calculateRate(request: any): Promise<any> {
    return {
      price: 4500,
      estimatedDays: 1,
      cutoffTime: '23:00'
    };
  }
}