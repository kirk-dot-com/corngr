import { Plugin, PluginKey } from 'prosemirror-state';
import { generateUUID } from '../yjs/schema';

/**
 * BlockIdPlugin - Ensures all block nodes have stable blockId attributes
 * 
 * This plugin automatically assigns UUIDs to paragraph and heading nodes
 * that don't have a blockId. This ensures signatures and metadata persist
 * correctly across document refreshes.
 * 
 * Phase 5: Polish - Fixes the "Block IDs null after refresh" issue
 */

const blockIdPluginKey = new PluginKey('blockId');

export function createBlockIdPlugin(): Plugin {
    return new Plugin({
        key: blockIdPluginKey,

        appendTransaction(_transactions, _oldState, newState) {
            const tr = newState.tr;
            let modified = false;

            // Traverse all nodes in the document
            newState.doc.descendants((node, pos) => {
                // Only process block nodes (paragraph and heading)
                const needsBlockId =
                    (node.type.name === 'paragraph' || node.type.name === 'heading') &&
                    !node.attrs.blockId;

                if (needsBlockId) {
                    // Assign a stable UUID
                    const newAttrs = {
                        ...node.attrs,
                        blockId: generateUUID()
                    };

                    tr.setNodeMarkup(pos, undefined, newAttrs);
                    modified = true;
                }
            });

            // Only return transaction if we actually modified something
            return modified ? tr : null;
        }
    });
}
