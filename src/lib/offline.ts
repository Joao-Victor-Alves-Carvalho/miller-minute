/** Verificações para estudar sem internet (navegador). */
export interface OfflineCheck {
  id: 'app' | 'voice' | 'mic';
  ok: boolean;
  label: string;
  help?: string;
}

function hasLocalEnglishVoice(): boolean {
  try {
    return window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('en') && v.localService);
  } catch {
    return false;
  }
}

export function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function offlineChecks(): OfflineCheck[] {
  const ios = isIosDevice();
  const appCached = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
  const voice = 'speechSynthesis' in window && hasLocalEnglishVoice();
  return [
    {
      id: 'app',
      ok: appCached,
      label: appCached ? 'App salvo no aparelho: abre sem internet' : 'App ainda não está salvo para uso offline',
      help: appCached ? undefined : 'Abra o app pelo ícone com internet, espere alguns segundos e feche. Na próxima vez ele já abre offline.',
    },
    {
      id: 'voice',
      ok: voice,
      label: voice ? 'Voz em inglês instalada no aparelho' : 'Sem voz em inglês offline (o áudio pode não tocar no metrô)',
      help: voice
        ? undefined
        : ios
          ? 'No iPhone: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Inglês, e baixe uma voz.'
          : 'No Android: Configurações → Sistema → Idiomas → Saída de texto para voz → Mecanismo do Google → Instalar dados de voz → Inglês.',
    },
    {
      id: 'mic',
      ok: ios,
      label: ios ? 'Perguntas de falar podem funcionar offline' : 'Perguntas de falar ficam escondidas sem internet',
      help: ios ? undefined : 'No Android, o reconhecimento de voz usa a internet. Sem sinal, o app troca essas perguntas por outras automaticamente.',
    },
  ];
}
