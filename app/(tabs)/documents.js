import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { Card, Button, Field, Chip, Sheet, Empty, Badge } from '../../src/components/ui';
import { COLORS as C, DOCUMENT_TYPES } from '../../src/constants';
import { fmtDate, dueStatus, levelColor } from '../../src/utils/helpers';
import { schedule, cancel } from '../../src/utils/notifications';

export default function Documents() {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(newDoc());

  function newDoc() {
    return { vehicleId: null, typeKey: 'insurance', label: '', dueDateStr: '', notes: '', notifyDaysBefore: '7' };
  }

  function parseDate(str) {
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], 9, 0);
  }

  async function save() {
    const due = parseDate(form.dueDateStr);
    if (!due) return;
    const type = DOCUMENT_TYPES.find((t) => t.key === form.typeKey);
    const label = form.label.trim() || type?.label;
    // Schedule a reminder N days before expiry at 9am
    const daysBefore = Number(form.notifyDaysBefore) || 0;
    const notifDate = new Date(due.getTime() - daysBefore * 24 * 3600 * 1000);
    const v = app.vehicles.find((x) => x.id === form.vehicleId);
    let notifId = null;
    if (notifDate.getTime() > Date.now()) {
      notifId = await schedule({
        title: `${label} expiring soon`,
        body: `${v ? v.name + ' — ' : ''}${label} is due ${fmtDate(due.toISOString())}`,
        date: notifDate.toISOString(),
        repeat: 'none',
      });
    }
    await app.insert('documents', {
      vehicleId: form.vehicleId, typeKey: form.typeKey, label,
      dueDate: due.toISOString(), notes: form.notes, notifId,
    });
    setForm(newDoc());
    setAdding(false);
  }

  async function del(d) {
    await cancel(d.notifId);
    await app.remove('documents', d.id);
  }

  const sorted = useMemo(
    () => [...app.documents].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [app.documents]
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.headerRow}>
        <Text style={s.title}>Documents & Dates</Text>
        <Button title="+ Add" onPress={() => setAdding(true)} small />
      </View>

      {sorted.length === 0 ? <Empty text="Add insurance, registration, KTEO and road-tax due dates." /> : sorted.map((d) => {
        const type = DOCUMENT_TYPES.find((t) => t.key === d.typeKey);
        const v = app.vehicles.find((x) => x.id === d.vehicleId);
        const st = dueStatus(d.dueDate);
        return (
          <Card key={d.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{type?.icon} {d.label}</Text>
                <Text style={s.dim}>{v ? v.name + ' · ' : ''}Due {fmtDate(d.dueDate)}</Text>
                {d.notes ? <Text style={s.dim}>{d.notes}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge label={st.label} color={levelColor(st.level, C)} />
                <TouchableOpacity onPress={() => del(d)}><Text style={s.del}>✕</Text></TouchableOpacity>
              </View>
            </View>
          </Card>
        );
      })}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add Document / Due Date">
        <Text style={s.dim}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {DOCUMENT_TYPES.map((t) => <Chip key={t.key} label={t.label} icon={t.icon} active={form.typeKey === t.key} onPress={() => setForm({ ...form, typeKey: t.key })} />)}
        </View>
        <Field label="Label (optional)" value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} placeholder="e.g. Allianz policy #12345" />
        <Field label="Due date (YYYY-MM-DD)" value={form.dueDateStr} onChangeText={(v) => setForm({ ...form, dueDateStr: v })} placeholder="2026-12-31" />
        <Field label="Notify days before" value={form.notifyDaysBefore} onChangeText={(v) => setForm({ ...form, notifyDaysBefore: v })} keyboardType="numeric" placeholder="7" />
        <Text style={s.dim}>Vehicle</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          <Chip label="None" active={!form.vehicleId} onPress={() => setForm({ ...form, vehicleId: null })} />
          {app.vehicles.map((v) => <Chip key={v.id} label={v.name} active={form.vehicleId === v.id} onPress={() => setForm({ ...form, vehicleId: v.id })} />)}
        </View>
        <Field label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline placeholder="Optional" />
        <Button title="Save" onPress={save} style={{ marginTop: 8 }} />
        <View style={{ height: 20 }} />
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { color: C.text, fontSize: 24, fontWeight: '800' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  body: { color: C.text, fontSize: 16, fontWeight: '600' },
  dim: { color: C.textDim, fontSize: 13, marginTop: 2 },
  del: { color: C.red, fontSize: 16, paddingHorizontal: 8 },
});
