import type { RawTag } from '../raw-tag.js';
import { api, ApiRequest, ResponseOf } from './http/index.js';
import type { NamespaceName } from '../interfaces/ehtag.js';
import { MasterTag, store, Tag } from './tag.js';

interface TagSuggestRequest
    extends ApiRequest<
        'tagsuggest',
        {
            tags: Record<number, ApiMasterTag | ApiSlaveTag> | [];
        }
    > {
    text: string;
}

interface ApiMasterTag {
    id: number;
    ns: NamespaceName | 'temp';
    tn: RawTag;
}

interface ApiSlaveTag extends ApiMasterTag {
    mid: number;
    mns: NamespaceName;
    mtn: RawTag;
}

function expandResult(response: ResponseOf<TagSuggestRequest>): Tag[] {
    if (Array.isArray(response.tags)) return [];
    const tags: Tag[] = [];
    for (const key in response.tags) {
        const tag = response.tags[key];
        tag.id = Number.parseInt(key);
        let master: MasterTag | undefined;
        if ('mid' in tag) {
            master = {
                id: tag.mid,
                namespace: tag.mns ?? 'other',
                raw: tag.mtn,
            };
            store(master);
        }
        const current: Tag = {
            id: Number.parseInt(key),
            namespace: tag.ns ?? 'other',
            raw: tag.tn,
            master,
        };
        tags.push(current);
        store(current);
    }
    return tags;
}

const suggestCache = new Map<string, Tag[]>();

/** 通过 'tagsuggest' API 搜索标签，并设置缓存 */
export async function suggestTag(ns: NamespaceName | undefined, raw: string): Promise<Tag[]> {
    raw = raw.trim().toLowerCase();
    const text = `${ns != null ? ns + ':' : ''}${raw}`;
    const cache = suggestCache.get(text);
    if (cache) return cache;

    try {
        const response = await api<TagSuggestRequest>({
            method: 'tagsuggest',
            text,
        });
        const result = expandResult(response);
        if (result.length === 0 && raw.includes('.')) {
            return await suggestTag(ns, raw.slice(0, raw.indexOf('.') - 1) as RawTag);
        }
        suggestCache.set(text, result);
        return result;
    } catch (err) {
        console.error(err);
        throw err;
    }
}
