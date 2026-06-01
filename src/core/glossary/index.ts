import cultivation from './global/cultivation.json';
import xianxia from './styles/xianxia.json';

export type GlossaryEntry = {
  find: string;
  replace: string;
  protected?: boolean;
  regex?: boolean;
};

export const globalGlossaries: Record<string, GlossaryEntry[]> = {
  cultivation: cultivation as GlossaryEntry[],
};

export const styleGlossaries: Record<string, GlossaryEntry[]> = {
  xianxia: xianxia as GlossaryEntry[],
};

export default { globalGlossaries, styleGlossaries };
