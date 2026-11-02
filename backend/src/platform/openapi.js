const { z } = require('zod');
const bookings = require('../schemas/bookings');
const vehicles = require('../schemas/vehicles');
const locations = require('../schemas/parkingLocations');
const verification = require('../schemas/verification');

const jsonSchema = (schema) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
const isOptional = (schema) => schema.safeParse(undefined).success;

const parametersFor = (location, schema) => Object.entries(schema?.shape || {}).map(([name, field]) => {
  const { $schema, ...fieldSchema } = jsonSchema(field);
  return { name, in: location, required: location === 'path' || !isOptional(field), schema: fieldSchema };
});

const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);
// "post /api/v1/vendors/parking-locations/{id}/slots" -> "postVendorsParkingLocationsByIdSlots"
const operationId = (method, path) => method + path.replace(/^\/api\/v1/, '').split('/').filter(Boolean)
  .map((segment) => (segment.startsWith('{') ? `By${capitalise(segment.slice(1, -1))}` : segment.split('-').map(capitalise).join('')))
  .join('');

const errorResponse = { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } };

// The documented operations: every endpoint that has a request schema, plus
// health. Other endpoints are added as they get schemas (Phase 7).
const operations = [
  { method: 'get', path: '/health/live', tag: 'Health', summary: 'The process is up', auth: false },
  { method: 'get', path: '/health/ready', tag: 'Health', summary: 'Dependencies are reachable', auth: false },
  { method: 'post', path: '/api/v1/bookings', tag: 'Bookings', summary: 'Book a slot (EV) or capacity (everything else)', body: bookings.createBooking },
  { method: 'get', path: '/api/v1/bookings', tag: 'Bookings', summary: 'List all bookings (admin)', query: bookings.listBookings },
  { method: 'get', path: '/api/v1/bookings/my', tag: 'Bookings', summary: 'List my bookings' },
  { method: 'get', path: '/api/v1/bookings/{id}', tag: 'Bookings', summary: 'Get a booking', params: bookings.bookingId },
  { method: 'put', path: '/api/v1/bookings/{id}/cancel', tag: 'Bookings', summary: 'Cancel a booking', params: bookings.bookingId },
  { method: 'put', path: '/api/v1/bookings/{id}/checkin', tag: 'Bookings', summary: 'Check in (admin)', params: bookings.bookingId },
  { method: 'put', path: '/api/v1/bookings/{id}/checkout', tag: 'Bookings', summary: 'Check out (admin)', params: bookings.bookingId },
  { method: 'get', path: '/api/v1/vehicles', tag: 'Vehicles', summary: 'List my vehicles' },
  { method: 'post', path: '/api/v1/vehicles', tag: 'Vehicles', summary: 'Add a vehicle', body: vehicles.vehicleInput },
  { method: 'put', path: '/api/v1/vehicles/{id}', tag: 'Vehicles', summary: 'Update a vehicle', params: vehicles.vehicleId, body: vehicles.vehicleInput },
  { method: 'delete', path: '/api/v1/vehicles/{id}', tag: 'Vehicles', summary: 'Delete a vehicle', params: vehicles.vehicleId },
  { method: 'post', path: '/api/v1/vendors/parking-locations', tag: 'Vendor locations', summary: 'Create a parking location (draft)', body: locations.locationInput },
  { method: 'get', path: '/api/v1/vendors/parking-locations/{id}', tag: 'Vendor locations', summary: 'Get one of my locations', params: locations.locationId },
  { method: 'patch', path: '/api/v1/vendors/parking-locations/{id}', tag: 'Vendor locations', summary: 'Update a location', params: locations.locationId, body: locations.locationInput },
  { method: 'post', path: '/api/v1/vendors/parking-locations/{id}/publish', tag: 'Vendor locations', summary: 'Publish (needs a verified vendor and authorisation)', params: locations.locationId },
  { method: 'delete', path: '/api/v1/vendors/parking-locations/{id}', tag: 'Vendor locations', summary: 'Deactivate a location', params: locations.locationId },
  { method: 'get', path: '/api/v1/vendors/parking-locations/{id}/slots', tag: 'Vendor locations', summary: 'EV bays with availability', params: locations.locationId, query: locations.availabilityQuery },
  { method: 'post', path: '/api/v1/vendors/parking-locations/{id}/slots', tag: 'Vendor locations', summary: 'Add an EV bay', params: locations.locationId, body: locations.slotInput },
  { method: 'post', path: '/api/v1/vendors/parking-locations/{id}/slots/bulk', tag: 'Vendor locations', summary: 'Add numbered EV bays', params: locations.locationId, body: locations.slotInput },
  { method: 'patch', path: '/api/v1/vendors/slots/{slotId}', tag: 'Vendor locations', summary: 'Update an EV bay', params: locations.slotId, body: locations.slotInput },
  { method: 'put', path: '/api/v1/vendors/bookings/{bookingId}/checkin', tag: 'Vendor bookings', summary: 'Check a driver in', params: locations.vendorBookingId },
  { method: 'put', path: '/api/v1/vendors/bookings/{bookingId}/checkout', tag: 'Vendor bookings', summary: 'Check a driver out', params: locations.vendorBookingId },
  { method: 'post', path: '/api/v1/vendor-verification/documents', tag: 'Verification', summary: 'Upload a document for manual review', body: verification.documentUpload, multipart: true },
  { method: 'post', path: '/api/v1/vendor-verification/parking-authorizations/{locationId}', tag: 'Verification', summary: 'Upload authorisation for a location', params: verification.parkingAuthorization, body: verification.documentUpload, multipart: true },
  { method: 'post', path: '/api/v1/vendor-verification/external/{kind}', tag: 'Verification', summary: 'Run a Cashfree check (pan, gstin, bank_account)', params: verification.externalCheck, body: verification.externalCheckInput },
];

const requestBody = ({ body, multipart }) => {
  if (!body) return undefined;
  const { $schema, ...schema } = jsonSchema(body);
  if (multipart) {
    schema.properties = { ...schema.properties, document: { type: 'string', format: 'binary', description: 'PDF, JPEG or PNG, 5 MB at most' } };
    schema.required = [...(schema.required || []), 'document'];
    return { required: true, content: { 'multipart/form-data': { schema } } };
  }
  return { required: true, content: { 'application/json': { schema } } };
};

/**
 * Build the OpenAPI 3.1 document from the request schemas, so the docs
 * can't drift from what the server enforces.
 * @returns {object}
 */
function buildOpenApiDocument() {
  const paths = {};
  for (const operation of operations) {
    const parameters = [...parametersFor('path', operation.params), ...parametersFor('query', operation.query)];
    paths[operation.path] = paths[operation.path] || {};
    paths[operation.path][operation.method] = {
      operationId: operationId(operation.method, operation.path),
      tags: [operation.tag],
      summary: operation.summary,
      ...(parameters.length ? { parameters } : {}),
      ...(operation.body ? { requestBody: requestBody(operation) } : {}),
      ...(operation.auth === false ? { security: [] } : {}),
      responses: {
        200: { description: 'Success' },
        ...(operation.body || operation.params || operation.query ? { 400: errorResponse } : {}),
        ...(operation.auth === false ? {} : { 401: errorResponse, 403: errorResponse }),
        429: errorResponse,
        500: errorResponse,
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'ParkSmart API',
      version: '1.0.0',
      description: 'Routes under /api/v1. The unversioned /api/* paths still work but are deprecated.',
    },
    servers: [{ url: '/' }],
    security: [{ sessionCookie: [] }],
    paths,
    components: {
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token', description: 'Set by POST /api/auth/sign-in/email' },
      },
      schemas: {
        ErrorEnvelope: {
          type: 'object',
          required: ['success', 'message', 'error'],
          properties: {
            success: { const: false },
            message: { type: 'string' },
            error: {
              type: 'object',
              required: ['code', 'message', 'requestId'],
              properties: {
                code: { type: 'string', examples: ['VALIDATION_FAILED', 'NOT_FOUND', 'RATE_LIMITED'] },
                message: { type: 'string' },
                details: {},
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

module.exports = { buildOpenApiDocument };
