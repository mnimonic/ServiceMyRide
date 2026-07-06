import { Alert } from 'react-native';

export function confirmAction(title, message, onConfirm, confirmLabel = 'Delete') {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
