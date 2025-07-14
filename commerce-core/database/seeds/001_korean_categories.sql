-- ==================================================
-- Korean E-commerce Category Seed Data
-- ==================================================

-- Insert main categories (Korean e-commerce standard categories)
INSERT INTO categories (id, name, korean_name, english_name, slug, description, sort_order, is_active) VALUES
(uuid_generate_v4(), '패션의류', '패션의류', 'Fashion & Clothing', 'fashion-clothing', '의류, 신발, 액세서리', 1, true),
(uuid_generate_v4(), '뷰티', '뷰티', 'Beauty', 'beauty', '화장품, 스킨케어, 향수', 2, true),
(uuid_generate_v4(), '식품', '식품', 'Food & Beverages', 'food-beverages', '식품, 음료, 건강식품', 3, true),
(uuid_generate_v4(), '생활용품', '생활용품', 'Home & Living', 'home-living', '생활용품, 주방용품, 인테리어', 4, true),
(uuid_generate_v4(), '디지털/가전', '디지털/가전', 'Electronics', 'electronics', '스마트폰, 컴퓨터, 가전제품', 5, true),
(uuid_generate_v4(), '스포츠/레저', '스포츠/레저', 'Sports & Leisure', 'sports-leisure', '운동용품, 아웃도어, 레저용품', 6, true),
(uuid_generate_v4(), '도서', '도서', 'Books', 'books', '도서, 전자책, 교육자료', 7, true),
(uuid_generate_v4(), '육아/완구', '육아/완구', 'Baby & Kids', 'baby-kids', '유아용품, 장난감, 교육완구', 8, true),
(uuid_generate_v4(), '반려동물', '반려동물', 'Pet Supplies', 'pet-supplies', '펫푸드, 펫용품, 펫액세서리', 9, true),
(uuid_generate_v4(), '자동차용품', '자동차용품', 'Automotive', 'automotive', '자동차용품, 타이어, 부품', 10, true);

-- Insert fashion subcategories
INSERT INTO categories (id, parent_id, name, korean_name, english_name, slug, description, sort_order, is_active)
SELECT 
    uuid_generate_v4(),
    c.id,
    sub.name,
    sub.korean_name,
    sub.english_name,
    sub.slug,
    sub.description,
    sub.sort_order,
    true
FROM categories c
CROSS JOIN (VALUES
    ('여성의류', '여성의류', 'Women''s Clothing', 'womens-clothing', '여성 상의, 하의, 원피스', 1),
    ('남성의류', '남성의류', 'Men''s Clothing', 'mens-clothing', '남성 상의, 하의, 정장', 2),
    ('신발', '신발', 'Shoes', 'shoes', '운동화, 구두, 부츠, 샌들', 3),
    ('가방/잡화', '가방/잡화', 'Bags & Accessories', 'bags-accessories', '가방, 지갑, 벨트, 액세서리', 4),
    ('언더웨어', '언더웨어', 'Underwear', 'underwear', '속옷, 잠옷, 양말', 5)
) AS sub(name, korean_name, english_name, slug, description, sort_order)
WHERE c.korean_name = '패션의류';

-- Insert beauty subcategories
INSERT INTO categories (id, parent_id, name, korean_name, english_name, slug, description, sort_order, is_active)
SELECT 
    uuid_generate_v4(),
    c.id,
    sub.name,
    sub.korean_name,
    sub.english_name,
    sub.slug,
    sub.description,
    sub.sort_order,
    true
FROM categories c
CROSS JOIN (VALUES
    ('스킨케어', '스킨케어', 'Skincare', 'skincare', '클렌징, 토너, 에센스, 크림', 1),
    ('메이크업', '메이크업', 'Makeup', 'makeup', '베이스, 컬러, 립, 아이메이크업', 2),
    ('헤어케어', '헤어케어', 'Hair Care', 'hair-care', '샴푸, 컨디셔너, 헤어트리트먼트', 3),
    ('향수', '향수', 'Fragrance', 'fragrance', '향수, 디퓨저, 바디미스트', 4),
    ('남성화장품', '남성화장품', 'Men''s Grooming', 'mens-grooming', '남성 스킨케어, 면도용품', 5)
) AS sub(name, korean_name, english_name, slug, description, sort_order)
WHERE c.korean_name = '뷰티';

-- Insert food subcategories
INSERT INTO categories (id, parent_id, name, korean_name, english_name, slug, description, sort_order, is_active)
SELECT 
    uuid_generate_v4(),
    c.id,
    sub.name,
    sub.korean_name,
    sub.english_name,
    sub.slug,
    sub.description,
    sub.sort_order,
    true
FROM categories c
CROSS JOIN (VALUES
    ('한식', '한식', 'Korean Food', 'korean-food', '김치, 젓갈, 전통식품', 1),
    ('인스턴트식품', '인스턴트식품', 'Instant Food', 'instant-food', '라면, 즉석밥, 냉동식품', 2),
    ('음료', '음료', 'Beverages', 'beverages', '음료수, 차, 커피', 3),
    ('과자/간식', '과자/간식', 'Snacks', 'snacks', '과자, 초콜릿, 견과류', 4),
    ('건강식품', '건강식품', 'Health Food', 'health-food', '비타민, 영양제, 건강보조식품', 5)
) AS sub(name, korean_name, english_name, slug, description, sort_order)
WHERE c.korean_name = '식품';

-- Insert home & living subcategories
INSERT INTO categories (id, parent_id, name, korean_name, english_name, slug, description, sort_order, is_active)
SELECT 
    uuid_generate_v4(),
    c.id,
    sub.name,
    sub.korean_name,
    sub.english_name,
    sub.slug,
    sub.description,
    sub.sort_order,
    true
FROM categories c
CROSS JOIN (VALUES
    ('주방용품', '주방용품', 'Kitchen', 'kitchen', '조리도구, 식기, 주방가전', 1),
    ('욕실용품', '욕실용품', 'Bathroom', 'bathroom', '타월, 욕실매트, 세면용품', 2),
    ('침구', '침구', 'Bedding', 'bedding', '이불, 베개, 매트리스', 3),
    ('청소용품', '청소용품', 'Cleaning', 'cleaning', '세제, 청소도구, 방향제', 4),
    ('수납/정리', '수납/정리', 'Storage', 'storage', '수납함, 정리용품, 행거', 5)
) AS sub(name, korean_name, english_name, slug, description, sort_order)
WHERE c.korean_name = '생활용품';

-- Insert electronics subcategories
INSERT INTO categories (id, parent_id, name, korean_name, english_name, slug, description, sort_order, is_active)
SELECT 
    uuid_generate_v4(),
    c.id,
    sub.name,
    sub.korean_name,
    sub.english_name,
    sub.slug,
    sub.description,
    sub.sort_order,
    true
FROM categories c
CROSS JOIN (VALUES
    ('스마트폰', '스마트폰', 'Smartphones', 'smartphones', '스마트폰, 케이스, 액세서리', 1),
    ('컴퓨터', '컴퓨터', 'Computers', 'computers', '노트북, 데스크탑, 주변기기', 2),
    ('생활가전', '생활가전', 'Home Appliances', 'home-appliances', '냉장고, 세탁기, 청소기', 3),
    ('주방가전', '주방가전', 'Kitchen Appliances', 'kitchen-appliances', '전자레인지, 밥솥, 에어프라이어', 4),
    ('TV/오디오', 'TV/오디오', 'TV & Audio', 'tv-audio', 'TV, 스피커, 이어폰', 5)
) AS sub(name, korean_name, english_name, slug, description, sort_order)
WHERE c.korean_name = '디지털/가전';