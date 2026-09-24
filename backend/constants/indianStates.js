const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const isIndianState = (value) => INDIAN_STATES.includes(value);

const STATE_ALIASES = {
  'National Capital Territory of Delhi': 'Delhi',
  'NCT of Delhi': 'Delhi',
  Orissa: 'Odisha',
  Pondicherry: 'Puducherry',
};

const normalizeIndianState = (value) => STATE_ALIASES[value] || value;

module.exports = { INDIAN_STATES, isIndianState, normalizeIndianState };
