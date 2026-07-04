import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, ScrollView, Platform,
} from 'react-native';
import { COLORS as C } from '../constants';

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', style, small }) {
  const bg = variant === 'primary' ? C.accentDim
    : variant === 'danger' ? C.red
    : variant === 'ghost' ? 'transparent' : C.cardAlt;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        s.btn,
        { backgroundColor: bg, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: C.border },
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        style,
      ]}
    >
      <Text style={[s.btnText, variant === 'ghost' && { color: C.accent }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value != null ? String(value) : ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: C.accentDim, borderColor: C.accentDim }]}
    >
      <Text style={[s.chipText, active && { color: '#fff' }]}>
        {icon ? icon + ' ' : ''}{label}
      </Text>
    </TouchableOpacity>
  );
}

export function Badge({ label, color }) {
  return (
    <View style={[s.badge, { backgroundColor: (color || C.accent) + '22', borderColor: color || C.accent }]}>
      <Text style={[s.badgeText, { color: color || C.accent }]}>{label}</Text>
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.sheetBackdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Empty({ text }) {
  return <Text style={s.empty}>{text}</Text>;
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  label: { color: C.textDim, fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: C.bg, borderRadius: 10, padding: 12, color: C.text,
    borderWidth: 1, borderColor: C.border, fontSize: 15,
  },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1,
    borderColor: C.border, marginRight: 8, marginBottom: 8, backgroundColor: C.cardAlt,
  },
  chipText: { color: C.text, fontSize: 14 },
  badge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  sheetBackdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%', borderWidth: 1, borderColor: C.border,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  close: { color: C.textDim, fontSize: 22, padding: 4 },
  empty: { color: C.textDim, textAlign: 'center', padding: 30, fontStyle: 'italic' },
});
