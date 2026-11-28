// Filter chip: a toggle button (aria-pressed) with a word, never only a colour.
import { h } from './dom.js';

export const chip = (label, on, onclick) => h('button', { class: 'de-chip' + (on ? ' is-on' : ''), type: 'button', 'aria-pressed': String(!!on), onclick, text: label });
export const chipRow = (label, chips) => h('div', { class: 'chips chips--scroll', role: 'group', 'aria-label': label }, ...chips);
