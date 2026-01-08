/**
 * Тарифы на покупку токенов
 */
export const TOKEN_PRICING = [
  {
    id: 'tier1',
    tokens: 1000,
    price: 300.00,
    pricePerToken: 0.30,
    label: '1000 токенов',
    description: 'Базовый пакет',
    popular: false
  },
  {
    id: 'tier2',
    tokens: 2000,
    price: 549.00,
    pricePerToken: 0.2745,
    label: '2000 токенов',
    description: 'Выгодный пакет',
    popular: true // Самый популярный
  },
  {
    id: 'tier3',
    tokens: 4000,
    price: 999.00,
    pricePerToken: 0.24975,
    label: '4000 токенов',
    description: 'Максимальный пакет',
    popular: false
  },
  {
    id: 'tier_test',
    tokens: 100,
    price: 10.00,
    pricePerToken: 0.10,
    label: 'ТЕСТ (100 токенов)',
    description: 'Для проверки оплаты',
    popular: false
  }
];

/**
 * Получить тариф по ID
 */
export function getPricingById(tierId) {
  return TOKEN_PRICING.find(tier => tier.id === tierId);
}

/**
 * Получить тариф по количеству токенов
 */
export function getPricingByTokens(tokens) {
  return TOKEN_PRICING.find(tier => tier.tokens === tokens);
}

/**
 * Получить все тарифы
 */
export function getAllPricing() {
  return TOKEN_PRICING;
}



