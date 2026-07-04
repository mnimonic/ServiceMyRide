import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/context/AppContext';
import { useAuth } from '../../src/context/AuthContext';
import { Card, Button, Field, Chip, Sheet, Badge, Empty } from '../../src/components/ui';
import { COLORS as C, VEHICLE_TYPES } from '../../src/constants';
import { computeMaintenanceStatus, dueStatus, levelColor, daysUntil } from '../../src/utils/helpers';

export default function Garage() {
  const app = useApp();
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(newVehicle());
  const [expanded, setExpanded] = useState(() => new Set());

  // Auto-sync once when the garage opens and the user is signed in.
  const didSync = React.useRef(false);
  React.useEffect(() => {
    if (auth.isSignedIn && !didSync.current && auth.syncState.status === 'idle') {
      didSync.current = true;
      auth.syncNow();
    }
  }, [auth.isSignedIn]);

  function newVehicle() {
    return { name: '', type: 'car', make: '', model: '', year: '', plate: '', odometer: '' };
  }

  async function save() {
    if (!form.name.trim()) return;
    await app.insert('vehicles', {
      ...form,
      odometer: form.odometer ? Number(form.odometer) : null,
    });
    setForm(newVehicle());
    setAdding(false);
  }

  // Aggregate alerts across all vehicles, grouped per vehicle for the dashboard
  const alertGroups = useMemo(() => {
    const groups = new Map();
    function pushItem(key, vehicleName, level, text) {
      if (!groups.has(key)) groups.set(key, { key, vehicleName, items: [], overdue: 0, soon: 0 });
      const g = groups.get(key);
      g.items.push({ level, text });
      if (level === 'overdue') g.overdue += 1;
      else if (level === 'soon') g.soon += 1;
    }
    app.vehicles.forEach((v) => {
      computeMaintenanceStatus(v, app.maintenance).forEach((m) => {
        if (m.level === 'overdue' || m.level === 'soon') {
          pushItem(v.id, v.name, m.level, m.preset.label);
        }
      });
    });
    app.documents.forEach((d) => {
      const st = dueStatus(d.dueDate);
      if (st.level !== 'ok') {
        const v = app.vehicles.find((x) => x.id === d.vehicleId);
        pushItem(v ? v.id : 'general', v?.name || 'General', st.level, `${d.label || d.typeKey} ${st.label}`);
      }
    });
    return groups;
  }, [app.vehicles, app.maintenance, app.documents]);

  const generalGroup = alertGroups.get('general');

  function toggleExpanded(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      {generalGroup && (
        <Card style={{ borderColor: C.amber }}>
          <Text style={st.h}>⚠️ Other alerts</Text>
          {generalGroup.items.map((item, i) => (
            <View key={i} style={st.alertRow}>
              <View style={[st.dot, { backgroundColor: levelColor(item.level, C) }]} />
              <Text style={st.alertText}>{item.text}</Text>
            </View>
          ))}
        </Card>
      )}

      <View style={st.headerRow}>
        <Text style={st.title}>My Vehicles</Text>
        <Button title="+ Add" onPress={() => setAdding(true)} small />
      </View>

      {app.vehicles.length === 0 && <Empty text="No vehicles yet. Add your car, motorcycle, or scooter to get started." />}

      {app.vehicles.map((v) => {
        const type = VEHICLE_TYPES.find((t) => t.key === v.type);
        const group = alertGroups.get(v.id);
        const hasAlerts = !!group && group.items.length > 0;
        const isOpen = hasAlerts && expanded.has(v.id);
        return (
          <Card key={v.id}>
            <View style={st.vehicleRow}>
              <TouchableOpacity style={st.vehicleMain} onPress={() => router.push(`/vehicle/${v.id}`)}>
                <Text style={st.vehicleIcon}>{type?.icon || '🔧'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.vehicleName}>{v.name}</Text>
                  <Text style={st.vehicleSub}>
                    {[v.make, v.model, v.year].filter(Boolean).join(' ') || type?.label}
                    {v.odometer ? ` · ${v.odometer} km` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.vehicleBadges}
                onPress={() => hasAlerts && toggleExpanded(v.id)}
                disabled={!hasAlerts}
              >
                {group?.overdue > 0 && <Badge label={`${group.overdue} overdue`} color={C.red} />}
                {group?.soon > 0 && <Badge label={`${group.soon} soon`} color={C.amber} />}
                {!hasAlerts && <Badge label="All good" color={C.green} />}
                {hasAlerts && <Text style={st.chevron}>{isOpen ? '▾' : '▸'}</Text>}
              </TouchableOpacity>
            </View>
            {isOpen && (
              <View style={st.vehicleAlertList}>
                {group.items.map((item, i) => (
                  <View key={i} style={st.alertSubRow}>
                    <View style={[st.dot, st.dotSmall, { backgroundColor: levelColor(item.level, C) }]} />
                    <Text style={st.alertSubText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add Vehicle">
        <Text style={st.label}>Type</Text>
        <View style={st.chips}>
          {VEHICLE_TYPES.map((t) => (
            <Chip key={t.key} label={t.label} icon={t.icon} active={form.type === t.key}
              onPress={() => setForm({ ...form, type: t.key })} />
          ))}
        </View>
        <Field label="Name / Nickname" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. Daily Civic" />
        <Field label="Make" value={form.make} onChangeText={(v) => setForm({ ...form, make: v })} placeholder="Honda" />
        <Field label="Model" value={form.model} onChangeText={(v) => setForm({ ...form, model: v })} placeholder="Innova" />
        <Field label="Year" value={form.year} onChangeText={(v) => setForm({ ...form, year: v })} keyboardType="numeric" placeholder="2018" />
        <Field label="Plate" value={form.plate} onChangeText={(v) => setForm({ ...form, plate: v })} placeholder="ABC-1234" />
        <Field label="Odometer (km)" value={form.odometer} onChangeText={(v) => setForm({ ...form, odometer: v })} keyboardType="numeric" placeholder="45000" />
        <Button title="Save Vehicle" onPress={save} />
        <View style={{ height: 20 }} />
      </Sheet>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  title: { color: C.text, fontSize: 24, fontWeight: '800' },
  h: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  vehicleMain: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  vehicleBadges: { gap: 4, alignItems: 'flex-end' },
  vehicleAlertList: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  vehicleIcon: { fontSize: 34 },
  vehicleName: { color: C.text, fontSize: 18, fontWeight: '700' },
  vehicleSub: { color: C.textDim, fontSize: 13, marginTop: 2 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSmall: { width: 6, height: 6, borderRadius: 3 },
  alertText: { color: C.text, fontSize: 14, flex: 1 },
  chevron: { color: C.textDim, fontSize: 14 },
  alertSubRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingLeft: 18 },
  alertSubText: { color: C.textDim, fontSize: 13, flex: 1 },
  label: { color: C.textDim, fontSize: 13, marginBottom: 8, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
});
