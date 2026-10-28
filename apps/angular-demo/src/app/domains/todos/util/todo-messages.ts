/**
 * Shown by the list and the detail page when saving a todo answered 409 (optimistic locking): the
 * todo was changed elsewhere (another tab or device) since it was loaded. Nothing was saved, and
 * the store has reloaded the todo, so the user can redo the change on the current state.
 */
export const TODO_CONFLICT_MESSAGE =
  'Úlohu medzitým zmenil niekto iný (napr. v inej karte). Načítala sa jej aktuálna verzia, zopakuj zmenu.';
