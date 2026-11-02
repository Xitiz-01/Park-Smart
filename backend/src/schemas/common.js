const { z } = require('zod');

// Shapes shared by the request schemas. They check type and size; business
// rules (opening hours, catalogue matches, pricing) stay in the controllers.
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');
const dateTime = z.string().trim().min(1).max(64).refine((value) => !Number.isNaN(Date.parse(value)), 'must be a date and time');
const text = (max) => z.string().max(max, `must be at most ${max} characters`);
// Numbers arrive as JSON numbers or as strings from form fields.
const numeric = z.union([z.number().finite(), text(32)]);
const positiveIntString = z.string().regex(/^\d{1,6}$/, 'must be a whole number');

module.exports = { z, objectId, dateTime, text, numeric, positiveIntString };
