export const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  cardAlt: '#273449',
  border: '#334155',
  text: '#f1f5f9',
  textDim: '#94a3b8',
  accent: '#38bdf8',
  accentDim: '#0ea5e9',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a78bfa',
};

export const VEHICLE_TYPES = [
  { key: 'car', label: 'Car', icon: '🚗' },
  { key: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
  { key: 'scooter', label: 'Electric Scooter', icon: '🛴' },
  { key: 'other', label: 'Other', icon: '🔧' },
];

// Preset maintenance tasks. `intervalKm` / `intervalMonths` used to compute
// "due" status when the vehicle has odometer readings or a last-done date.
export const MAINTENANCE_PRESETS = [
  { key: 'oil', label: 'Engine Oil', intervalKm: 5000, intervalMonths: 12, appliesTo: ['car', 'motorcycle'] },
  { key: 'oil_filter', label: 'Oil Filter', intervalKm: 5000, intervalMonths: 12, appliesTo: ['car', 'motorcycle'] },
  { key: 'air_filter', label: 'Air Filter', intervalKm: 15000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'cabin_filter', label: 'Cabin Filter', intervalKm: 15000, intervalMonths: 12, appliesTo: ['car'] },
  { key: 'fuel_filter', label: 'Fuel Filter', intervalKm: 30000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'brake_pads', label: 'Brake Pads', intervalKm: 30000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'brake_fluid', label: 'Brake Fluid', intervalKm: 40000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'coolant', label: 'Coolant', intervalKm: 40000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'spark_plugs', label: 'Spark Plugs', intervalKm: 30000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'chain', label: 'Chain Clean/Lube', intervalKm: 1000, intervalMonths: 2, appliesTo: ['motorcycle'] },
  { key: 'tires', label: 'Tires', intervalKm: 40000, intervalMonths: 60, appliesTo: ['car', 'motorcycle', 'scooter'] },
  { key: 'battery', label: 'Battery', intervalKm: null, intervalMonths: 36, appliesTo: ['car', 'motorcycle', 'scooter'] },
  { key: 'brake_scooter', label: 'Brake Check', intervalKm: null, intervalMonths: 6, appliesTo: ['scooter'] },
  { key: 'tire_pressure', label: 'Tire Pressure', intervalKm: null, intervalMonths: 1, appliesTo: ['scooter', 'motorcycle', 'car'] },
];

export const DOCUMENT_TYPES = [
  { key: 'insurance', label: 'Insurance', icon: '🛡️' },
  { key: 'registration', label: 'Registration / License', icon: '📋' },
  { key: 'inspection', label: 'Technical Inspection (KTEO)', icon: '🔍' },
  { key: 'road_tax', label: 'Road Tax', icon: '💶' },
  { key: 'warranty', label: 'Warranty', icon: '📜' },
  { key: 'other_doc', label: 'Other', icon: '📎' },
];

export const REMINDER_REPEAT = [
  { key: 'none', label: 'Once' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];
