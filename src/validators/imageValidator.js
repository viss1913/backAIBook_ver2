import Joi from 'joi';

/**
 * Схема валидации для запроса генерации изображения
 */
const generateImageSchema = Joi.object({
  bookTitle: Joi.string()
    .max(100)
    .required()
    .messages({
      'string.max': 'bookTitle must not exceed 100 characters',
      'any.required': 'bookTitle is required',
      'string.empty': 'bookTitle cannot be empty'
    }),

  author: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.max': 'author must not exceed 50 characters',
      'any.required': 'author is required',
      'string.empty': 'author cannot be empty'
    }),

  textChunk: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Проверка на максимальное количество слов (500)
      const words = value.trim().split(/\s+/).filter(word => word.length > 0);
      if (words.length > 500) {
        return helpers.message('textChunk must not exceed 500 words');
      }
      return value;
    })
    .messages({
      'any.required': 'textChunk is required',
      'string.empty': 'textChunk cannot be empty'
    }),

  prevSceneDescription: Joi.string()
    .max(500)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'prevSceneDescription must not exceed 500 characters'
    }),

  audience: Joi.string()
    .optional()
    .messages({
      'any.only': 'audience must be one of: adults, children, teens'
    }),

  styleKey: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'styleKey must not exceed 50 characters'
    })
});

/**
 * Валидирует данные запроса для генерации изображения
 * @param {Object} data - Данные для валидации
 * @returns {Object} { error: string | null, value: Object | null }
 */
/**
 * Схема валидации для запроса получения изображений через Perplexity
 */
const getImagesFromPerplexitySchema = Joi.object({
  query: Joi.string()
    .min(3)
    .max(500)
    .required()
    .messages({
      'string.min': 'query must be at least 3 characters',
      'string.max': 'query must not exceed 500 characters',
      'any.required': 'query is required',
      'string.empty': 'query cannot be empty'
    }),

  imageFormatFilter: Joi.array()
    .items(Joi.string().valid('jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'))
    .optional()
    .messages({
      'array.includesUnknownSingle': 'imageFormatFilter must contain only valid formats: jpeg, png, webp, gif, svg, bmp'
    }),

  imageDomainFilter: Joi.array()
    .items(Joi.string())
    .optional()
});

export function validateGenerateImageRequest(data) {
  const { error, value } = generateImageSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(', ');
    return {
      error: errorMessages,
      value: null
    };
  }

  return {
    error: null,
    value
  };
}

/**
 * Валидирует данные запроса для получения изображений через Perplexity
 * @param {Object} data - Данные для валидации
 * @returns {Object} { error: string | null, value: Object | null }
 */
export function validateGetImagesFromPerplexityRequest(data) {
  const { error, value } = getImagesFromPerplexitySchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message).join(', ');
    return {
      error: errorMessages,
      value: null
    };
  }

  return {
    error: null,
    value
  };
}


