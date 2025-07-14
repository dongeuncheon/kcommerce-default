/**
 * Shipping Module Repository
 * Database operations for shipping system
 */

import { BaseRepository } from '../../core/repository/base.repository';
import { DatabaseAdapter } from '../../adapters/database.adapter';
import {
  ShipmentEntity,
  ShipmentItemEntity,
  TrackingEventEntity,
  ShippingRateEntity,
  ShippingZoneEntity,
  KoreanAddressEntity,
  InternationalAddressEntity,
  FreeShippingRuleEntity,
  ShippingProviderConfigEntity,
  DeliveryProofEntity,
  ShippingLabelEntity,
  ShippingCacheEntity
} from './shipping.entity';
import {
  Shipment,
  ShippingRate,
  ShippingZone,
  KoreanAddress,
  InternationalAddress,
  TrackingEvent,
  ShippingStatus,
  KoreanShippingProvider,
  ShippingServiceType,
  FreeShippingRule,
  ShippingProviderConfig,
  ShippingCalculationRequest,
  ShippingOption
} from './shipping.types';

export class ShippingRepository extends BaseRepository<ShipmentEntity> {
  constructor(protected adapter: DatabaseAdapter) {
    super(adapter, 'shipments');
  }

  /**
   * Address Management
   */
  async createKoreanAddress(address: Omit<KoreanAddressEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<KoreanAddressEntity> {
    const query = `
      INSERT INTO korean_addresses (
        customer_id, postal_code, sido, sigungu, eupmyeondong,
        street_name, street_number, building_name, apartment_name,
        dong_number, ho_number, detail_address, receiver_name,
        receiver_phone, delivery_instructions, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const values = [
      address.customerId,
      address.postalCode,
      address.sido,
      address.sigungu,
      address.eupmyeondong,
      address.streetName,
      address.streetNumber,
      address.buildingName,
      address.apartmentName,
      address.dongNumber,
      address.hoNumber,
      address.detailAddress,
      address.receiverName,
      address.receiverPhone,
      address.deliveryInstructions,
      address.isDefault
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async createInternationalAddress(address: Omit<InternationalAddressEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<InternationalAddressEntity> {
    const query = `
      INSERT INTO international_addresses (
        customer_id, address_line1, address_line2, city,
        state_province, postal_code, country, country_code,
        receiver_name, receiver_phone, receiver_email, delivery_instructions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      address.customerId,
      address.addressLine1,
      address.addressLine2,
      address.city,
      address.stateProvince,
      address.postalCode,
      address.country,
      address.countryCode,
      address.receiverName,
      address.receiverPhone,
      address.receiverEmail,
      address.deliveryInstructions
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async getKoreanAddress(id: string): Promise<KoreanAddressEntity | null> {
    const query = 'SELECT * FROM korean_addresses WHERE id = $1 AND deleted_at IS NULL';
    const result = await this.adapter.query(query, [id]);
    return result.rows[0] || null;
  }

  async getInternationalAddress(id: string): Promise<InternationalAddressEntity | null> {
    const query = 'SELECT * FROM international_addresses WHERE id = $1 AND deleted_at IS NULL';
    const result = await this.adapter.query(query, [id]);
    return result.rows[0] || null;
  }

  async getCustomerAddresses(customerId: string): Promise<{
    korean: KoreanAddressEntity[];
    international: InternationalAddressEntity[];
  }> {
    const koreanQuery = 'SELECT * FROM korean_addresses WHERE customer_id = $1 AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC';
    const internationalQuery = 'SELECT * FROM international_addresses WHERE customer_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC';
    
    const [koreanResult, internationalResult] = await Promise.all([
      this.adapter.query(koreanQuery, [customerId]),
      this.adapter.query(internationalQuery, [customerId])
    ]);

    return {
      korean: koreanResult.rows,
      international: internationalResult.rows
    };
  }

  /**
   * Shipping Rate Management
   */
  async getShippingRates(criteria: {
    provider?: KoreanShippingProvider;
    serviceType?: ShippingServiceType;
    region?: string;
    weight?: number;
  }): Promise<ShippingRateEntity[]> {
    let query = 'SELECT * FROM shipping_rates WHERE is_active = true';
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.provider) {
      query += ` AND provider = $${paramIndex}`;
      values.push(criteria.provider);
      paramIndex++;
    }

    if (criteria.serviceType) {
      query += ` AND service_type = $${paramIndex}`;
      values.push(criteria.serviceType);
      paramIndex++;
    }

    if (criteria.region) {
      query += ` AND $${paramIndex} = ANY(available_regions)`;
      values.push(criteria.region);
      paramIndex++;
    }

    if (criteria.weight) {
      query += ` AND (min_weight IS NULL OR min_weight <= $${paramIndex}) 
                 AND (max_weight IS NULL OR max_weight >= $${paramIndex})`;
      values.push(criteria.weight);
      paramIndex++;
    }

    query += ' ORDER BY base_price ASC';

    const result = await this.adapter.query(query, values);
    return result.rows;
  }

  async createShippingRate(rate: Omit<ShippingRateEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShippingRateEntity> {
    const query = `
      INSERT INTO shipping_rates (
        provider, service_type, package_size, zone_id,
        base_price, price_per_kg, estimated_min_days,
        estimated_max_days, cutoff_time, available_regions,
        min_weight, max_weight, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      rate.provider,
      rate.serviceType,
      rate.packageSize,
      rate.zoneId,
      rate.basePrice,
      rate.pricePerKg,
      rate.estimatedMinDays,
      rate.estimatedMaxDays,
      rate.cutoffTime,
      rate.availableRegions,
      rate.minWeight,
      rate.maxWeight,
      rate.isActive
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  /**
   * Shipping Zone Management
   */
  async getShippingZones(region?: string): Promise<ShippingZoneEntity[]> {
    let query = 'SELECT * FROM shipping_zones WHERE is_active = true';
    const values: any[] = [];

    if (region) {
      query += ' AND $1 = ANY(regions)';
      values.push(region);
    }

    query += ' ORDER BY name';

    const result = await this.adapter.query(query, values);
    return result.rows;
  }

  async getShippingZoneByCode(code: string): Promise<ShippingZoneEntity | null> {
    const query = 'SELECT * FROM shipping_zones WHERE code = $1 AND is_active = true';
    const result = await this.adapter.query(query, [code]);
    return result.rows[0] || null;
  }

  /**
   * Shipment Management
   */
  async createShipment(shipment: Omit<ShipmentEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShipmentEntity> {
    const query = `
      INSERT INTO shipments (
        order_id, customer_id, provider, service_type,
        tracking_number, status, from_address_id, from_address_type,
        to_address_id, to_address_type, package_weight, package_length,
        package_width, package_height, package_count, package_size,
        base_price, additional_charges, insurance_amount, total_price,
        shipped_at, estimated_delivery_date, label_url, invoice_url,
        is_return, original_shipment_id, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27
      )
      RETURNING *
    `;

    const values = [
      shipment.orderId,
      shipment.customerId,
      shipment.provider,
      shipment.serviceType,
      shipment.trackingNumber,
      shipment.status,
      shipment.fromAddressId,
      shipment.fromAddressType,
      shipment.toAddressId,
      shipment.toAddressType,
      shipment.packageWeight,
      shipment.packageLength,
      shipment.packageWidth,
      shipment.packageHeight,
      shipment.packageCount,
      shipment.packageSize,
      shipment.basePrice,
      shipment.additionalCharges,
      shipment.insuranceAmount,
      shipment.totalPrice,
      shipment.shippedAt,
      shipment.estimatedDeliveryDate,
      shipment.labelUrl,
      shipment.invoiceUrl,
      shipment.isReturn,
      shipment.originalShipmentId,
      JSON.stringify(shipment.metadata || {})
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async createShipmentItems(items: Omit<ShipmentItemEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<ShipmentItemEntity[]> {
    if (items.length === 0) return [];

    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    items.forEach((item) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 
          $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, 
          $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11})`
      );
      
      values.push(
        item.shipmentId,
        item.productId,
        item.productName,
        item.quantity,
        item.weight,
        item.length,
        item.width,
        item.height,
        item.value,
        item.isFragile,
        item.requiresColdChain,
        item.specialInstructions
      );
      
      paramIndex += 12;
    });

    const query = `
      INSERT INTO shipment_items (
        shipment_id, product_id, product_name, quantity,
        weight, length, width, height, value,
        is_fragile, requires_cold_chain, special_instructions
      ) VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await this.adapter.query(query, values);
    return result.rows;
  }

  async getShipmentByTrackingNumber(trackingNumber: string): Promise<ShipmentEntity | null> {
    const query = 'SELECT * FROM shipments WHERE tracking_number = $1';
    const result = await this.adapter.query(query, [trackingNumber]);
    return result.rows[0] || null;
  }

  async getShipmentsByOrderId(orderId: string): Promise<ShipmentEntity[]> {
    const query = 'SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC';
    const result = await this.adapter.query(query, [orderId]);
    return result.rows;
  }

  async updateShipmentStatus(shipmentId: string, status: ShippingStatus, actualDeliveryDate?: Date): Promise<ShipmentEntity> {
    let query = 'UPDATE shipments SET status = $2';
    const values: any[] = [shipmentId, status];
    let paramIndex = 3;

    if (status === ShippingStatus.DELIVERED && actualDeliveryDate) {
      query += `, actual_delivery_date = $${paramIndex}`;
      values.push(actualDeliveryDate);
      paramIndex++;
    }

    if (status === ShippingStatus.PICKED_UP) {
      query += `, shipped_at = $${paramIndex}`;
      values.push(new Date());
      paramIndex++;
    }

    query += ' WHERE id = $1 RETURNING *';

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  /**
   * Tracking Management
   */
  async createTrackingEvent(event: Omit<TrackingEventEntity, 'id' | 'createdAt'>): Promise<TrackingEventEntity> {
    const query = `
      INSERT INTO tracking_events (
        shipment_id, tracking_number, status, location,
        description, event_timestamp, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      event.shipmentId,
      event.trackingNumber,
      event.status,
      event.location,
      event.description,
      event.eventTimestamp,
      JSON.stringify(event.details || {})
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async getTrackingEvents(trackingNumber: string): Promise<TrackingEventEntity[]> {
    const query = 'SELECT * FROM tracking_events WHERE tracking_number = $1 ORDER BY event_timestamp DESC';
    const result = await this.adapter.query(query, [trackingNumber]);
    return result.rows;
  }

  /**
   * Free Shipping Rules
   */
  async getApplicableFreeShippingRules(orderAmount: number, region?: string): Promise<FreeShippingRuleEntity[]> {
    let query = `
      SELECT * FROM free_shipping_rules 
      WHERE is_active = true 
      AND minimum_order_amount <= $1
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date IS NULL OR end_date >= NOW())
    `;
    const values: any[] = [orderAmount];
    let paramIndex = 2;

    if (region) {
      query += ` AND (applicable_regions IS NULL OR $${paramIndex} = ANY(applicable_regions))`;
      values.push(region);
      paramIndex++;
    }

    query += ' ORDER BY priority DESC, minimum_order_amount DESC';

    const result = await this.adapter.query(query, values);
    return result.rows;
  }

  /**
   * Provider Configuration
   */
  async getProviderConfig(provider: KoreanShippingProvider): Promise<ShippingProviderConfigEntity | null> {
    const query = 'SELECT * FROM shipping_provider_configs WHERE provider = $1 AND is_active = true';
    const result = await this.adapter.query(query, [provider]);
    return result.rows[0] || null;
  }

  async getAllProviderConfigs(): Promise<ShippingProviderConfigEntity[]> {
    const query = 'SELECT * FROM shipping_provider_configs WHERE is_active = true ORDER BY display_name';
    const result = await this.adapter.query(query);
    return result.rows;
  }

  /**
   * Shipping Label Management
   */
  async createShippingLabel(label: Omit<ShippingLabelEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShippingLabelEntity> {
    const query = `
      INSERT INTO shipping_labels (
        shipment_id, tracking_number, provider,
        label_format, label_url, label_data, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      label.shipmentId,
      label.trackingNumber,
      label.provider,
      label.labelFormat,
      label.labelUrl,
      label.labelData,
      label.expiresAt
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async getShippingLabel(shipmentId: string): Promise<ShippingLabelEntity | null> {
    const query = 'SELECT * FROM shipping_labels WHERE shipment_id = $1';
    const result = await this.adapter.query(query, [shipmentId]);
    return result.rows[0] || null;
  }

  /**
   * Delivery Proof Management
   */
  async createDeliveryProof(proof: Omit<DeliveryProofEntity, 'id' | 'createdAt'>): Promise<DeliveryProofEntity> {
    const query = `
      INSERT INTO delivery_proofs (
        shipment_id, tracking_number, delivered_at,
        signature, signature_url, photo_url,
        received_by, delivery_location, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      proof.shipmentId,
      proof.trackingNumber,
      proof.deliveredAt,
      proof.signature,
      proof.signatureUrl,
      proof.photoUrl,
      proof.receivedBy,
      proof.deliveryLocation,
      proof.notes
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async getDeliveryProof(shipmentId: string): Promise<DeliveryProofEntity | null> {
    const query = 'SELECT * FROM delivery_proofs WHERE shipment_id = $1';
    const result = await this.adapter.query(query, [shipmentId]);
    return result.rows[0] || null;
  }

  /**
   * Cache Management
   */
  async getCachedData(cacheKey: string): Promise<ShippingCacheEntity | null> {
    const query = 'SELECT * FROM shipping_cache WHERE cache_key = $1 AND expires_at > NOW()';
    const result = await this.adapter.query(query, [cacheKey]);
    return result.rows[0] || null;
  }

  async setCachedData(cache: Omit<ShippingCacheEntity, 'id' | 'createdAt'>): Promise<ShippingCacheEntity> {
    const query = `
      INSERT INTO shipping_cache (cache_key, cache_type, data, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cache_key) 
      DO UPDATE SET data = $3, expires_at = $4
      RETURNING *
    `;

    const values = [
      cache.cacheKey,
      cache.cacheType,
      JSON.stringify(cache.data),
      cache.expiresAt
    ];

    const result = await this.adapter.query(query, values);
    return result.rows[0];
  }

  async clearExpiredCache(): Promise<number> {
    const query = 'DELETE FROM shipping_cache WHERE expires_at < NOW()';
    const result = await this.adapter.query(query);
    return result.rowCount;
  }

  /**
   * Analytics and Reporting
   */
  async getShippingStatsByDateRange(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        provider,
        service_type,
        COUNT(*) as total_shipments,
        AVG(total_price) as avg_price,
        SUM(total_price) as total_revenue,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
        AVG(CASE 
          WHEN actual_delivery_date IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (actual_delivery_date - shipped_at)) / 86400 
        END) as avg_delivery_days
      FROM shipments
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY provider, service_type
      ORDER BY total_shipments DESC
    `;

    const result = await this.adapter.query(query, [startDate, endDate]);
    return result.rows;
  }

  async getShippingVolumeByRegion(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT 
        ka.sido as region,
        COUNT(DISTINCT s.id) as shipment_count,
        SUM(s.total_price) as total_revenue
      FROM shipments s
      INNER JOIN korean_addresses ka ON s.to_address_id = ka.id AND s.to_address_type = 'korean'
      WHERE s.created_at BETWEEN $1 AND $2
      GROUP BY ka.sido
      ORDER BY shipment_count DESC
    `;

    const result = await this.adapter.query(query, [startDate, endDate]);
    return result.rows;
  }
}