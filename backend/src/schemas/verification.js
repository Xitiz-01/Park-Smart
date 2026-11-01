const { z, objectId, text } = require('./common');

const parkingAuthorization = z.object({ locationId: objectId });
const externalCheck = z.object({ kind: z.string().regex(/^[a-z_]{2,30}$/i, 'must be a check name') });

// Multipart form fields always arrive as strings.
const documentUpload = z.looseObject({
  documentType: text(60).optional(),
  category: text(60).optional(),
  consent: text(10).optional(),
});

const externalCheckInput = z.looseObject({
  consent: z.boolean().optional(),
  name: text(140).optional(),
  businessName: text(140).optional(),
  identifier: text(64).optional(),
  accountNumber: text(64).optional(),
  ifsc: text(20).optional(),
});

module.exports = { parkingAuthorization, externalCheck, documentUpload, externalCheckInput };
