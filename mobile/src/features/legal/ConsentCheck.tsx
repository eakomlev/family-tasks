import { Checkbox } from '@/components/Checkbox'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { CONSENT_PATH, OPERATOR_NAME, openLegal, TERMS_PATH } from '@/lib/legal'

// Отдельная галочка согласия на обработку персональных данных (152-ФЗ): по умолчанию выключена, политика по ссылке (открывается на сайте).
// С пользовательским соглашением она не смешивается: на него только ссылка под галочкой.
export function ConsentCheck({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Stack $gap={4}>
      <Checkbox checked={checked} onChange={onChange}>
        {`Я даю согласие оператору (${OPERATOR_NAME}) на обработку моих персональных данных и данных моих несовершеннолетних детей на условиях `}
        <Text $tone="accent" $weight="bold" onPress={() => openLegal(CONSENT_PATH)} accessibilityRole="link">
          Политики обработки персональных данных
        </Text>
      </Checkbox>
      <Text $size={13} $tone="muted">
        {'Продолжая, вы принимаете '}
        <Text $size={13} $tone="accent" onPress={() => openLegal(TERMS_PATH)} accessibilityRole="link">
          Пользовательское соглашение
        </Text>
        .
      </Text>
    </Stack>
  )
}
