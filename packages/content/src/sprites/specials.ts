import type { Sprite } from '../schema';
import { sprite } from './util';

/** Special-card sprites keyed by special type (docs/03 section 4). Shared by all copies of a type. */
export const SPECIAL_SPRITES: Record<'displayCase' | 'gift', Sprite> = {
  // Wrapped box with a gold ribbon and bow.
  gift: sprite({ r: '#E63946', d: '#A4202D', y: '#FFC233' }, [
    '..kkk..kkk..',
    '.kyyykkyyyk.',
    '..kkkyykkk..',
    'kkkkkkkkkkkk',
    'krwrryyrrrrk',
    'kkkkkyykkkkk',
    '.krrryyrrrk.',
    '.krwryyrrrk.',
    '.krrryyrrdk.',
    '.kddryyrddk.',
    '.kdddyydddk.',
    '..kkkkkkkk..',
  ]),
  // Glass case on a wooden base with a gold star: the wild card.
  displayCase: sprite({ g: '#BDE6F2', y: '#FFC233', b: '#8B5A2B' }, [
    'kkkkkkkkkkkk',
    'kwgggggggggk',
    'kwgggyyggggk',
    'kggyyyyyyggk',
    'kgyyyyyyyygk',
    'kggyyyyyyggk',
    'kgyyyggyyygk',
    'kgyyggggyygk',
    'kggggggggggk',
    'kkkkkkkkkkkk',
    'kbbbbbbbbbbk',
    'kkkkkkkkkkkk',
  ]),
};
