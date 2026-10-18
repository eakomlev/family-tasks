// Копия данных с заданным типом. Блоб, прочитанный из файла (`fetch(uri).blob()`), в React Native бывает без типа, а `fetch`
// с таким телом подставляет в запрос пустой Content-Type вместо нашего заголовка: сервер отвечает 415 и фото или файл не уходят.
export const withType = (blob: Blob, type: string): Blob => new Blob([blob], { type })
