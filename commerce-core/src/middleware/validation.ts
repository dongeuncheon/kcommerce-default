/**
 * Request validation middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/**
 * Validate request against JSON schema
 */
export function validateRequest(schema: any) {
  const validate = ajv.compile(schema);

  return async function (request: FastifyRequest, reply: FastifyReply) {
    const valid = validate(request.body);
    
    if (!valid) {
      return reply.code(400).send({
        error: 'Validation failed',
        errors: validate.errors
      });
    }
  };
}