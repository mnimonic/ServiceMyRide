import { MAINTENANCE_PRESETS } from '../constants';

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function daysUntil(d) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Returns { level: 'ok'|'soon'|'overdue', label } for a due date.
export function dueStatus(dueDate) {
  const days = daysUntil(dueDate);
  if (days === null) return { level: 'ok', label: 'No date' };
  if (days < 0) return { level: 'overdue', label: `${Math.abs(days)}d overdue` };
  if (days <= 30) return { level: 'soon', label: `in ${days}d` };
  return { level: 'ok', label: `in ${days}d` };
}

// Merges the global type-based presets with a vehicle's own overrides
// (vehicle.maintenanceOverrides: { [presetKey]: { enabled, intervalKm, intervalMonths } }).
// A disabled task is dropped entirely; enabled tasks take the vehicle's
// interval when set, otherwise fall back to the preset default.
export function getEffectiveMaintenancePresets(vehicle) {
  const overrides = vehicle.maintenanceOverrides || {};
  return MAINTENANCE_PRESETS.filter((p) => p.appliesTo.includes(vehicle.type))
    .filter((p) => overrides[p.key]?.enabled !== false)
    .map((p) => {
      const o = overrides[p.key];
      if (!o) return p;
      return {
        ...p,
        intervalKm: o.intervalKm !== undefined ? o.intervalKm : p.intervalKm,
        intervalMonths: o.intervalMonths !== undefined ? o.intervalMonths : p.intervalMonths,
      };
    });
}

// Given a vehicle and its maintenance history, compute the last-done record
// per task and whether it's due (by time or odometer).
export function computeMaintenanceStatus(vehicle, maintenanceRecords) {
  const presets = getEffectiveMaintenancePresets(vehicle);
  return presets.map((preset) => {
    const history = maintenanceRecords
      .filter((m) => m.vehicleId === vehicle.id && m.taskKey === preset.key)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = history[0];

    let level = 'ok';
    let detail = 'Never done';

    if (last) {
      detail = '';
      // Time-based check
      if (preset.intervalMonths) {
        const nextDate = new Date(last.date);
        nextDate.setMonth(nextDate.getMonth() + preset.intervalMonths);
        const days = daysUntil(nextDate);
        if (days < 0) level = 'overdue';
        else if (days <= 30 && level !== 'overdue') level = 'soon';
        detail = `Next ~${nextDate.toLocaleDateString(undefined, {
          month: 'short',
          year: 'numeric',
        })}`;
      }
      // Odometer-based check
      if (preset.intervalKm && last.odometer && vehicle.odometer) {
        const nextKm = Number(last.odometer) + preset.intervalKm;
        const remaining = nextKm - Number(vehicle.odometer);
        if (remaining < 0) level = 'overdue';
        else if (remaining <= 500 && level !== 'overdue') level = 'soon';
        detail += `${detail ? ' · ' : ''}${remaining}km left`;
      }
    } else {
      level = 'soon';
    }

    return { preset, last, level, detail };
  });
}

export function levelColor(level, C) {
  if (level === 'overdue') return C.red;
  if (level === 'soon') return C.amber;
  return C.green;
}
