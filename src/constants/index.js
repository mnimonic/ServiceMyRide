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
  // Engine & fluids
  { key: 'oil', label: 'Engine Oil', intervalKm: 5000, intervalMonths: 12, appliesTo: ['car', 'motorcycle'] },
  { key: 'oil_filter', label: 'Oil Filter', intervalKm: 5000, intervalMonths: 12, appliesTo: ['car', 'motorcycle'] },
  { key: 'coolant', label: 'Coolant', intervalKm: 40000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'coolant_topup', label: 'Coolant Level Check', intervalKm: null, intervalMonths: 6, appliesTo: ['car', 'motorcycle'] },
  { key: 'spark_plugs', label: 'Spark Plugs', intervalKm: 30000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'timing_belt', label: 'Timing Belt', intervalKm: 100000, intervalMonths: 84, appliesTo: ['car'] },
  { key: 'drive_belt', label: 'Serpentine/Drive Belt', intervalKm: 80000, intervalMonths: 60, appliesTo: ['car'] },
  { key: 'transmission_fluid', label: 'Transmission Fluid', intervalKm: 60000, intervalMonths: 48, appliesTo: ['car'] },
  { key: 'clutch', label: 'Clutch', intervalKm: 80000, intervalMonths: null, appliesTo: ['car', 'motorcycle'] },
  { key: 'clutch_fluid', label: 'Clutch Fluid/Cable', intervalKm: 10000, intervalMonths: 12, appliesTo: ['motorcycle'] },
  { key: 'power_steering_fluid', label: 'Power Steering Fluid', intervalKm: 80000, intervalMonths: 60, appliesTo: ['car'] },
  { key: 'differential_fluid', label: 'Differential Fluid', intervalKm: 50000, intervalMonths: 48, appliesTo: ['car'] },
  { key: 'fuel_injector_cleaning', label: 'Fuel Injector Cleaning', intervalKm: 20000, intervalMonths: 12, appliesTo: ['car', 'motorcycle'] },
  { key: 'carb_sync', label: 'Carburetor/Throttle Body Sync', intervalKm: 15000, intervalMonths: 24, appliesTo: ['motorcycle'] },
  { key: 'valve_clearance', label: 'Valve Clearance', intervalKm: 20000, intervalMonths: 24, appliesTo: ['motorcycle'] },

  // Filters
  { key: 'air_filter', label: 'Air Filter', intervalKm: 15000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'cabin_filter', label: 'Cabin Filter', intervalKm: 15000, intervalMonths: 12, appliesTo: ['car'] },
  { key: 'fuel_filter', label: 'Fuel Filter', intervalKm: 30000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },

  // Brakes
  { key: 'brake_pads', label: 'Brake Pads', intervalKm: 30000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'brake_fluid', label: 'Brake Fluid', intervalKm: 40000, intervalMonths: 24, appliesTo: ['car', 'motorcycle'] },
  { key: 'brake_rotors', label: 'Brake Rotors/Discs', intervalKm: 60000, intervalMonths: 48, appliesTo: ['car', 'motorcycle'] },
  { key: 'brake_scooter', label: 'Brake Check', intervalKm: null, intervalMonths: 6, appliesTo: ['scooter'] },

  // Tires, wheels & suspension
  { key: 'tires', label: 'Tires', intervalKm: 40000, intervalMonths: 60, appliesTo: ['car', 'motorcycle', 'scooter'] },
  { key: 'tire_rotation', label: 'Tire Rotation', intervalKm: 10000, intervalMonths: 6, appliesTo: ['car'] },
  { key: 'wheel_alignment', label: 'Wheel Alignment', intervalKm: 20000, intervalMonths: 12, appliesTo: ['car'] },
  { key: 'tire_pressure', label: 'Tire Pressure', intervalKm: null, intervalMonths: 1, appliesTo: ['scooter', 'motorcycle', 'car'] },
  { key: 'wheel_bearings', label: 'Wheel Bearings', intervalKm: 100000, intervalMonths: 72, appliesTo: ['car', 'motorcycle'] },
  { key: 'cv_joints', label: 'CV Joints/Axle Boots', intervalKm: 60000, intervalMonths: 48, appliesTo: ['car'] },
  { key: 'suspension', label: 'Suspension/Shocks', intervalKm: 80000, intervalMonths: 60, appliesTo: ['car'] },
  { key: 'fork_oil', label: 'Fork Oil', intervalKm: 20000, intervalMonths: 24, appliesTo: ['motorcycle'] },
  { key: 'steering_head_bearings', label: 'Steering Head Bearings', intervalKm: 30000, intervalMonths: 36, appliesTo: ['motorcycle'] },

  // Electrical & lighting
  { key: 'battery', label: 'Battery', intervalKm: null, intervalMonths: 36, appliesTo: ['car', 'motorcycle', 'scooter'] },
  { key: 'key_battery', label: 'Key Fob Battery', intervalKm: null, intervalMonths: 24, appliesTo: ['car'] },
  { key: 'headlights', label: 'Headlight/Bulb Check', intervalKm: null, intervalMonths: 12, appliesTo: ['car', 'motorcycle', 'scooter'] },
  { key: 'wiper_blades', label: 'Wiper Blades', intervalKm: null, intervalMonths: 12, appliesTo: ['car'] },
  { key: 'washer_fluid', label: 'Washer Fluid', intervalKm: null, intervalMonths: 6, appliesTo: ['car'] },

  // Comfort & body
  { key: 'ac_service', label: 'A/C Service', intervalKm: null, intervalMonths: 24, appliesTo: ['car'] },
  { key: 'exhaust_check', label: 'Exhaust System Check', intervalKm: 40000, intervalMonths: 36, appliesTo: ['car', 'motorcycle'] },
  { key: 'general_inspection', label: 'General Inspection', intervalKm: null, intervalMonths: 12, appliesTo: ['car', 'motorcycle', 'scooter', 'other'] },

  // Motorcycle drivetrain
  { key: 'chain', label: 'Chain Clean/Lube', intervalKm: 1000, intervalMonths: 2, appliesTo: ['motorcycle'] },
  { key: 'chain_tension', label: 'Chain Tension Adjustment', intervalKm: 500, intervalMonths: 1, appliesTo: ['motorcycle'] },
  { key: 'chain_sprockets', label: 'Chain & Sprockets Replacement', intervalKm: 20000, intervalMonths: 36, appliesTo: ['motorcycle'] },
  { key: 'final_drive', label: 'Final Drive (Shaft/Belt)', intervalKm: 30000, intervalMonths: 36, appliesTo: ['motorcycle'] },

  // Electric scooter specific
  { key: 'scooter_battery_health', label: 'Battery Health Check', intervalKm: null, intervalMonths: 6, appliesTo: ['scooter'] },
  { key: 'scooter_firmware', label: 'Firmware Update', intervalKm: null, intervalMonths: 6, appliesTo: ['scooter'] },
  { key: 'scooter_motor_belt', label: 'Motor/Belt Check', intervalKm: 2000, intervalMonths: 6, appliesTo: ['scooter'] },
  { key: 'scooter_bolts', label: 'Bolts & Fasteners Torque Check', intervalKm: 500, intervalMonths: 3, appliesTo: ['scooter'] },
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
