// Подмена react-native для тестов в Node: нужна только слежка за состоянием приложения
export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove() {} }),
}
