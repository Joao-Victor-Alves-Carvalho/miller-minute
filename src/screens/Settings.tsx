import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { IconArrowLeft } from '../components/Icons';
import { saveFile } from '../lib/files';
import { backupJson, decodeBackup, describe, encodeBackup } from '../lib/backup';
import { buildReminderIcs, parseTime } from '../lib/ics';
import type { Progress, Settings as SettingsT } from '../lib/progress';
import { disablePush, enablePush, pushStatus, testNotification, type PushStatus } from '../lib/push';
import { playCorrect } from '../lib/sfx';

const APP_URL = 'https://joao-victor-alves-carvalho.github.io/miller-minute/';

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <button type="button" className="btn btn-ghost switch setting-toggle" role="switch" aria-checked={on} onClick={onChange}>
      {label} <span className="track" aria-hidden="true" />
    </button>
  );
}

function Choice<T extends number>({ value, options, onChange, suffix }: { value: T; options: T[]; onChange: (v: T) => void; suffix: string }) {
  return (
    <div className="choice-row" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} className={`choice${o === value ? ' on' : ''}`} onClick={() => onChange(o)}>
          {o} {suffix}
        </button>
      ))}
    </div>
  );
}

export function Settings({ progress, setProgress, onBack }: { progress: Progress; setProgress: Dispatch<SetStateAction<Progress>>; onBack: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [pending, setPending] = useState<Progress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = progress.settings;

  const set = (patch: Partial<SettingsT>) => setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 3500);
  };

  const copyCode = async () => {
    const code = encodeBackup(progress);
    try {
      await navigator.clipboard.writeText(code);
      flash('Código copiado! Guarde num lugar seguro (notas, e-mail para você mesmo).');
    } catch {
      setImportText(code);
      flash('Não consegui copiar sozinho: o código está na caixa abaixo, copie manualmente.');
    }
  };

  const tryImport = (text: string) => {
    const result = decodeBackup(text);
    if (!result.ok) {
      setImportError(result.error);
      setPending(null);
      return;
    }
    setImportError(null);
    setPending(result.progress);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) tryImport(await file.text());
    e.target.value = '';
  };

  const time = parseTime(s.reminder) ? s.reminder : '20:00';

  const [push, setPush] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    void pushStatus().then(setPush);
  }, []);

  const copyPushCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      flash('Código de inscrição copiado! Agora cole no segredo PUSH_SUBSCRIPTION do GitHub.');
    } catch {
      flash('Não consegui copiar sozinho: selecione o código na caixa e copie manualmente.');
    }
  };

  return (
    <section className="screen" aria-label="Ajustes">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">Ajustes</h1>
      </div>

      {msg && (
        <p className="flash" role="status">
          {msg}
        </p>
      )}

      <div className="settings-card glass">
        <p className="eyebrow">Áudio</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Toggle label="Voz em inglês automática" on={s.autoAudio} onChange={() => set({ autoAudio: !s.autoAudio })} />
          <Toggle
            label="Sons de acerto e erro"
            on={s.sounds}
            onChange={() => {
              if (!s.sounds) playCorrect();
              set({ sounds: !s.sounds });
            }}
          />
        </div>
      </div>

      <div className="settings-card glass">
        <p className="eyebrow">Meta diária (Tempo de Miller)</p>
        <Choice value={s.goalMinutes} options={[5, 10, 15, 20, 30]} suffix="min" onChange={(v) => set({ goalMinutes: v })} />
        <p className="eyebrow" style={{ marginTop: 10 }}>
          Palavras novas por dia
        </p>
        <Choice value={s.newPerDay} options={[10, 15, 20, 30]} suffix="" onChange={(v) => set({ newPerDay: v })} />
      </div>

      <div className="settings-card glass">
        <p className="eyebrow">Notificações (12h e 21h)</p>
        {push === null && <p className="muted small">Verificando…</p>}
        {push?.kind === 'needs-install' && (
          <p className="muted small">
            No iPhone, as notificações só funcionam com o app instalado: no Safari, toque em Compartilhar → <strong>Adicionar à Tela de Início</strong>, abra o Miller Minute pelo ícone e volte aqui.
          </p>
        )}
        {push?.kind === 'unsupported' && <p className="muted small">{push.reason}</p>}
        {push?.kind === 'denied' && (
          <p className="muted small">
            As notificações estão bloqueadas para o app. Libere nas configurações do celular (Notificações → Miller Minute, ou nas permissões do site no Chrome) e volte aqui.
          </p>
        )}
        {push?.kind === 'off' && (
          <>
            <p className="muted small">
              Receba um lembrete por volta do meio-dia e outro às 21h, com mensagens temáticas de Interestelar. As notificações são enviadas por uma tarefa agendada no GitHub; a configuração é feita uma vez só.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={pushBusy}
              onClick={async () => {
                setPushBusy(true);
                try {
                  setPush(await enablePush());
                } catch {
                  flash('Não consegui ativar agora. Confira a internet e tente de novo.');
                } finally {
                  setPushBusy(false);
                }
              }}
            >
              🔔 Ativar notificações
            </button>
          </>
        )}
        {push?.kind === 'on' && (
          <>
            <p className="muted small">✅ Este aparelho está inscrito. Para as notificações chegarem, o código abaixo precisa estar salvo no GitHub (uma vez só):</p>
            <ol className="steps">
              <li>Toque em <strong>Copiar código de inscrição</strong>.</li>
              <li>
                No GitHub (pelo navegador), abra o repositório <strong>miller-minute</strong> → <strong>Settings</strong> → <strong>Secrets and variables</strong> → <strong>Actions</strong>.
              </li>
              <li>
                Toque em <strong>New repository secret</strong>, nome <code>PUSH_SUBSCRIPTION</code>, cole o código e salve.
              </li>
              <li>
                Crie também o segredo <code>VAPID_PRIVATE_KEY</code> com a chave que o Claude te passou (só na primeira vez).
              </li>
            </ol>
            <textarea className="type-input import-box" readOnly value={push.code} aria-label="Código de inscrição" onFocus={(e) => e.currentTarget.select()} />
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => copyPushCode(push.code)}>
                📋 Copiar código de inscrição
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={async () => flash((await testNotification()) ? 'Notificação de teste enviada para este aparelho.' : 'Não consegui mostrar o teste.')}
              >
                Testar agora
              </button>
            </div>
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={async () => setPush(await disablePush())}>
              Desativar notificações neste aparelho
            </button>
          </>
        )}
      </div>

      <div className="settings-card glass">
        <p className="eyebrow">Lembrete na agenda</p>
        <p className="muted small">
          Cria um evento que se repete todo dia na agenda do celular, com alarme e o link do app. Para mudar o horário depois, edite ou apague o evento na própria agenda.
        </p>
        <div className="row">
          <label className="sr-only" htmlFor="reminder-time">
            Horário do lembrete
          </label>
          <input id="reminder-time" className="type-input time-input" type="time" value={time} onChange={(e) => set({ reminder: e.target.value })} />
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={async () => {
              await saveFile('lembrete-miller-minute.ics', 'text/calendar', buildReminderIcs(time, APP_URL, new Date()));
              flash('Abra o arquivo para adicionar o lembrete à sua agenda.');
            }}
          >
            📅 Adicionar à agenda
          </button>
        </div>
      </div>

      <div className="settings-card glass">
        <p className="eyebrow">Backup do progresso</p>
        <p className="muted small">
          Seu progresso fica só neste aparelho. Faça um backup para não perder (e para levar para outro celular). Hoje: {describe(progress)}.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={copyCode}>
            📋 Copiar código
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={() => saveFile(`miller-minute-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', backupJson(progress))}
          >
            💾 Salvar arquivo
          </button>
        </div>
        <p className="eyebrow" style={{ marginTop: 10 }}>
          Restaurar
        </p>
        <textarea
          className="type-input import-box"
          placeholder='Cole aqui o código que começa com "MM1."'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          aria-label="Código do backup"
        />
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} disabled={!importText.trim()} onClick={() => tryImport(importText)}>
            Usar código
          </button>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
            Abrir arquivo
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json,text/plain" hidden onChange={onFile} />
        </div>
        {importError && (
          <p className="chat-feedback" role="alert">
            {importError}
          </p>
        )}
        {pending && (
          <div className="confirm" role="alertdialog" aria-label="Confirmar restauração">
            <p style={{ margin: 0 }}>
              <strong>Backup encontrado:</strong> {describe(pending)}.
            </p>
            <p className="muted small" style={{ margin: 0 }}>
              Isso substitui o progresso atual deste aparelho ({describe(progress)}).
            </p>
            <div className="row">
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPending(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setProgress(pending);
                  setPending(null);
                  setImportText('');
                  flash('Progresso restaurado!');
                }}
              >
                Restaurar
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="version">Miller Minute v{__APP_VERSION__}</p>
    </section>
  );
}
