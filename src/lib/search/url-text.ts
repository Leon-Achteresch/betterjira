export type UrlText = { text: string; url: string; writes: readonly string[] };

export const initialUrlText = (url: string): UrlText => ({ text: url, url, writes: [] });

export const syncUrlText = (state: UrlText, url: string): UrlText => {
  if (state.url === url) return state;
  if (!state.writes.includes(url)) return initialUrlText(url);
  return { text: state.text, url, writes: state.writes.at(-1) === url ? [] : state.writes };
};

export const typeUrlText = (state: UrlText, text: string, written: string): UrlText => ({
  text,
  url: state.url,
  writes: written === state.url && state.writes.length === 0 ? [] : [...state.writes, written],
});
