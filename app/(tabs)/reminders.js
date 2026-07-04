import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { Card, Button, Field, Chip, Sheet, Empty, Badge } from '../../src/components/ui';
import { COLORS as C, REMINDER_REPEAT } from '../../src/constants';
import { fmtDate } from '../../src/utils/helpers';
import { schedule, cancel } from '../../src/utils/notifications';
import { confirmAction } from '../../src/utils/confirm';

export default function Reminders() {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(newR());

  function newR() {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setSeconds(0);
    return { vehicleId: null, title: '', body: '', dateStr: toLocal(d), repeat: 'none' };
  }

  function toLocal(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function parseLocal(str) {
    const m = str.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  }

  async function save() {
    if (!form.title.trim()) return;
    const date = parseLocal(form.dateStr);
    if (!date) return;
    const notifId = await schedule({ title: form.title, body: form.body || 'Reminder', date: date.toISOString(), repeat: form.repeat });
    await app.insert('reminders', {
      vehicleId: form.vehicleId, title: form.title, body: form.body,
      date: date.toISOString(), repeat: form.repeat, notifId, enabled: true,
    });
    setForm(newR());
    setAdding(false);
  }

  function del(r) {
    confirmAction('Delete reminder?', `"${r.title}" will be permanently removed.`, async () => {
      await cancel(r.notifId);
      await app.remove('reminders', r.id);
    });
  }

  const quick = [
    { title: 'Charge the battery', body: 'Connect the trickle charger', repeat: 'weekly' },
    { title: 'Start & run the engine', body: 'Prevent battery drain', repeat: 'weekly' },
    { title: 'Check tire pressure', body: '', repeat: 'monthly' },
    { title: 'Chain lube', body: 'Clean and lube the chain', repeat: 'weekly' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.headerRow}>
        <Text style={s.title}>Reminders</Text>
        <Button title="+ New" onPress={() => setAdding(true)} small />
      </View>

      {Platform.OS === 'web' && (
        <Card style={{ borderColor: C.amber }}>
          <Text style={s.dim}>Push notifications require the iOS/Android app. On web, reminders are stored but won't fire alerts.</Text>
        </Card>
      )}

      <Text style={s.subhead}>Quick add</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {quick.map((q) => (
          <Chip key={q.title} label={q.title} onPress={() => { setForm({ ...newR(), title: q.title, body: q.body, repeat: q.repeat }); setAdding(true); }} />
        ))}
      </View>

      {app.reminders.length === 0 ? <Empty text="No reminders yet." /> : app.reminders.map((r) => {
        const v = app.vehicles.find((x) => x.id === r.vehicleId);
        return (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{r.title}</Text>
                {r.body ? <Text style={s.dim}>{r.body}</Text> : null}
                <Text style={s.dim}>{fmtDate(r.date)} · {REMINDER_REPEAT.find((x) => x.key === r.repeat)?.label}{v ? ` · ${v.name}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => del(r)}><Text style={s.del}>✕</Text></TouchableOpacity>
            </View>
          </Card>
        );
      })}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="New Reminder">
        <Field label="Title" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Charge the battery" />
        <Field label="Note" value={form.body} onChangeText={(v) => setForm({ ...form, body: v })} placeholder="Optional details" />
        <Field label="Date & time (YYYY-MM-DD HH:MM)" value={form.dateStr} onChangeText={(v) => setForm({ ...form, dateStr: v })} placeholder="2026-07-10 09:00" />
        <Text style={s.dim}>Repeat</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {REMINDER_REPEAT.map((rp) => (
            <Chip key={rp.key} label={rp.label} active={form.repeat === rp.key} onPress={() => setForm({ ...form, repeat: rp.key })} />
          ))}
        </View>
        <Text style={s.dim}>Vehicle (optional)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          <Chip label="None" active={!form.vehicleId} onPress={() => setForm({ ...form, vehicleId: null })} />
          {app.vehicles.map((v) => (
            <Chip key={v.id} label={v.name} active={form.vehicleId === v.id} onPress={() => setForm({ ...form, vehicleId: v.id })} />
          ))}
        </View>
        <Button title="Save reminder" onPress={save} style={{ marginTop: 8 }} />
        <View style={{ height: 20 }} />
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { color: C.text, fontSize: 24, fontWeight: '800' },
  subhead: { color: C.textDim, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  body: { color: C.text, fontSize: 16, fontWeight: '600' },
  dim: { color: C.textDim, fontSize: 13, marginTop: 2 },
  del: { color: C.red, fontSize: 16, paddingHorizontal: 8 },
});
