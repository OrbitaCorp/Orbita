// La escena espacial con el tema de la landing. El componente vive en el design
// system (lo comparten la landing, el alta, el login y los paneles); acá solo se
// le pasa el tema del ThemeContext de la landing, y sin provider va en oscuro.
import { EscenaEspacial as Escena } from '@/design-system/EscenaEspacial';
import { useThemeOpcional } from '@/modules/landing/context/ThemeContext';

export function EscenaEspacial({ planeta = true }: { planeta?: boolean }) {
    const isDark = useThemeOpcional()?.isDark ?? true;
    return <Escena planeta={planeta} oscuro={isDark} />;
}
