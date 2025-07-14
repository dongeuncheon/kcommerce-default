-- ==================================================
-- Korean E-commerce Sample Product Data
-- ==================================================

-- Insert sample products for Korean e-commerce
-- Fashion products
INSERT INTO products (id, category_id, sku, name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, status, visibility, featured, tags) 
SELECT 
    uuid_generate_v4(),
    c.id,
    'FASHION-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
    p.name,
    p.korean_name,
    p.english_name,
    p.slug,
    p.short_description,
    p.description,
    p.price,
    p.compare_price,
    p.stock_quantity,
    'published',
    'visible',
    p.featured,
    p.tags::text[]
FROM categories c
CROSS JOIN (VALUES
    ('여성 니트 원피스', '여성 니트 원피스', 'Women''s Knit Dress', 'womens-knit-dress', '부드러운 니트 소재의 원피스', '겨울철 착용하기 좋은 따뜻하고 편안한 니트 원피스입니다. 다양한 상황에 어울리는 심플한 디자인으로 제작되었습니다.', 89000, 129000, 50, true, '{"여성의류", "원피스", "니트", "겨울"}'),
    ('남성 정장 셔츠', '남성 정장 셔츠', 'Men''s Dress Shirt', 'mens-dress-shirt', '비즈니스룩을 완성하는 정장 셔츠', '고급 면 소재로 제작된 정장 셔츠입니다. 슬림핏 디자인으로 세련된 비즈니스 룩을 연출할 수 있습니다.', 45000, 65000, 100, false, '{"남성의류", "셔츠", "정장", "비즈니스"}'),
    ('운동화 (에어 쿠션)', '운동화 (에어 쿠션)', 'Air Cushion Sneakers', 'air-cushion-sneakers', '편안한 에어 쿠션 운동화', '일상생활과 가벼운 운동에 적합한 에어 쿠션 운동화입니다. 뛰어난 쿠셔닝과 통기성을 제공합니다.', 120000, 180000, 75, true, '{"신발", "운동화", "스니커즈", "쿠션"}'),
    ('가죽 크로스백', '가죽 크로스백', 'Leather Crossbody Bag', 'leather-crossbody-bag', '실용적인 가죽 크로스백', '고급 천연가죽으로 제작된 크로스백입니다. 일상용으로 사용하기에 적합한 크기와 수납공간을 제공합니다.', 85000, 120000, 30, false, '{"가방", "크로스백", "가죽", "액세서리"}')
) AS p(name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, featured, tags)
WHERE c.korean_name = '여성의류' OR c.korean_name = '남성의류' OR c.korean_name = '신발' OR c.korean_name = '가방/잡화';

-- Beauty products
INSERT INTO products (id, category_id, sku, name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, status, visibility, featured, tags)
SELECT 
    uuid_generate_v4(),
    c.id,
    'BEAUTY-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
    p.name,
    p.korean_name,
    p.english_name,
    p.slug,
    p.short_description,
    p.description,
    p.price,
    p.compare_price,
    p.stock_quantity,
    'published',
    'visible',
    p.featured,
    p.tags::text[]
FROM categories c
CROSS JOIN (VALUES
    ('수분 에센스', '수분 에센스', 'Hydrating Essence', 'hydrating-essence', '깊은 수분 공급 에센스', '건조한 피부에 깊은 수분을 공급하는 에센스입니다. 히알루론산과 세라마이드 성분이 피부 장벽을 강화합니다.', 35000, 45000, 200, true, '{"스킨케어", "에센스", "수분", "히알루론산"}'),
    ('비비 크림', '비비 크림', 'BB Cream', 'bb-cream', '자연스러운 커버력의 비비크림', '자연스러운 커버력과 자외선 차단 기능을 제공하는 올인원 비비크림입니다. SPF50+ PA+++', 28000, 38000, 150, false, '{"메이크업", "베이스", "비비크림", "자외선차단"}'),
    ('아르간 헤어 오일', '아르간 헤어 오일', 'Argan Hair Oil', 'argan-hair-oil', '손상된 모발을 위한 헤어 오일', '모로코산 아르간 오일로 손상된 모발에 영양과 윤기를 제공합니다. 열 보호 기능도 함께 제공합니다.', 22000, 32000, 80, false, '{"헤어케어", "헤어오일", "아르간", "모발영양"}'),
    ('시트러스 향수', '시트러스 향수', 'Citrus Perfume', 'citrus-perfume', '상큼한 시트러스 향의 향수', '레몬, 오렌지, 자몽의 상큼한 시트러스 노트가 어우러진 향수입니다. 일상용으로 사용하기 좋은 프레시한 향입니다.', 65000, 85000, 40, true, '{"향수", "시트러스", "프레시", "일상용"}')
) AS p(name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, featured, tags)
WHERE c.korean_name = '스킨케어' OR c.korean_name = '메이크업' OR c.korean_name = '헤어케어' OR c.korean_name = '향수';

-- Food products
INSERT INTO products (id, category_id, sku, name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, status, visibility, featured, tags)
SELECT 
    uuid_generate_v4(),
    c.id,
    'FOOD-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
    p.name,
    p.korean_name,
    p.english_name,
    p.slug,
    p.short_description,
    p.description,
    p.price,
    p.compare_price,
    p.stock_quantity,
    'published',
    'visible',
    p.featured,
    p.tags::text[]
FROM categories c
CROSS JOIN (VALUES
    ('프리미엄 김치', '프리미엄 김치', 'Premium Kimchi', 'premium-kimchi', '전통 방식으로 만든 프리미엄 김치', '100% 국내산 재료로 전통 방식에 따라 발효시킨 프리미엄 김치입니다. 깊은 맛과 풍부한 유산균을 자랑합니다.', 12000, 15000, 500, true, '{"한식", "김치", "발효식품", "국내산"}'),
    ('매운맛 컵라면', '매운맛 컵라면', 'Spicy Cup Noodles', 'spicy-cup-noodles', '얼큰한 매운맛 컵라면', '고춧가루와 특제 양념으로 만든 얼큰하고 시원한 매운맛 컵라면입니다. 간편하게 즐길 수 있는 인스턴트 식품입니다.', 1500, 2000, 1000, false, '{"인스턴트", "라면", "매운맛", "간편식"}'),
    ('프리미엄 원두커피', '프리미엄 원두커피', 'Premium Coffee Beans', 'premium-coffee-beans', '산지에서 직접 가져온 원두커피', '에티오피아산 아라비카 원두를 사용한 프리미엄 커피입니다. 산미와 단맛이 조화로운 풍부한 향을 느낄 수 있습니다.', 25000, 35000, 200, true, '{"커피", "원두", "에티오피아", "아라비카"}'),
    ('수제 초콜릿', '수제 초콜릿', 'Handmade Chocolate', 'handmade-chocolate', '벨기에산 초콜릿으로 만든 수제 초콜릿', '최고급 벨기에산 초콜릿을 사용하여 수작업으로 만든 프리미엄 초콜릿입니다. 선물용으로도 인기가 높습니다.', 18000, 25000, 100, false, '{"초콜릿", "수제", "벨기에", "선물용"}')
) AS p(name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, featured, tags)
WHERE c.korean_name = '한식' OR c.korean_name = '인스턴트식품' OR c.korean_name = '음료' OR c.korean_name = '과자/간식';

-- Electronics products  
INSERT INTO products (id, category_id, sku, name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, status, visibility, featured, tags)
SELECT 
    uuid_generate_v4(),
    c.id,
    'ELEC-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
    p.name,
    p.korean_name,
    p.english_name,
    p.slug,
    p.short_description,
    p.description,
    p.price,
    p.compare_price,
    p.stock_quantity,
    'published',
    'visible',
    p.featured,
    p.tags::text[]
FROM categories c
CROSS JOIN (VALUES
    ('무선 이어폰', '무선 이어폰', 'Wireless Earbuds', 'wireless-earbuds', '고음질 무선 이어폰', '블루투스 5.0 기술을 적용한 무선 이어폰입니다. 노이즈 캔슬링 기능과 최대 24시간 재생이 가능합니다.', 150000, 200000, 300, true, '{"이어폰", "무선", "블루투스", "노이즈캔슬링"}'),
    ('스마트워치', '스마트워치', 'Smart Watch', 'smart-watch', '건강 관리 스마트워치', '심박수, 수면패턴, 운동량을 측정할 수 있는 스마트워치입니다. 방수 기능과 긴 배터리 수명을 제공합니다.', 280000, 350000, 150, true, '{"스마트워치", "헬스케어", "방수", "피트니스"}'),
    ('전기밥솥', '전기밥솥', 'Electric Rice Cooker', 'electric-rice-cooker', '압력 IH 전기밥솥', '압력 IH 방식으로 밥을 더욱 맛있게 지을 수 있는 전기밥솥입니다. 다양한 취사 모드를 지원합니다.', 320000, 450000, 80, false, '{"밥솥", "압력IH", "주방가전", "취사"}'),
    ('무선 청소기', '무선 청소기', 'Cordless Vacuum', 'cordless-vacuum', '강력한 흡입력의 무선 청소기', '리튬이온 배터리로 작동하는 무선 청소기입니다. 강력한 흡입력과 다양한 브러시를 제공하여 효율적인 청소가 가능합니다.', 250000, 350000, 60, false, '{"청소기", "무선", "리튬배터리", "강력흡입"}')
) AS p(name, korean_name, english_name, slug, short_description, description, price, compare_price, stock_quantity, featured, tags)
WHERE c.korean_name = 'TV/오디오' OR c.korean_name = '스마트폰' OR c.korean_name = '주방가전' OR c.korean_name = '생활가전';

-- Insert some sample settings for Korean e-commerce
INSERT INTO settings (key, value, type, description, is_public) VALUES
('site_name', '한국 이커머스', 'string', '사이트 이름', true),
('site_description', '최고의 한국 쇼핑몰', 'string', '사이트 설명', true),
('default_currency', 'KRW', 'string', '기본 통화', true),
('tax_rate', '0.1', 'number', '부가가치세율 (10%)', false),
('free_shipping_threshold', '50000', 'number', '무료배송 최소주문금액', true),
('business_registration_number', '123-45-67890', 'string', '사업자등록번호', true),
('customer_service_phone', '1588-1234', 'string', '고객센터 전화번호', true),
('customer_service_email', 'cs@shop.co.kr', 'string', '고객센터 이메일', true),
('return_policy_days', '7', 'number', '반품 가능 일수', true),
('refund_policy_days', '14', 'number', '환불 처리 일수', true),
('privacy_policy_url', '/privacy', 'string', '개인정보처리방침 URL', true),
('terms_of_service_url', '/terms', 'string', '이용약관 URL', true),
('company_name', '(주)한국이커머스', 'string', '회사명', true),
('company_address', '서울특별시 강남구 테헤란로 123', 'string', '회사 주소', true),
('ceo_name', '홍길동', 'string', '대표자명', true),
('business_hours', '{"start": "09:00", "end": "18:00", "timezone": "Asia/Seoul"}', 'json', '영업시간', true);