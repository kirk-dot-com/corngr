import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

export const slashCommandPluginKey = new PluginKey('slashCommand');

interface SlashPluginState {
    active: boolean;
    query: string | null;
    range: { from: number; to: number } | null;
    coords: { top: number; left: number } | null;
}

interface SlashPluginOptions {
    onOpen: (query: string, range: { from: number; to: number }, coords: { top: number; left: number }) => void;
    onClose: () => void;
    onKeyDown: (event: KeyboardEvent) => boolean;
}

export const createSlashCommandPlugin = (options: SlashPluginOptions) => {
    return new Plugin({
        key: slashCommandPluginKey,
        state: {
            init() {
                return { active: false, query: null, range: null, coords: null } as SlashPluginState;
            },
            apply(tr, prev) {
                const meta = tr.getMeta(slashCommandPluginKey);
                if (meta) {
                    return { ...prev, ...meta };
                }
                if (tr.docChanged || tr.selectionSet) {
                    // We will re-evaluate in view.update
                    // But to be safe, we can reset if selection moves away
                    // For now, let's persist and let view.update decide
                    return prev;
                }
                return prev;
            }
        },
        props: {
            handleKeyDown(view, event) {
                const state = slashCommandPluginKey.getState(view.state) as SlashPluginState;
                if (!state.active) return false;

                // Configure specific keys to pass to React
                if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key)) {
                    return options.onKeyDown(event);
                }

                return false;
            }
        },
        view(view: EditorView) {
            return {
                update: (view, prevState) => {
                    const selection = view.state.selection;

                    // Only trigger if empty selection (cursor)
                    if (!selection.empty) {
                        const state = slashCommandPluginKey.getState(view.state);
                        if (state.active) {
                            view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, { active: false }));
                            options.onClose();
                        }
                        return;
                    }

                    const $from = selection.$from;
                    // Look back for /
                    const textBefore = $from.parent.textBetween(Math.max(0, $from.parentOffset - 20), $from.parentOffset, null, '\ufffc');

                    // Regex: Start of block or space, followed by /, followed by chars
                    const match = textBefore.match(/(^|\s)\/(\w*)$/);

                    const state = slashCommandPluginKey.getState(view.state);

                    if (match) {
                        const query = match[2];
                        const matchLength = match[0].length;
                        // Calculate start pos
                        // match[0] includes space if present.
                        // We want strictly the range covering "/query"
                        const isSpaceStart = match[1] === ' ';
                        const totalLen = query.length + 1; // +1 for '/'
                        const from = $from.pos - totalLen;
                        const to = $from.pos;

                        const coords = view.coordsAtPos(from);

                        // If not active or query changed
                        if (!state.active || state.query !== query) {
                            // Update plugin state
                            // We need to dispatch, but we are in update.
                            // To avoid loops/errors, only dispatch if needed.
                            // Note: Dispatching in update() is risky. 
                            // BUT this is how many plugins work (sync).
                            // A safer way is using 'appendTransaction' for logic, 
                            // but 'coords' are only available in view.

                            // Let's just notify React. 
                            // React will re-render menu.
                            options.onOpen(query, { from, to }, coords);

                            // We DO need to update plugin state so handleKeyDown knows we are active.
                            // But dispatching triggers update() again.
                            // We use a flag checking if we *just* dispatched?
                            // Or comparison.
                            if (!state.active || state.query !== query) {
                                // Defer dispatch to avoid "flush" error
                                setTimeout(() => {
                                    if (!view.isDestroyed) {
                                        view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, {
                                            active: true,
                                            query,
                                            range: { from, to },
                                            coords
                                        }));
                                    }
                                }, 0);
                            }
                        }
                    } else {
                        if (state.active) {
                            options.onClose();
                            setTimeout(() => {
                                if (!view.isDestroyed) {
                                    view.dispatch(view.state.tr.setMeta(slashCommandPluginKey, { active: false }));
                                }
                            }, 0);
                        }
                    }
                }
            };
        }
    });
};
