import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { STORAGE_KEY } from './lib/progress';
import { installAudioUnlock } from './lib/sfx';
import { applyAppearance, savedAppearance } from './lib/theme';
import './styles.css';

// Aplica claro/escuro antes da primeira tela (sem piscar).
applyAppearance(savedAppearance(STORAGE_KEY));

registerSW({ immediate: true });

// Mantém os efeitos sonoros funcionando depois de pausas do sistema (voz, microfone, segundo plano).
installAudioUnlock();

// Pede ao navegador para não apagar o progresso salvo quando faltar espaço.
navigator.storage?.persist?.().catch(() => undefined);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StrictMode>,
  );
}
