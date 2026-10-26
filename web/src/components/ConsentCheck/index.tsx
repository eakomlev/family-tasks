import { Checkbox } from '@/components/Checkbox'
import { OPERATOR } from '@/lib/legal'

// Отдельная галочка согласия на обработку персональных данных (152-ФЗ): по умолчанию выключена, текст согласия и политика по ссылке.
// С пользовательским соглашением она не смешивается: на него только ссылка под галочкой.
export function ConsentCheck({ checked, onChange, terms = true }: { checked: boolean; onChange: (checked: boolean) => void; terms?: boolean }) {
  return (
    <>
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)}>
        Я даю согласие оператору ({OPERATOR.name}) на обработку моих персональных данных и данных моих несовершеннолетних детей на условиях{' '}
        <a href="/privacy#consent" target="_blank" rel="noopener noreferrer">Политики обработки персональных данных</a>
      </Checkbox>
      {terms && (
        <small>
          Продолжая, вы принимаете <a href="/terms" target="_blank" rel="noopener noreferrer">Пользовательское соглашение</a>.
        </small>
      )}
    </>
  )
}
