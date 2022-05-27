import { program } from 'commander';
import type { NamespaceName } from '../../../shared/interfaces/ehtag';
import type { RawTag } from '../../../shared/raw-tag';
import { parseTag as parseTagRaw } from '../../../shared/tag';
import type { Tag } from '../../../shared/ehentai';
import clc from 'cli-color';
import escapeRegexp from 'escape-string-regexp';
export { Command } from 'commander';

export const command = program.command('tag').description('用于处理标签的相关工具');

export function parseTag(tag: string): [NamespaceName | undefined, RawTag] {
    const r = parseTagRaw(tag);
    if (!r.valid) throw new Error('无效的标签');
    return [r.ns, r.raw];
}

export function formatTag(tag: Pick<Tag, 'namespace' | 'raw'>, term?: string): string {
    let raw: string = tag.raw;
    if (term) {
        const reg = new RegExp(escapeRegexp(term), 'gi');
        raw = raw.replace(reg, clc.bold(term));
    }
    return `${clc.green(tag.namespace)}${clc.blackBright(':')}${raw}`;
}
