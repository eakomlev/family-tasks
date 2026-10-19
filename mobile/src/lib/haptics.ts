import * as Haptics from 'expo-haptics'

// Лёгкий виброотклик при появлении меню по долгому нажатию. Ошибка вибрации (нет мотора, выключена в системе) не должна мешать меню.
export function hapticMenu() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
}
