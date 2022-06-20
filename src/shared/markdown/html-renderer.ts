import { serialize, SerializerOptions, TreeAdapterTypeMap, TreeAdapter, html, Token } from 'parse5';
import {
    BreakNode,
    ContainerNode,
    InlineNode,
    Node,
    Tree,
    NodeType,
    TextNode,
    ParaNode,
    LinkNode,
    ImageNode,
    StrongNode,
    EmphasisNode,
    TagRefNode,
    NodeMap,
    isContainer,
    isNodeType,
} from '../interfaces/ehtag.ast.js';
import { renderText } from './text-renderer.js';
import { tagAbbr } from '../tag.js';

const FRAGMENT_NODE = '#root';
export interface DocumentFragment {
    type: typeof FRAGMENT_NODE;
    content: Node[];
}

const props = {
    parent: new WeakMap<Node, ContainerNode>(),
    namespaceURI: new WeakMap<Node, html.NS>(),
};
type Props = keyof typeof props;
type PropValue<T extends Props> = typeof props[T] extends WeakMap<object, infer V> ? V : never;

function getProp<T extends Props>(node: Node, key: T): PropValue<T> | undefined {
    const map = props[key] as WeakMap<Node, PropValue<T>>;
    return map.get(node);
}

function setProp<T extends keyof typeof props>(node: Node, key: T, value?: PropValue<T>): void {
    const map = props[key] as WeakMap<Node, PropValue<T>>;
    if (value === undefined) {
        map.delete(node);
    } else {
        map.set(node, value);
    }
}

function getAttr(attrs: Token.Attribute[], name: string): string | undefined {
    const attr = attrs.find((a) => a.name === name);
    return attr?.value;
}

const COMMENT_NODE = '#comment';
interface __CommentNode {
    type: typeof COMMENT_NODE;
    text: string;
}
const DOCUMENT_NODE = '#document';
interface __Document {
    type: typeof DOCUMENT_NODE;
    content: Node[];
}
const TEMPLATE_NODE = '#template';
interface __Template {
    type: typeof TEMPLATE_NODE;
    template: DocumentFragment;
}
interface __UnknownNode {
    type: string;
    attrs: Token.Attribute[];
}

// interface NodeMapEx extends NodeMap {
//     [TEMPLATE_NODE]: __Template;
//     [DOCUMENT_NODE]: __Document;
//     [COMMENT_NODE]: __CommentNode;
//     [FRAGMENT_NODE]: DocumentFragment;
//     [TEMPLATE_NODE]: __Template;
// }

type MyTreeAdapterTypeMap = TreeAdapterTypeMap<
    Node,
    __Document | DocumentFragment | Node,
    Node,
    __Document,
    DocumentFragment,
    Node,
    __CommentNode,
    TextNode,
    never,
    never
>;

const ELEMENT_MAP: Record<string, (attrs: Token.Attribute[]) => Node> = {
    a(attrs): LinkNode {
        return {
            type: 'link',
            content: [],
            title: getAttr(attrs, 'title') ?? '',
            url: getAttr(attrs, 'href') ?? '',
        };
    },
    img(attrs): ImageNode {
        let title = getAttr(attrs, 'title') ?? '';
        let src = getAttr(attrs, 'src') ?? '';
        let nsfw: ImageNode['nsfw'] = false;
        const alt = getAttr(attrs, 'alt');
        if (/^https?:\/\/.+/i.test(title)) {
            if (src === '#') {
                nsfw = 'R18';
                src = title;
                title = '';
            } else if (src === '##') {
                nsfw = 'R18G';
                src = title;
                title = '';
            }
        }
        const node: ImageNode = {
            type: 'image',
            content: [],
            title: title,
            url: src,
            nsfw: nsfw,
        };
        if (alt) {
            node.content.push({ type: 'text', text: alt } as TextNode);
        }
        return node;
    },
    strong(): StrongNode {
        return { type: 'strong', content: [] };
    },
    em(): EmphasisNode {
        return { type: 'emphasis', content: [] };
    },
    br(): BreakNode {
        return { type: 'br' };
    },
    code(): TagRefNode {
        return { type: 'tagref' } as TagRefNode;
    },
    p(): ParaNode {
        return { type: 'paragraph', content: [] };
    },
    template(): Node {
        return {
            type: TEMPLATE_NODE,
        } as __Template as unknown as Node;
    },
};
const ATTR_MAP: {
    [T in NodeType]: undefined | ((node: NodeMap[T]) => Token.Attribute[]);
} = {
    link(node) {
        const attr = [{ name: 'href', value: node.url }];
        if (node.title) attr.push({ name: 'title', value: node.title });
        return attr;
    },
    image(node) {
        const attr = [{ name: 'src', value: node.url }];
        if (node.title) attr.push({ name: 'title', value: node.title });
        if (node.content.length > 0) {
            attr.push({ name: 'alt', value: renderText(node.content) });
        }
        if (node.nsfw) attr.push({ name: 'nsfw', value: node.nsfw });
        return attr;
    },
    tagref(node) {
        const attrs = [];
        if (node.tag) {
            if (node.explicitNs) {
                attrs.push({ name: 'title', value: tagAbbr(node.tag, node.ns) });
            } else {
                attrs.push({ name: 'title', value: node.tag });
            }

            if (node.ns) {
                attrs.push({ name: 'ns', value: node.ns });
            }
        }
        return attrs;
    },
    br: undefined,
    paragraph: undefined,
    strong: undefined,
    emphasis: undefined,
    text: undefined,
};

const TAG_NAME_MAP: {
    [T in NodeType | typeof TEMPLATE_NODE]: string | undefined;
} = {
    [TEMPLATE_NODE]: 'template',
    tagref: 'abbr',
    paragraph: 'p',
    link: 'a',
    image: 'img',
    strong: 'strong',
    emphasis: 'em',
    br: 'br',
    text: undefined,
};

class SerializeTreeAdapter implements TreeAdapter<MyTreeAdapterTypeMap> {
    constructor(
        private readonly _ELEMENT_MAP: typeof ELEMENT_MAP,
        private readonly _ATTR_MAP: typeof ATTR_MAP,
        private readonly _TAG_NAME_MAP: typeof TAG_NAME_MAP,
    ) {}
    updateNodeSourceCodeLocation(_node: Node, _location: Partial<Token.ElementLocation>): void {
        throw new Error('Method not implemented.');
    }
    adoptAttributes(_recipient: Node, _attrs: Token.Attribute[]): void {
        throw new Error('Method not implemented.');
    }
    appendChild(parentNode: ContainerNode, newNode: InlineNode): void {
        parentNode.content = parentNode.content ?? [];
        setProp(newNode, 'parent', parentNode);
        parentNode.content.push(newNode);
    }
    createCommentNode(data: string): __CommentNode {
        return { type: COMMENT_NODE, text: data };
    }
    createDocument(): __Document {
        return { type: DOCUMENT_NODE, content: [] };
    }
    createDocumentFragment(): DocumentFragment {
        return { type: FRAGMENT_NODE, content: [] };
    }
    createElement(tagName: string, namespaceURI: html.NS, attrs: Token.Attribute[]): Node {
        const creater = this._ELEMENT_MAP[tagName];
        const node: Node = creater
            ? creater(attrs)
            : ({
                  type: tagName,
                  attrs,
              } as __UnknownNode as Node);
        setProp(node, 'namespaceURI', namespaceURI);
        return node;
    }
    detachNode(node: InlineNode): void {
        const parent = getProp(node, 'parent');
        if (parent) {
            const i = parent.content.indexOf(node);
            if (i >= 0) parent.content.splice(i, 1);
            setProp(node, 'parent');
        }
    }
    getAttrList(element: Node): Token.Attribute[] {
        if ('attrs' in element) return (element as __UnknownNode).attrs ?? [];
        const attrList = this._ATTR_MAP[element.type];
        if (attrList) return attrList(element as never);
        return [];
    }
    getChildNodes(node: Node): Node[] {
        if (isContainer(node)) return node.content ?? [];
        if (isNodeType(node, 'tagref')) return [{ type: 'text', text: node.text } as TextNode];
        return [];
    }
    getCommentNodeContent(commentNode: __CommentNode): string {
        return commentNode.text;
    }
    getDocumentMode(_document: __Document): html.DOCUMENT_MODE {
        throw new Error('Method not implemented.');
    }
    getDocumentTypeNodeName(_doctypeNode: never): string {
        throw new Error('Method not implemented.');
    }
    getDocumentTypeNodePublicId(_doctypeNode: never): string {
        throw new Error('Method not implemented.');
    }
    getDocumentTypeNodeSystemId(_doctypeNode: never): string {
        throw new Error('Method not implemented.');
    }
    getFirstChild(node: ContainerNode): Node {
        return this.getChildNodes(node)[0];
    }
    getNamespaceURI(element: Node): html.NS {
        return getProp(element, 'namespaceURI') ?? html.NS.HTML;
    }
    getNodeSourceCodeLocation(_node: Node): Token.ElementLocation | undefined | null {
        throw new Error('Method not implemented.');
    }
    getParentNode(node: Node): ContainerNode {
        return getProp(node, 'parent') as ContainerNode;
    }
    getTagName(element: Node): string {
        return this._TAG_NAME_MAP[element.type] ?? element.type;
    }
    getTextNodeContent(textNode: TextNode): string {
        return textNode.text;
    }
    getTemplateContent(templateElement: Node): DocumentFragment {
        return (templateElement as unknown as __Template).template;
    }
    insertBefore(parentNode: ContainerNode, newNode: InlineNode, referenceNode: InlineNode): void {
        const i = parentNode.content.indexOf(referenceNode);
        parentNode.content.splice(i, 0, newNode);
        setProp(newNode, 'parent', parentNode);
    }
    insertText(parentNode: ContainerNode, text: string): void {
        if (isNodeType(parentNode, 'tagref')) {
            parentNode.text = (parentNode.text ?? '') + (text ?? '');
            return;
        }
        this.appendChild(parentNode, { type: 'text', text } as TextNode);
    }
    insertTextBefore(parentNode: ContainerNode, text: string, referenceNode: InlineNode): void {
        this.insertBefore(parentNode, { type: 'text', text } as TextNode, referenceNode);
    }
    isCommentNode(node: Node | __CommentNode): node is __CommentNode {
        return node.type === COMMENT_NODE;
    }
    isDocumentTypeNode(_node: Node): _node is never {
        return false;
    }
    isElementNode(node: Node): node is Node {
        if (node.type === 'text') return false;
        if (NodeType.includes(node.type)) return true;
        const t = node.type as string;
        if (t === DOCUMENT_NODE || t === FRAGMENT_NODE || t === TEMPLATE_NODE) return true;
        return false;
    }
    isTextNode(node: Node): node is TextNode {
        return node.type === 'text';
    }
    setDocumentMode(_document: __Document, _mode: html.DOCUMENT_MODE): void {
        throw new Error('Method not implemented.');
    }
    setDocumentType(_document: __Document, _name: string, _publicId: string, _systemId: string): void {
        throw new Error('Method not implemented.');
    }
    setNodeSourceCodeLocation(_node: Node, _location: Token.ElementLocation | null): void {
        throw new Error('Method not implemented.');
    }
    setTemplateContent(templateElement: __Template | Node, contentElement: DocumentFragment): void {
        (templateElement as __Template).template = contentElement;
    }
}
const options: SerializerOptions<MyTreeAdapterTypeMap> = {
    treeAdapter: new SerializeTreeAdapter(ELEMENT_MAP, ATTR_MAP, TAG_NAME_MAP),
};
export function renderHtml(node: Node | Tree): string {
    const frag: DocumentFragment = {
        type: '#root',
        content: Array.isArray(node) ? node : [node],
    };
    return serialize(frag, options);
}
