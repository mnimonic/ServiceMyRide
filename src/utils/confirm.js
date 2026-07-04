import { Alert, Platform } from 'react-native';

// Alert.alert is a no-op on react-native-web, so confirmations there need
// window.confirm instead of a button-based dialog.
export function confirmAction(title, message, onConfirm, confirmLabel = 'Delete') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
