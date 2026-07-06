import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { Card, Button, Field, Chip, Sheet, Badge, Empty } from '../../src/components/ui';
import { COLORS as C, VEHICLE_TYPES, MAINTENANCE_PRESETS } from '../../src/constants';
import { computeMaintenanceStatus, getEffectiveMaintenancePresets, levelColor, fmtDate } from '../../src/utils/helpers';
import { isSupported, scanForDevices, monitorDevice } from '../../src/utils/bluetooth';
import { startDistanceTracking } from '../../src/utils/location';
import { confirmAction } from '../../src/utils/confirm';
import { pickVehiclePhoto, takeVehiclePhoto } from '../../src/utils/image';

export default function VehicleDetail() {
  const { id } = useLocalSearchParams();
  const app = useApp();
  const router = useRouter();
  const vehicle = app.vehicles.find((v) => v.id === id);

  const [logging, setLogging] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [devices, setDevices] = useState([]);
  const [log, setLog] = useState(newLog());
  const [editingOdo, setEditingOdo] = useState(false);
  const [odo, setOdo] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState({});
  const [photoSheet, setPhotoSheet] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [maintCollapsed, setMaintCollapsed] = useState(true);
  const [manualLogging, setManualLogging] = useState(false);
  const [manualLog, setManualLog] = useState(newManualLog());
  const [editingDrive, setEditingDrive] = useState(null);

  function newManualLog() {
    return { dateStr: toDateInput(new Date().toISOString()), distanceKm: '' };
  }

  function newLog() {
    return { taskKeys: [], customLabels: [], customInput: '', dateStr: toDateInput(new Date().toISOString()), odometer: '', cost: '', notes: '' };
  }

  function toDateInput(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function parseDateInput(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const statuses = useMemo(
    () => (vehicle ? computeMaintenanceStatus(vehicle, app.maintenance) : []),
    [vehicle, app.maintenance]
  );

  const maintSummary = useMemo(() => ({
    overdue: statuses.filter((st) => st.level === 'overdue').length,
    soon: statuses.filter((st) => st.level === 'soon').length,
  }), [statuses]);

  const history = useMemo(
    () => app.maintenance.filter((m) => m.vehicleId === id).sort((a, b) => (b.odometer ?? -Infinity) - (a.odometer ?? -Infinity)),
    [app.maintenance, id]
  );

  const drives = useMemo(
    () => app.drives.filter((d) => d.vehicleId === id).sort((a, b) => new Date(b.start) - new Date(a.start)),
    [app.drives, id]
  );

  // Kept fresh so the onDisconnect closure below always bumps from the
  // latest odometer reading, not a stale one from when the effect was set up.
  const vehicleRef = useRef(vehicle);
  useEffect(() => { vehicleRef.current = vehicle; }, [vehicle]);

  // Monitor paired bluetooth device -> auto open/close a drive session,
  // tracking GPS distance for the session's duration.
  useEffect(() => {
    if (!vehicle?.bleId || !isSupported()) return;
    let openDriveId = null;
    let tracker = null;
    const stop = monitorDevice(vehicle.bleId, {
      onConnect: async () => {
        const d = await app.insert('drives', { vehicleId: id, start: new Date().toISOString(), end: null, bleName: vehicle.bleName });
        openDriveId = d.id;
        tracker = await startDistanceTracking();
      },
      onDisconnect: async () => {
        if (openDriveId) {
          const distanceKm = tracker ? await tracker.stop() : 0;
          await app.update('drives', openDriveId, { end: new Date().toISOString(), distanceKm: distanceKm || null });
          if (distanceKm > 0) {
            const current = vehicleRef.current?.odometer || 0;
            await app.update('vehicles', id, { odometer: Math.round(current + distanceKm) });
          }
          openDriveId = null;
          tracker = null;
        }
      },
    });
    return () => {
      stop();
      if (tracker) tracker.stop();
    };
  }, [vehicle?.bleId]);

  if (!vehicle) {
    return <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}><Text style={{ color: C.textDim }}>Vehicle not found.</Text></View>;
  }

  const type = VEHICLE_TYPES.find((t) => t.key === vehicle.type);
  const basePresetsForType = MAINTENANCE_PRESETS.filter((p) => p.appliesTo.includes(vehicle.type));
  const presetsForType = getEffectiveMaintenancePresets(vehicle);

  function openCustomize() {
    const draft = {};
    basePresetsForType.forEach((p) => {
      const o = vehicle.maintenanceOverrides?.[p.key];
      draft[p.key] = {
        enabled: o?.enabled !== false,
        intervalKm: String(o?.intervalKm !== undefined ? (o.intervalKm ?? '') : (p.intervalKm ?? '')),
        intervalMonths: String(o?.intervalMonths !== undefined ? (o.intervalMonths ?? '') : (p.intervalMonths ?? '')),
      };
    });
    setOverrideDraft(draft);
    setCustomizing(true);
  }

  function updateDraft(key, patch) {
    setOverrideDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  function resetDraft(key, p) {
    setOverrideDraft((d) => ({
      ...d,
      [key]: { enabled: true, intervalKm: String(p.intervalKm ?? ''), intervalMonths: String(p.intervalMonths ?? '') },
    }));
  }

  async function saveCustomize() {
    const overrides = {};
    basePresetsForType.forEach((p) => {
      const d = overrideDraft[p.key];
      if (!d) return;
      const km = d.intervalKm.trim() === '' ? null : Number(d.intervalKm);
      const months = d.intervalMonths.trim() === '' ? null : Number(d.intervalMonths);
      const entry = {};
      if (!d.enabled) entry.enabled = false;
      if (km !== (p.intervalKm ?? null)) entry.intervalKm = km;
      if (months !== (p.intervalMonths ?? null)) entry.intervalMonths = months;
      if (Object.keys(entry).length > 0) overrides[p.key] = entry;
    });
    await app.update('vehicles', id, { maintenanceOverrides: overrides });
    setCustomizing(false);
  }

  function addCustomTask() {
    const label = log.customInput.trim();
    if (!label) return;
    setLog({ ...log, customLabels: [...log.customLabels, label], customInput: '' });
  }

  function removeCustomTask(label) {
    setLog({ ...log, customLabels: log.customLabels.filter((l) => l !== label) });
  }

  function togglePresetTask(key) {
    setLog({
      ...log,
      taskKeys: log.taskKeys.includes(key) ? log.taskKeys.filter((k) => k !== key) : [...log.taskKeys, key],
    });
  }

  function buildTasks(taskKeys, customLabels) {
    return [
      ...taskKeys.map((key) => ({
        taskKey: key,
        label: MAINTENANCE_PRESETS.find((p) => p.key === key)?.label || key,
      })),
      ...customLabels.map((label, i) => ({ taskKey: `custom_${Date.now()}_${i}`, label })),
    ];
  }

  async function saveLog() {
    const tasks = buildTasks(log.taskKeys, log.customLabels);
    if (tasks.length === 0) return;
    const parsedDate = parseDateInput(log.dateStr);
    if (!parsedDate) { Alert.alert('Invalid date', 'Use format YYYY-MM-DD.'); return; }

    await app.insert('maintenance', {
      vehicleId: id,
      tasks,
      date: parsedDate.toISOString(),
      odometer: log.odometer ? Number(log.odometer) : null,
      cost: log.cost ? Number(log.cost) : null,
      notes: log.notes,
    });
    // Bump vehicle odometer if the logged reading is higher
    if (log.odometer && Number(log.odometer) > (vehicle.odometer || 0)) {
      await app.update('vehicles', id, { odometer: Number(log.odometer) });
    }
    setLog(newLog());
    setLogging(false);
  }

  function startPairing() {
    if (!isSupported()) {
      Alert.alert('Not available', 'Bluetooth pairing works on a physical iOS/Android device, not on a simulator. You can still log drives manually.');
      return;
    }
    setDevices([]);
    setPairing(true);
    const stop = scanForDevices(
      (dev) => setDevices((prev) => (prev.find((d) => d.id === dev.id) ? prev : [...prev, dev])),
      (err) => Alert.alert('Bluetooth error', String(err.message || err))
    );
    // stop scan when sheet closes
    return stop;
  }

  async function pickDevice(dev) {
    await app.update('vehicles', id, { bleId: dev.id, bleName: dev.name });
    setPairing(false);
  }

  function confirmDelete() {
    confirmAction(
      'Delete vehicle?',
      'This removes the vehicle and all its logs, documents and reminders.',
      async () => { await app.removeVehicle(id); router.back(); }
    );
  }

  function confirmDeleteHistory(h) {
    confirmAction(
      'Delete this service record?',
      `${h.tasks.map((t) => t.label).join(', ')} on ${fmtDate(h.date)} will be permanently removed.`,
      () => app.remove('maintenance', h.id)
    );
  }

  function confirmDeleteDrive(d) {
    confirmAction(
      'Delete this drive?',
      `The drive on ${fmtDate(d.start)} will be permanently removed.`,
      () => app.remove('drives', d.id)
    );
  }

  function openEditDrive(d) {
    setEditingDrive({ id: d.id, distanceKm: d.distanceKm != null ? String(d.distanceKm) : '' });
  }

  async function saveEditDrive() {
    const distanceKm = editingDrive.distanceKm.trim() === '' ? null : Number(editingDrive.distanceKm);
    await app.update('drives', editingDrive.id, { distanceKm });
    setEditingDrive(null);
  }

  async function saveManualLog() {
    const parsedDate = parseDateInput(manualLog.dateStr);
    if (!parsedDate) { Alert.alert('Invalid date', 'Use format YYYY-MM-DD.'); return; }
    const distanceKm = manualLog.distanceKm.trim() === '' ? null : Number(manualLog.distanceKm);
    await app.insert('drives', { vehicleId: id, start: parsedDate.toISOString(), end: parsedDate.toISOString(), bleName: 'manual', distanceKm });
    setManualLog(newManualLog());
    setManualLogging(false);
  }

  function openEditRecord(h) {
    const taskKeys = [];
    const customLabels = [];
    h.tasks.forEach((t) => {
      if (MAINTENANCE_PRESETS.some((p) => p.key === t.taskKey)) taskKeys.push(t.taskKey);
      else customLabels.push(t.label);
    });
    setEditingRecord({
      id: h.id,
      taskKeys,
      customLabels,
      customInput: '',
      dateStr: toDateInput(h.date),
      odometer: h.odometer != null ? String(h.odometer) : '',
      cost: h.cost != null ? String(h.cost) : '',
      notes: h.notes || '',
    });
  }

  function toggleEditPresetTask(key) {
    setEditingRecord({
      ...editingRecord,
      taskKeys: editingRecord.taskKeys.includes(key)
        ? editingRecord.taskKeys.filter((k) => k !== key)
        : [...editingRecord.taskKeys, key],
    });
  }

  function addEditCustomTask() {
    const label = editingRecord.customInput.trim();
    if (!label) return;
    setEditingRecord({ ...editingRecord, customLabels: [...editingRecord.customLabels, label], customInput: '' });
  }

  function removeEditCustomTask(label) {
    setEditingRecord({ ...editingRecord, customLabels: editingRecord.customLabels.filter((l) => l !== label) });
  }

  async function saveEditRecord() {
    const tasks = buildTasks(editingRecord.taskKeys, editingRecord.customLabels);
    if (tasks.length === 0) return;
    const parsedDate = parseDateInput(editingRecord.dateStr);
    if (!parsedDate) { Alert.alert('Invalid date', 'Use format YYYY-MM-DD.'); return; }
    await app.update('maintenance', editingRecord.id, {
      tasks,
      date: parsedDate.toISOString(),
      odometer: editingRecord.odometer ? Number(editingRecord.odometer) : null,
      cost: editingRecord.cost ? Number(editingRecord.cost) : null,
      notes: editingRecord.notes,
    });
    setEditingRecord(null);
  }

  async function saveOdo() {
    await app.update('vehicles', id, { odometer: odo ? Number(odo) : null });
    setEditingOdo(false);
  }

  async function choosePhotoFromLibrary() {
    const res = await pickVehiclePhoto();
    if (res.error) { Alert.alert('Error', res.error); return; }
    if (res.canceled) return;
    await app.update('vehicles', id, { photo: res.uri });
    setPhotoSheet(false);
  }

  async function capturePhoto() {
    const res = await takeVehiclePhoto();
    if (res.error) { Alert.alert('Error', res.error); return; }
    if (res.canceled) return;
    await app.update('vehicles', id, { photo: res.uri });
    setPhotoSheet(false);
  }

  async function removePhoto() {
    await app.update('vehicles', id, { photo: null });
    setPhotoSheet(false);
  }

  function openEditVehicle() {
    setVehicleDraft({
      type: vehicle.type,
      name: vehicle.name || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year != null ? String(vehicle.year) : '',
      plate: vehicle.plate || '',
    });
    setEditingVehicle(true);
  }

  async function saveVehicleEdit() {
    if (!vehicleDraft.name.trim()) return;
    await app.update('vehicles', id, { ...vehicleDraft });
    setEditingVehicle(false);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: vehicle.name }} />

      {/* Header card */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => setPhotoSheet(true)} style={s.photoWrap}>
            {vehicle.photo ? (
              <Image source={{ uri: vehicle.photo }} style={s.photo} />
            ) : (
              <View style={s.photoPlaceholder}><Text style={{ fontSize: 32 }}>{type?.icon}</Text></View>
            )}
            <View style={s.photoEditBadge}><Text style={s.photoEditIcon}>✎</Text></View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{vehicle.name}</Text>
            <Text style={s.sub}>{[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}</Text>
            {vehicle.plate ? <Text style={s.sub}>Plate: {vehicle.plate}</Text> : null}
          </View>
          <TouchableOpacity onPress={openEditVehicle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.edit}>✎</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => { setOdo(String(vehicle.odometer || '')); setEditingOdo(true); }} style={s.odoBox}>
          <Text style={s.odoLabel}>Odometer</Text>
          <Text style={s.odoVal}>{vehicle.odometer ? `${vehicle.odometer} km` : 'Tap to set'}</Text>
        </TouchableOpacity>
      </Card>

      {/* Bluetooth pairing */}
      <Card>
        <Text style={s.h}>🔵 Drive Detection</Text>
        {vehicle.bleId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={s.body}>Paired: {vehicle.bleName || 'device'}</Text>
              <Text style={s.dim}>Drives auto-log when connected</Text>
            </View>
            <Button title="Unpair" variant="ghost" small onPress={() => app.update('vehicles', id, { bleId: null, bleName: null })} />
          </View>
        ) : (
          <>
            <Text style={s.dim}>Pair the vehicle's Bluetooth (head unit, intercom, dongle) to auto-detect when you drive.</Text>
            <Button title="Pair Bluetooth device" variant="secondary" small style={{ marginTop: 10 }} onPress={startPairing} />
          </>
        )}
      </Card>

      {/* History */}
      <View style={s.headerRow}>
        <Text style={s.section}>Service History</Text>
        <Button title="+ Log service" onPress={() => setLogging(true)} small />
      </View>
      <Card>
        {history.length === 0 ? <Empty text="No service logged yet." /> : history.map((h) => (
          <View key={h.id} style={s.histRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.body}>{h.tasks.map((t) => t.label).join(', ')}</Text>
              <Text style={s.dim}>{fmtDate(h.date)}{h.odometer ? ` · ${h.odometer}km` : ''}{h.cost ? ` · €${h.cost}` : ''}{h.notes ? ` · ${h.notes}` : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => openEditRecord(h)}><Text style={s.edit}>✎</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDeleteHistory(h)}><Text style={s.del}>✕</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </Card>

      {/* Maintenance status */}
      <TouchableOpacity style={s.headerRow} activeOpacity={0.7} onPress={() => setMaintCollapsed((c) => !c)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.section}>Maintenance</Text>
          <Text style={s.collapseArrow}>{maintCollapsed ? '▸' : '▾'}</Text>
        </View>
        {maintCollapsed ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {maintSummary.overdue > 0 && <Badge label={`${maintSummary.overdue} overdue`} color={levelColor('overdue', C)} />}
            {maintSummary.soon > 0 && <Badge label={`${maintSummary.soon} soon`} color={levelColor('soon', C)} />}
            {maintSummary.overdue === 0 && maintSummary.soon === 0 && <Badge label="OK" color={levelColor('ok', C)} />}
          </View>
        ) : (
          <Button title="Customize" variant="ghost" small onPress={openCustomize} />
        )}
      </TouchableOpacity>

      {!maintCollapsed && (
        <Card>
          {statuses.length === 0 ? <Empty text="No maintenance tasks enabled for this vehicle." /> : statuses.map((st) => (
            <TouchableOpacity key={st.preset.key} style={s.maintRow}
              onPress={() => { setLog({ ...newLog(), taskKeys: [st.preset.key], odometer: String(vehicle.odometer || '') }); setLogging(true); }}>
              <View style={[s.dot, { backgroundColor: levelColor(st.level, C) }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{st.preset.label}</Text>
                <Text style={s.dim}>{st.last ? `Last: ${fmtDate(st.last.date)}${st.last.odometer ? ` @ ${st.last.odometer}km` : ''} · ${st.detail}` : st.detail}</Text>
              </View>
              <Badge label={st.level === 'overdue' ? 'Overdue' : st.level === 'soon' ? 'Soon' : 'OK'} color={levelColor(st.level, C)} />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {/* Drives */}
      <Text style={s.section}>Recent Drives</Text>
      <Card>
        {drives.length === 0 ? <Empty text="No drives recorded. Pair Bluetooth or log manually." /> : drives.slice(0, 10).map((d) => (
          <View key={d.id} style={s.histRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.body}>{fmtDate(d.start)}</Text>
              <Text style={s.dim}>{d.end ? 'completed' : 'in progress'}{d.distanceKm ? ` · ${d.distanceKm} km` : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => openEditDrive(d)}><Text style={s.edit}>✎</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDeleteDrive(d)}><Text style={s.del}>✕</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        <Button title="+ Log drive manually" variant="ghost" small style={{ marginTop: 8 }}
          onPress={() => setManualLogging(true)} />
      </Card>

      <Button title="Delete vehicle" variant="danger" style={{ marginTop: 8 }} onPress={confirmDelete} />

      {/* Log service sheet */}
      <Sheet visible={logging} onClose={() => { setLogging(false); setLog(newLog()); }} title="Log Service">
        <Text style={s.dim}>Tasks done in this visit</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {presetsForType.map((p) => (
            <Chip key={p.key} label={p.label} active={log.taskKeys.includes(p.key)} onPress={() => togglePresetTask(p.key)} />
          ))}
        </View>
        {log.customLabels.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {log.customLabels.map((label) => (
              <Chip key={label} label={label} icon="✕" active onPress={() => removeCustomTask(label)} />
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Custom task" value={log.customInput} onChangeText={(v) => setLog({ ...log, customInput: v })} placeholder="e.g. Valve clearance" />
          </View>
          <Button title="Add" variant="secondary" small onPress={addCustomTask} style={{ marginBottom: 14 }} />
        </View>
        <Field label="Odometer (km)" value={log.odometer} onChangeText={(v) => setLog({ ...log, odometer: v })} keyboardType="numeric" placeholder={String(vehicle.odometer || '')} />
        <Field label="Cost (€)" value={log.cost} onChangeText={(v) => setLog({ ...log, cost: v })} keyboardType="numeric" placeholder="Optional" />
        <Field label="Notes" value={log.notes} onChangeText={(v) => setLog({ ...log, notes: v })} placeholder="Brand, part number, shop…" multiline />
        <Field label="Date (YYYY-MM-DD)" value={log.dateStr} onChangeText={(v) => setLog({ ...log, dateStr: v })} placeholder={toDateInput(new Date().toISOString())} />
        <Button title="Save service log" onPress={saveLog} style={{ marginTop: 12 }} />
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Edit service record sheet */}
      <Sheet visible={!!editingRecord} onClose={() => setEditingRecord(null)} title="Edit Service Record">
        {editingRecord && (
          <>
            <Text style={s.dim}>Tasks done in this visit</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
              {presetsForType.map((p) => (
                <Chip key={p.key} label={p.label} active={editingRecord.taskKeys.includes(p.key)} onPress={() => toggleEditPresetTask(p.key)} />
              ))}
            </View>
            {editingRecord.customLabels.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
                {editingRecord.customLabels.map((label) => (
                  <Chip key={label} label={label} icon="✕" active onPress={() => removeEditCustomTask(label)} />
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Field label="Custom task" value={editingRecord.customInput} onChangeText={(v) => setEditingRecord({ ...editingRecord, customInput: v })} placeholder="e.g. Valve clearance" />
              </View>
              <Button title="Add" variant="secondary" small onPress={addEditCustomTask} style={{ marginBottom: 14 }} />
            </View>
            <Field label="Date (YYYY-MM-DD)" value={editingRecord.dateStr} onChangeText={(v) => setEditingRecord({ ...editingRecord, dateStr: v })} placeholder="2026-07-04" />
            <Field label="Odometer (km)" value={editingRecord.odometer} onChangeText={(v) => setEditingRecord({ ...editingRecord, odometer: v })} keyboardType="numeric" placeholder={String(vehicle.odometer || '')} />
            <Field label="Cost (€)" value={editingRecord.cost} onChangeText={(v) => setEditingRecord({ ...editingRecord, cost: v })} keyboardType="numeric" placeholder="Optional" />
            <Field label="Notes" value={editingRecord.notes} onChangeText={(v) => setEditingRecord({ ...editingRecord, notes: v })} placeholder="Brand, part number, shop…" multiline />
            <Button title="Save changes" onPress={saveEditRecord} style={{ marginTop: 12 }} />
          </>
        )}
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Manual drive log sheet */}
      <Sheet visible={manualLogging} onClose={() => { setManualLogging(false); setManualLog(newManualLog()); }} title="Log Drive">
        <Field label="Date (YYYY-MM-DD)" value={manualLog.dateStr} onChangeText={(v) => setManualLog({ ...manualLog, dateStr: v })} placeholder={toDateInput(new Date().toISOString())} />
        <Field label="Distance (km)" value={manualLog.distanceKm} onChangeText={(v) => setManualLog({ ...manualLog, distanceKm: v })} keyboardType="numeric" placeholder="Optional" />
        <Button title="Save drive" onPress={saveManualLog} style={{ marginTop: 12 }} />
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Edit drive distance sheet */}
      <Sheet visible={!!editingDrive} onClose={() => setEditingDrive(null)} title="Edit Drive">
        {editingDrive && (
          <Field label="Distance (km)" value={editingDrive.distanceKm} onChangeText={(v) => setEditingDrive({ ...editingDrive, distanceKm: v })} keyboardType="numeric" placeholder="Optional" />
        )}
        <Button title="Save changes" onPress={saveEditDrive} style={{ marginTop: 12 }} />
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Pairing sheet */}
      <Sheet visible={pairing} onClose={() => setPairing(false)} title="Pair Bluetooth">
        <Text style={s.dim}>Turn on the vehicle's Bluetooth and select it below.</Text>
        {devices.length === 0 ? <Text style={[s.dim, { marginTop: 16 }]}>Scanning…</Text> : devices.map((d) => (
          <TouchableOpacity key={d.id} style={s.devRow} onPress={() => pickDevice(d)}>
            <Text style={s.body}>{d.name}</Text>
            <Text style={s.dim}>{d.id.slice(0, 12)}…</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Vehicle photo sheet */}
      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)} title="Vehicle Photo">
        <Button title="Choose from library" onPress={choosePhotoFromLibrary} />
        <Button title="Take photo" variant="secondary" onPress={capturePhoto} style={{ marginTop: 8 }} />
        {vehicle.photo ? (
          <Button title="Remove photo" variant="ghost" onPress={removePhoto} style={{ marginTop: 8 }} />
        ) : null}
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Edit vehicle sheet */}
      <Sheet visible={editingVehicle} onClose={() => setEditingVehicle(false)} title="Edit Vehicle">
        {vehicleDraft && (
          <>
            <Text style={s.dim}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              {VEHICLE_TYPES.map((t) => (
                <Chip key={t.key} label={t.label} icon={t.icon} active={vehicleDraft.type === t.key}
                  onPress={() => setVehicleDraft({ ...vehicleDraft, type: t.key })} />
              ))}
            </View>
            <Field label="Name / Nickname" value={vehicleDraft.name} onChangeText={(v) => setVehicleDraft({ ...vehicleDraft, name: v })} placeholder="e.g. Daily Civic" />
            <Field label="Make" value={vehicleDraft.make} onChangeText={(v) => setVehicleDraft({ ...vehicleDraft, make: v })} placeholder="Honda" />
            <Field label="Model" value={vehicleDraft.model} onChangeText={(v) => setVehicleDraft({ ...vehicleDraft, model: v })} placeholder="Innova" />
            <Field label="Year" value={vehicleDraft.year} onChangeText={(v) => setVehicleDraft({ ...vehicleDraft, year: v })} keyboardType="numeric" placeholder="2018" />
            <Field label="Plate" value={vehicleDraft.plate} onChangeText={(v) => setVehicleDraft({ ...vehicleDraft, plate: v })} placeholder="ABC-1234" />
            <Button title="Save changes" onPress={saveVehicleEdit} style={{ marginTop: 12 }} />
          </>
        )}
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Odometer edit sheet */}
      <Sheet visible={editingOdo} onClose={() => setEditingOdo(false)} title="Update Odometer">
        <Field label="Current odometer (km)" value={odo} onChangeText={setOdo} keyboardType="numeric" placeholder="45000" />
        <Button title="Save" onPress={saveOdo} />
        <View style={{ height: 20 }} />
      </Sheet>

      {/* Customize maintenance schedule sheet */}
      <Sheet visible={customizing} onClose={() => setCustomizing(false)} title="Customize Maintenance">
        <Text style={s.dim}>Turn tasks off or set intervals just for this vehicle. Leave blank to skip that check.</Text>
        {basePresetsForType.map((p) => {
          const d = overrideDraft[p.key] || {};
          return (
            <View key={p.key} style={s.customRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.body}>{p.label}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip label={d.enabled ? 'On' : 'Off'} active={d.enabled} onPress={() => updateDraft(p.key, { enabled: !d.enabled })} />
                  <Chip label="Reset" onPress={() => resetDraft(p.key, p)} />
                </View>
              </View>
              {d.enabled && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Interval (km)" value={d.intervalKm} onChangeText={(v) => updateDraft(p.key, { intervalKm: v })} keyboardType="numeric" placeholder="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Interval (months)" value={d.intervalMonths} onChangeText={(v) => updateDraft(p.key, { intervalMonths: v })} keyboardType="numeric" placeholder="none" />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <Button title="Save schedule" onPress={saveCustomize} style={{ marginTop: 4 }} />
        <View style={{ height: 20 }} />
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  name: { color: C.text, fontSize: 22, fontWeight: '800' },
  sub: { color: C.textDim, fontSize: 13, marginTop: 2 },
  h: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  section: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  collapseArrow: { color: C.textDim, fontSize: 35, fontWeight: '700', paddingTop: 7 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  body: { color: C.text, fontSize: 15, fontWeight: '500' },
  dim: { color: C.textDim, fontSize: 13, marginTop: 2 },
  photoWrap: { position: 'relative' },
  photo: { width: 64, height: 64, borderRadius: 32 },
  photoPlaceholder: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: C.cardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  photoEditIcon: { color: C.bg, fontSize: 12, fontWeight: '700' },
  odoBox: { marginTop: 14, backgroundColor: C.bg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  odoLabel: { color: C.textDim, fontSize: 12 },
  odoVal: { color: C.accent, fontSize: 18, fontWeight: '700', marginTop: 2 },
  maintRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  customRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  devRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  del: { color: C.red, fontSize: 16, paddingHorizontal: 8 },
  edit: { color: C.accent, fontSize: 16, paddingHorizontal: 8 },
});
