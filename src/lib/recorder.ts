/** Gravação de áudio/vídeo com MediaRecorder (funciona offline). */
export type RecordKind = 'audio' | 'video';

const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
const VIDEO_TYPES = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

export function canRecord(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

export function pickMime(kind: RecordKind): string | undefined {
  const list = kind === 'audio' ? AUDIO_TYPES : VIDEO_TYPES;
  return list.find((t) => MediaRecorder.isTypeSupported(t));
}

export function extensionFor(mime: string): string {
  if (mime.includes('mp4')) return mime.startsWith('video') ? 'mp4' : 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export interface Recording {
  stream: MediaStream;
  stop: () => Promise<{ blob: Blob; mime: string; durationMs: number }>;
  cancel: () => void;
}

export async function startRecording(kind: RecordKind): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia(
    kind === 'audio' ? { audio: true } : { audio: true, video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } } },
  );
  const mime = pickMime(kind);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const started = Date.now();
  rec.start(1000);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stream,
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release();
          const type = rec.mimeType || mime || (kind === 'audio' ? 'audio/webm' : 'video/webm');
          resolve({ blob: new Blob(chunks, { type }), mime: type, durationMs: Date.now() - started });
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      release();
    },
  };
}
