import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useApp } from '../../src/context/AppContext';
import { Card, Button, Field, Chip, Sheet, Empty, Badge } from '../../src/components/ui';
import { COLORS as C } from '../../src/constants';
import { fmtDate } from '../../src/utils/helpers';
import { confirmAction } from '../../src/utils/confirm';

const CATEGORIES = ['Filters', 'Oil/Fluids', 'Brakes', 'Tires', 'Electrical', 'Consumables', 'Other'];

export default function Inventory() {
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all'); // all | unused | used
  const [form, setForm] = useState(newItem());

  function newItem() {
    return { name: '', category: 'Filters', qty: '1', vehicleId: null, cost: '', notes: '', used: false, purchaseDate: new Date().toISOString() };
  }

  async function save() {
    if (!form.name.trim()) return;
    await app.insert('inventory', {
      ...form, qty: form.qty ? Number(form.qty) : 1, cost: form.cost ? Number(form.cost) : null,
    });
    setForm(newItem());
    setAdding(false);
  }

  const items = useMemo(() => {
    return app.inventory.filter((i) => filter === 'all' ? true : filter === 'unused' ? !i.used : i.used);
  }, [app.inventory, filter]);

  const unusedCount = app.inventory.filter((i) => !i.used).length;
  const totalValue = app.inventory.filter((i) => !i.used).reduce((sum, i) => sum + (i.cost || 0) * (i.qty || 1), 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.headerRow}>
        <Text style={s.title}>Inventory</Text>
        <Button title="+ Add" onPress={() => setAdding(true)} small />
      </View>

      <Card>
        <Text style={s.dim}>{unusedCount} item(s) in stock · Value €{totalValue.toFixed(2)}</Text>
      </Card>

      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="In stock" active={filter === 'unused'} onPress={() => setFilter('unused')} />
        <Chip label="Used" active={filter === 'used'} onPress={() => setFilter('used')} />
      </View>

      {items.length === 0 ? <Empty text="No items. Add parts you've bought but not used yet." /> : items.map((i) => {
        const v = app.vehicles.find((x) => x.id === i.vehicleId);
        return (
          <Card key={i.id} style={i.used && { opacity: 0.6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{i.name} {i.qty > 1 ? `×${i.qty}` : ''}</Text>
                <Text style={s.dim}>{i.category}{v ? ` · ${v.name}` : ''}{i.cost ? ` · €${i.cost}` : ''}</Text>
                <Text style={s.dim}>Bought {fmtDate(i.purchaseDate)}{i.notes ? ` · ${i.notes}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge label={i.used ? 'Used' : 'In stock'} color={i.used ? C.textDim : C.green} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button title={i.used ? 'Mark unused' : 'Mark used'} variant="secondary" small
                onPress={() => app.update('inventory', i.id, { used: !i.used })} />
              <Button title="Delete" variant="ghost" small
                onPress={() => confirmAction('Delete this item?', `"${i.name}" will be permanently removed.`, () => app.remove('inventory', i.id))} />
            </View>
          </Card>
        );
      })}

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add Item">
        <Field label="Item name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. Bosch oil filter 0451103316" />
        <Text style={s.dim}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          {CATEGORIES.map((c) => <Chip key={c} label={c} active={form.category === c} onPress={() => setForm({ ...form, category: c })} />)}
        </View>
        <Field label="Quantity" value={form.qty} onChangeText={(v) => setForm({ ...form, qty: v })} keyboardType="numeric" />
        <Field label="Cost (€)" value={form.cost} onChangeText={(v) => setForm({ ...form, cost: v })} keyboardType="numeric" placeholder="Optional" />
        <Text style={s.dim}>For vehicle (optional)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }}>
          <Chip label="None" active={!form.vehicleId} onPress={() => setForm({ ...form, vehicleId: null })} />
          {app.vehicles.map((v) => <Chip key={v.id} label={v.name} active={form.vehicleId === v.id} onPress={() => setForm({ ...form, vehicleId: v.id })} />)}
        </View>
        <Field label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Where stored, part number…" multiline />
        <Button title="Save item" onPress={save} style={{ marginTop: 8 }} />
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
});
