/** Salva/compartilha um arquivo: usa a folha de compartilhar do celular quando existe. */
export async function saveFile(name: string, type: string, content: string | Blob): Promise<void> {
  const file = new File([content], name, { type });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch {
      // cancelado: cai para o download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
