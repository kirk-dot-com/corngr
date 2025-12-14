import { Schema, Node as PMNode } from 'prosemirror-model';

/**
 * Custom ProseMirror schema for Corngr documents
 * Extends basic schema with variable nodes for transclusion
 */

export const corngrSchema = new Schema({
    nodes: {
        doc: {
            content: 'block+'
        },

        paragraph: {
            content: 'inline*',
            group: 'block',
            parseDOM: [{ tag: 'p' }],
            toDOM() {
                return ['p', 0];
            }
        },

        heading: {
            attrs: { level: { default: 1 } },
            content: 'inline*',
            group: 'block',
            defining: true,
            parseDOM: [
                { tag: 'h1', attrs: { level: 1 } },
                { tag: 'h2', attrs: { level: 2 } },
                { tag: 'h3', attrs: { level: 3 } }
            ],
            toDOM(node) {
                return ['h' + node.attrs.level, 0];
            }
        },

        // Custom variable node for transclusion
        variable: {
            attrs: {
                blockId: {},
                name: {},
                value: { default: null },
                format: { default: 'text' }
            },
            group: 'inline',
            inline: true,
            atom: true,
            selectable: true,
            parseDOM: [{
                tag: 'span[data-variable]',
                getAttrs(dom) {
                    const el = dom as HTMLElement;
                    return {
                        blockId: el.getAttribute('data-block-id'),
                        name: el.getAttribute('data-name'),
                        value: el.getAttribute('data-value'),
                        format: el.getAttribute('data-format') || 'text'
                    };
                }
            }],
            toDOM(node) {
                const { blockId, name, value, format } = node.attrs;
                return [
                    'span',
                    {
                        class: 'corngr-variable',
                        'data-variable': 'true',
                        'data-block-id': blockId,
                        'data-name': name,
                        'data-value': value,
                        'data-format': format,
                        contenteditable: 'false'
                    },
                    `{{${name}}}`
                ];
            }
        },

        text: {
            group: 'inline'
        }
    },

    marks: {
        strong: {
            parseDOM: [
                { tag: 'strong' },
                { tag: 'b', getAttrs: (node: any) => node.style.fontWeight !== 'normal' && null },
                { style: 'font-weight', getAttrs: (value: any) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null }
            ],
            toDOM() {
                return ['strong', 0];
            }
        },

        em: {
            parseDOM: [
                { tag: 'i' },
                { tag: 'em' },
                { style: 'font-style=italic' }
            ],
            toDOM() {
                return ['em', 0];
            }
        },

        code: {
            parseDOM: [{ tag: 'code' }],
            toDOM() {
                return ['code', 0];
            }
        },

        link: {
            attrs: {
                href: {},
                title: { default: null }
            },
            inclusive: false,
            parseDOM: [{
                tag: 'a[href]',
                getAttrs(dom) {
                    const el = dom as HTMLElement;
                    return {
                        href: el.getAttribute('href'),
                        title: el.getAttribute('title')
                    };
                }
            }],
            toDOM(node) {
                const { href, title } = node.attrs;
                return ['a', { href, title }, 0];
            }
        }
    }
});

/**
 * Helper to create a variable node
 */
export function createVariableNode(
    blockId: string,
    name: string,
    value: any,
    format: string = 'text'
): PMNode {
    return corngrSchema.nodes.variable.create({
        blockId,
        name,
        value,
        format
    });
}

/**
 * Helper to create a paragraph with text
 */
export function createParagraph(text: string): PMNode {
    return corngrSchema.nodes.paragraph.create(
        null,
        text ? corngrSchema.text(text) : null
    );
}

/**
 * Helper to create a heading
 */
export function createHeading(level: number, text: string): PMNode {
    return corngrSchema.nodes.heading.create(
        { level },
        text ? corngrSchema.text(text) : null
    );
}
